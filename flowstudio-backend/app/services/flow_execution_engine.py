"""
FlowStudio Flow Execution Engine
Manages the execution of visual flows by orchestrating component execution
"""
import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime
from collections import defaultdict, deque

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from ..models.execution import FlowExecution, ComponentExecution, ExecutionLog
from ..models.flow import Flow
from .component_executors import ComponentExecutorFactory, ExecutionContext, ExecutionResult
from .websocket_manager import execution_notifier

logger = logging.getLogger(__name__)


class FlowExecutionEngine:
    """
    Main engine for executing visual flows
    Handles topological sorting, component orchestration, and result management
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.executor_factory = ComponentExecutorFactory()
        self.execution_state: Dict[str, Any] = {}
        
    async def execute_flow(
        self, 
        flow_id: str, 
        user_id: str, 
        execution_config: Optional[Dict[str, Any]] = None
    ) -> FlowExecution:
        """
        Execute a flow and return the execution record
        """
        logger.info(f"Starting flow execution: {flow_id} for user: {user_id}")
        
        # Get flow data
        flow = await self._get_flow(flow_id)
        if not flow:
            raise ValueError(f"Flow not found: {flow_id}")
        
        # Create execution record
        execution = await self._create_execution_record(flow, user_id, execution_config)
        
        try:
            # Parse flow data
            flow_data = flow.flow_data or {}
            nodes = flow_data.get('nodes', [])
            edges = flow_data.get('edges', [])
            
            if not nodes:
                await self._update_execution_status(execution.id, "completed", "No components to execute")
                return execution
            
            # Build execution graph
            execution_graph = self._build_execution_graph(nodes, edges)
            
            # Validate execution graph
            if not self._validate_execution_graph(execution_graph, nodes):
                await self._update_execution_status(execution.id, "failed", "Invalid flow structure")
                return execution
            
            # Calculate execution order (topological sort)
            execution_order = self._calculate_execution_order(execution_graph, nodes)
            
            # Create component execution records
            await self._create_component_execution_records(execution.id, nodes, execution_order)
            
            # Start execution
            await self._update_execution_status(execution.id, "running")
            await self._log_execution(execution.id, "info", f"Starting execution of {len(nodes)} components")
            
            # Send WebSocket notification
            await execution_notifier.notify_execution_started(str(execution.id), user_id)
            
            # Execute components in order
            await self._execute_components(execution.id, nodes, edges, execution_order, user_id)
            
            # Finalize execution
            await self._finalize_execution(execution.id, user_id)
            
        except Exception as e:
            logger.error(f"Flow execution failed: {e}")
            await self._update_execution_status(execution.id, "failed", str(e))
            await self._log_execution(execution.id, "error", f"Execution failed: {str(e)}")
            
            # Send WebSocket notification
            await execution_notifier.notify_execution_failed(str(execution.id), str(e), user_id)
            
            raise
        
        return execution
    
    async def _get_flow(self, flow_id: str) -> Optional[Flow]:
        """Get flow by ID"""
        result = await self.db.execute(
            select(Flow).where(Flow.id == flow_id)
        )
        return result.scalar_one_or_none()
    
    async def _create_execution_record(
        self, 
        flow: Flow, 
        user_id: str, 
        execution_config: Optional[Dict[str, Any]]
    ) -> FlowExecution:
        """Create a new execution record"""
        execution = FlowExecution(
            flow_id=flow.id,
            user_id=user_id,
            status="pending",
            execution_config=execution_config or {},
            flow_snapshot=flow.flow_data or {},
            total_components=len((flow.flow_data or {}).get('nodes', []))
        )
        
        self.db.add(execution)
        await self.db.commit()
        await self.db.refresh(execution)
        
        return execution
    
    def _build_execution_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, Set[str]]:
        """
        Build execution dependency graph from nodes and edges
        Returns dict mapping node_id -> set of dependent node_ids
        """
        graph = defaultdict(set)
        
        # Initialize all nodes
        for node in nodes:
            graph[node['id']] = set()
        
        # Add dependencies based on edges
        for edge in edges:
            source_id = edge['source']
            target_id = edge['target']
            
            # Target depends on source
            graph[target_id].add(source_id)
        
        return dict(graph)
    
    def _validate_execution_graph(self, graph: Dict[str, Set[str]], nodes: List[Dict]) -> bool:
        """Validate that the execution graph is valid (no cycles, all nodes present)"""
        # Check for cycles using DFS
        visited = set()
        rec_stack = set()
        
        def has_cycle(node_id: str) -> bool:
            if node_id in rec_stack:
                return True
            if node_id in visited:
                return False
            
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for dependency in graph.get(node_id, set()):
                if has_cycle(dependency):
                    return True
            
            rec_stack.remove(node_id)
            return False
        
        # Check all nodes for cycles
        for node in nodes:
            if node['id'] not in visited:
                if has_cycle(node['id']):
                    logger.error(f"Cycle detected in execution graph involving node: {node['id']}")
                    return False
        
        return True
    
    def _calculate_execution_order(self, graph: Dict[str, Set[str]], nodes: List[Dict]) -> List[str]:
        """
        Calculate execution order using topological sorting
        Returns list of node IDs in execution order
        """
        # Calculate in-degree for each node
        in_degree = {node['id']: 0 for node in nodes}
        
        for node_id, dependencies in graph.items():
            in_degree[node_id] = len(dependencies)
        
        # Initialize queue with nodes that have no dependencies
        queue = deque([node_id for node_id, degree in in_degree.items() if degree == 0])
        execution_order = []
        
        while queue:
            current_node = queue.popleft()
            execution_order.append(current_node)
            
            # Update in-degree for nodes that depend on current node
            for node_id, dependencies in graph.items():
                if current_node in dependencies:
                    in_degree[node_id] -= 1
                    if in_degree[node_id] == 0:
                        queue.append(node_id)
        
        if len(execution_order) != len(nodes):
            raise ValueError("Unable to determine execution order - graph may contain cycles")
        
        return execution_order
    
    async def _create_component_execution_records(
        self, 
        execution_id: str, 
        nodes: List[Dict], 
        execution_order: List[str]
    ):
        """Create component execution records for all nodes"""
        node_map = {node['id']: node for node in nodes}
        
        for i, node_id in enumerate(execution_order):
            node = node_map[node_id]
            component_execution = ComponentExecution(
                flow_execution_id=execution_id,
                component_id=node_id,
                component_type=node['data']['template']['component_type'],
                execution_order=i,
                config_data=node['data']
            )
            self.db.add(component_execution)
        
        await self.db.commit()
    
    async def _execute_components(
        self, 
        execution_id: str, 
        nodes: List[Dict], 
        edges: List[Dict], 
        execution_order: List[str],
        user_id: str
    ):
        """Execute components in the specified order"""
        node_map = {node['id']: node for node in nodes}
        component_outputs = {}  # Store outputs from each component
        
        for i, node_id in enumerate(execution_order):
            node = node_map[node_id]
            
            try:
                await self._log_execution(execution_id, "info", f"Executing component: {node_id}")
                
                # Update component status to running
                await self._update_component_status(execution_id, node_id, "running")
                
                # Send WebSocket notification
                await execution_notifier.notify_component_started(str(execution_id), node_id, user_id)
                
                # Prepare input data from connected components
                input_data = self._prepare_component_input(node_id, edges, component_outputs, node)
                
                # Get executor for this component type
                component_type = node['data']['template']['component_type']
                executor = self.executor_factory.get_executor(component_type)
                
                # Create execution context
                context = ExecutionContext(
                    component_id=node_id,
                    component_type=component_type,
                    config_data=node['data'],
                    input_data=input_data,
                    execution_id=execution_id,
                    db=self.db
                )
                
                # Execute component
                result = await executor.execute(context)
                
                # Store output for downstream components
                component_outputs[node_id] = result.output_data
                
                # Update component execution record
                await self._update_component_execution(execution_id, node_id, result)
                
                # Send WebSocket notification
                await execution_notifier.notify_component_completed(str(execution_id), node_id, user_id)
                
                # Update progress
                await self._update_execution_progress(execution_id, i + 1, len(execution_order))
                
                # Send progress update via WebSocket
                progress = int(((i + 1) / len(execution_order)) * 100)
                await execution_notifier.notify_execution_progress(str(execution_id), progress, user_id)
                
            except Exception as e:
                logger.error(f"Component execution failed: {node_id} - {e}")
                await self._update_component_status(execution_id, node_id, "failed", str(e))
                await self._log_execution(execution_id, "error", f"Component {node_id} failed: {str(e)}")
                
                # Send WebSocket notification
                await execution_notifier.notify_component_failed(str(execution_id), node_id, str(e), user_id)
                
                raise
    
    def _prepare_component_input(
        self, 
        node_id: str, 
        edges: List[Dict], 
        component_outputs: Dict[str, Any], 
        node: Dict
    ) -> Dict[str, Any]:
        """Prepare input data for a component based on connected edges"""
        input_data = {}
        
        # Get input schema from component template
        template = node['data']['template']
        input_schema = template.get('input_schema', {})
        
        # Start with configured input values
        configured_inputs = node['data'].get('input_values', {})
        input_data.update(configured_inputs)
        
        # Add data from connected components
        for edge in edges:
            if edge['target'] == node_id:
                source_id = edge['source']
                source_handle = edge.get('sourceHandle')
                target_handle = edge.get('targetHandle')
                edge_data = edge.get('data', {})
                
                if source_id in component_outputs and source_handle:
                    source_output = component_outputs[source_id]
                    
                    # Handle multi-variable connection (new)
                    if edge_data.get('isMultiVariableConnection') and edge_data.get('variableMappings'):
                        # This edge contains multiple variable mappings
                        if isinstance(source_output, dict) and 'output' in source_output:
                            output_content = source_output['output']
                            if isinstance(output_content, dict):
                                # Apply each variable mapping
                                for mapping in edge_data['variableMappings']:
                                    output_var = mapping['outputVariable']
                                    target_var = mapping['targetVariable']
                                    if output_var in output_content:
                                        input_data[target_var] = output_content[output_var]
                    
                    # Handle single output port structure (legacy support for direct connections)
                    elif source_handle == 'output' and isinstance(source_output, dict) and 'output' in source_output:
                        # The output is nested within the 'output' key
                        output_content = source_output['output']
                        if isinstance(output_content, dict):
                            if target_handle:
                                # Check if target wants a specific field from the nested output
                                if target_handle in output_content:
                                    input_data[target_handle] = output_content[target_handle]
                                else:
                                    # Check for variable mapping syntax (e.g., "output.text", "output.length")
                                    if '.' in target_handle and target_handle.startswith('output.'):
                                        var_name = target_handle.split('.', 1)[1]
                                        if var_name in output_content:
                                            input_data[target_handle] = output_content[var_name]
                                    else:
                                        # For prompt templates and other components that expect specific variables
                                        # Make all nested variables available at the top level
                                        input_data.update(output_content)
                            else:
                                # No specific target handle, pass all variables
                                input_data.update(output_content)
                        else:
                            # If output content is not a dict, pass it directly
                            if target_handle:
                                input_data[target_handle] = output_content
                    
                    # Handle variable extraction from output object (enhanced support)
                    elif (source_handle and '.' in source_handle and 
                          source_handle.startswith('output.') and 
                          isinstance(source_output, dict) and 'output' in source_output):
                        # Handle direct variable reference like "output.text" -> "text"
                        var_name = source_handle.split('.', 1)[1]
                        output_content = source_output['output']
                        if isinstance(output_content, dict) and var_name in output_content and target_handle:
                            input_data[target_handle] = output_content[var_name]
                    
                    # Handle legacy multi-port structure (backward compatibility)
                    elif isinstance(source_output, dict) and source_handle in source_output and target_handle:
                        input_data[target_handle] = source_output[source_handle]
        
        return input_data
    
    async def _update_execution_status(
        self, 
        execution_id: str, 
        status: str, 
        error_message: Optional[str] = None
    ):
        """Update execution status"""
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if status == "running":
            update_data["started_at"] = datetime.utcnow()
        elif status in ["completed", "failed", "cancelled"]:
            update_data["completed_at"] = datetime.utcnow()
        
        if error_message:
            update_data["error_message"] = error_message
        
        await self.db.execute(
            update(FlowExecution)
            .where(FlowExecution.id == execution_id)
            .values(**update_data)
        )
        await self.db.commit()
    
    async def _update_component_status(
        self, 
        execution_id: str, 
        component_id: str, 
        status: str, 
        error_message: Optional[str] = None
    ):
        """Update component execution status"""
        update_data = {
            "status": status
        }
        
        if status == "running":
            update_data["started_at"] = datetime.utcnow()
        elif status in ["completed", "failed", "skipped"]:
            update_data["completed_at"] = datetime.utcnow()
        
        if error_message:
            update_data["error_message"] = error_message
        
        await self.db.execute(
            update(ComponentExecution)
            .where(
                ComponentExecution.flow_execution_id == execution_id,
                ComponentExecution.component_id == component_id
            )
            .values(**update_data)
        )
        await self.db.commit()
    
    async def _update_component_execution(
        self, 
        execution_id: str, 
        component_id: str, 
        result: ExecutionResult
    ):
        """Update component execution with result data"""
        update_data = {
            "status": "completed" if result.success else "failed",
            "output_data": result.output_data,
            "execution_time_ms": result.execution_time_ms,
            "completed_at": datetime.utcnow()
        }
        
        if not result.success:
            update_data["error_message"] = result.error_message
            update_data["error_details"] = result.error_details
        
        await self.db.execute(
            update(ComponentExecution)
            .where(
                ComponentExecution.flow_execution_id == execution_id,
                ComponentExecution.component_id == component_id
            )
            .values(**update_data)
        )
        await self.db.commit()
    
    async def _update_execution_progress(
        self, 
        execution_id: str, 
        completed_components: int, 
        total_components: int
    ):
        """Update execution progress"""
        progress = int((completed_components / total_components) * 100)
        
        await self.db.execute(
            update(FlowExecution)
            .where(FlowExecution.id == execution_id)
            .values(
                progress=progress,
                completed_components=completed_components,
                updated_at=datetime.utcnow()
            )
        )
        await self.db.commit()
    
    async def _log_execution(
        self, 
        execution_id: str, 
        level: str, 
        message: str, 
        component_execution_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Add log entry for execution"""
        log_entry = ExecutionLog(
            flow_execution_id=execution_id,
            component_execution_id=component_execution_id,
            level=level,
            message=message,
            details=details
        )
        
        self.db.add(log_entry)
        await self.db.commit()
    
    async def _finalize_execution(self, execution_id: str, user_id: str):
        """Finalize execution and collect final results"""
        # Get all component executions
        result = await self.db.execute(
            select(ComponentExecution)
            .where(ComponentExecution.flow_execution_id == execution_id)
            .order_by(ComponentExecution.execution_order)
        )
        component_executions = result.scalars().all()
        
        # Check if all components completed successfully
        all_successful = all(ce.status == "completed" for ce in component_executions)
        
        if all_successful:
            # Collect final outputs (from output components)
            final_output = {}
            for ce in component_executions:
                if ce.output_data and ce.component_type in ['text_output', 'file_output', 'data_output']:
                    final_output[ce.component_id] = ce.output_data
            
            await self.db.execute(
                update(FlowExecution)
                .where(FlowExecution.id == execution_id)
                .values(
                    status="completed",
                    final_output=final_output,
                    completed_at=datetime.utcnow()
                )
            )
            
            await self._log_execution(execution_id, "info", "Flow execution completed successfully")
            
            # Send WebSocket notification
            await execution_notifier.notify_execution_completed(str(execution_id), final_output, user_id)
        else:
            await self._update_execution_status(execution_id, "failed", "One or more components failed")
            
            # Send WebSocket notification
            await execution_notifier.notify_execution_failed(str(execution_id), "One or more components failed", user_id)
        
        await self.db.commit()


# Simplified execution function for testing
async def execute_flow_simple(flow_data: dict, input_data: dict):
    """Enhanced flow execution with basic flow processing"""
    import time
    import uuid
    start_time = time.time()
    
    try:
        # Basic flow analysis
        nodes = flow_data.get('nodes', []) if isinstance(flow_data, dict) else []
        edges = flow_data.get('edges', []) if isinstance(flow_data, dict) else []
        
        # Simulate processing based on flow structure
        processing_time = len(nodes) * 20  # 20ms per node
        
        # Extract input components
        input_nodes = [node for node in nodes if 'input' in node.get('id', '').lower()]
        output_nodes = [node for node in nodes if 'output' in node.get('id', '').lower()]
        llm_nodes = [node for node in nodes if 'llm' in node.get('id', '').lower()]
        
        # Generate realistic output based on flow structure
        output_data = {
            "message": f"Flow executed successfully with {len(nodes)} components",
            "processed_input": input_data.get('message', 'No message'),
            "session_id": input_data.get('session_id', 'default'),
            "flow_analysis": {
                "input_components": len(input_nodes),
                "llm_components": len(llm_nodes), 
                "output_components": len(output_nodes),
                "total_connections": len(edges)
            }
        }
        
        # Simulate LLM processing if LLM nodes exist
        if llm_nodes and input_data.get('message'):
            output_data["ai_response"] = f"AI processed: {input_data['message']}"
            processing_time += 200  # Additional time for LLM processing
        
        execution_time = int((time.time() - start_time) * 1000) + processing_time
        
        return {
            "execution_id": f"exec_{str(uuid.uuid4())[:8]}",
            "status": "completed",
            "execution_time_ms": execution_time,
            "components": {
                "processed": len(nodes),
                "success": len(nodes),
                "failed": 0
            },
            "output_data": output_data
        }
        
    except Exception as e:
        execution_time = int((time.time() - start_time) * 1000)
        return {
            "execution_id": f"exec_error_{str(uuid.uuid4())[:8]}",
            "status": "failed",
            "execution_time_ms": execution_time,
            "components": {},
            "output_data": {
                "error": f"Flow execution failed: {str(e)}",
                "input_received": input_data
            }
        }

async def get_execution_engine(db: AsyncSession = None):
    """Get execution engine instance with database session"""
    return FlowExecutionEngine(db) if db else None