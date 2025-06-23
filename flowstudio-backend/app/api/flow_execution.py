"""
Flow Execution API
Handles execution of flows with various input types including chat inputs
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional, List
import asyncio
import logging
import time
from pydantic import BaseModel

from ..auth.dependencies import get_current_user
from ..models.flow import Flow
from ..models.execution import FlowExecution, ComponentExecution
from ..services.flow_api_gateway import FlowAPIGateway
from ..services.component_executors import ComponentExecutorFactory, ExecutionContext
from ..db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flows", tags=["flow_execution"])

class FlowExecutionRequest(BaseModel):
    flow_id: str
    input_data: Dict[str, Any]
    execution_mode: Optional[str] = "standard"  # standard, chat, preview
    session_id: Optional[str] = None

class FlowExecutionResponse(BaseModel):
    success: bool
    execution_id: str
    results: Dict[str, Any]
    execution_time_ms: int
    error: Optional[str] = None
    node_results: Optional[Dict[str, Any]] = None

class ChatFlowExecutor:
    """Specialized executor for chat-based flows"""
    
    def __init__(self):
        self.component_factory = ComponentExecutorFactory()
    
    async def execute_flow(
        self, 
        flow_data: Dict[str, Any], 
        input_data: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a flow starting from chat input nodes"""
        
        start_time = time.time()
        node_results = {}
        execution_order = []
        
        try:
            nodes = flow_data.get("nodes", [])
            edges = flow_data.get("edges", [])
            
            # Find chat input nodes
            chat_input_nodes = [
                node for node in nodes 
                if node.get("data", {}).get("template", {}).get("component_type") in ["chat_input", "text_input"]
            ]
            
            if not chat_input_nodes:
                raise ValueError("No chat input nodes found in flow")
            
            # Process input data for chat nodes
            for node in chat_input_nodes:
                node_id = node["id"]
                if node_id in input_data:
                    # Execute the chat input node
                    result = await self._execute_node(node, input_data[node_id], {})
                    node_results[node_id] = result
                    execution_order.append(node_id)
                    
                    logger.info(f"Executed chat input node {node_id}: {result}")
            
            # Build dependency graph
            dependency_graph = self._build_dependency_graph(nodes, edges)
            
            # Execute remaining nodes in topological order
            remaining_nodes = [n for n in nodes if n["id"] not in node_results]
            executed_nodes = set(node_results.keys())
            
            while remaining_nodes:
                # Find nodes whose dependencies are satisfied
                ready_nodes = []
                for node in remaining_nodes:
                    node_id = node["id"]
                    dependencies = dependency_graph.get(node_id, [])
                    
                    if all(dep in executed_nodes for dep in dependencies):
                        ready_nodes.append(node)
                
                if not ready_nodes:
                    # Check for circular dependencies or unresolved dependencies
                    unresolved = [n["id"] for n in remaining_nodes]
                    logger.warning(f"Circular dependency or unresolved dependencies: {unresolved}")
                    break
                
                # Execute ready nodes
                for node in ready_nodes:
                    node_id = node["id"]
                    
                    # Gather input data from connected nodes
                    node_input_data = self._gather_node_inputs(node_id, edges, node_results)
                    
                    # Execute the node
                    try:
                        result = await self._execute_node(node, node_input_data, node_results)
                        node_results[node_id] = result
                        execution_order.append(node_id)
                        executed_nodes.add(node_id)
                        
                        logger.info(f"Executed node {node_id}: {result.get('success', False)}")
                    except Exception as e:
                        logger.error(f"Error executing node {node_id}: {e}")
                        node_results[node_id] = {
                            "success": False,
                            "error": str(e),
                            "output_data": {}
                        }
                        executed_nodes.add(node_id)
                
                # Remove executed nodes from remaining
                remaining_nodes = [n for n in remaining_nodes if n["id"] not in executed_nodes]
            
            # Find final output nodes (nodes that produce the final response)
            output_nodes = self._find_output_nodes(nodes, edges)
            final_result = {}
            
            for output_node_id in output_nodes:
                if output_node_id in node_results:
                    node_result = node_results[output_node_id]
                    if node_result.get("success") and node_result.get("output_data"):
                        final_result.update(node_result["output_data"])
            
            # If no specific output found, try to get response from LLM nodes
            if not final_result.get("response"):
                for node_id, result in node_results.items():
                    if result.get("success") and result.get("output_data", {}).get("response"):
                        final_result["response"] = result["output_data"]["response"]
                        final_result["model_used"] = result["output_data"].get("model_used")
                        final_result["token_usage"] = result["output_data"].get("token_usage")
                        break
            
            execution_time = int((time.time() - start_time) * 1000)
            
            return {
                "success": True,
                "results": final_result,
                "execution_time_ms": execution_time,
                "node_results": node_results,
                "execution_order": execution_order
            }
            
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Flow execution error: {e}")
            return {
                "success": False,
                "results": {},
                "execution_time_ms": execution_time,
                "error": str(e),
                "node_results": node_results
            }
    
    async def _execute_node(
        self, 
        node: Dict[str, Any], 
        input_data: Dict[str, Any], 
        context_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single node"""
        
        node_data = node.get("data", {})
        template = node_data.get("template", {})
        component_type = template.get("component_type")
        
        if not component_type:
            raise ValueError(f"No component type found for node {node['id']}")
        
        try:
            # Get executor for this component type
            executor = self.component_factory.get_executor(component_type)
            
            # Create execution context
            context = ExecutionContext(
                component_id=node["id"],
                component_type=component_type,
                config_data=node_data.get("input_values", {}),
                input_data=input_data,
                execution_id=f"exec_{int(time.time())}",
                db=None  # We'll handle DB operations at a higher level
            )
            
            # Execute the component
            result = await executor.execute(context)
            
            return {
                "success": result.success,
                "output_data": result.output_data,
                "execution_time_ms": result.execution_time_ms,
                "error": result.error_message if not result.success else None
            }
            
        except Exception as e:
            logger.error(f"Error executing node {node['id']}: {e}")
            return {
                "success": False,
                "output_data": {},
                "error": str(e)
            }
    
    def _build_dependency_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, List[str]]:
        """Build a dependency graph from edges"""
        dependencies = {}
        
        for node in nodes:
            dependencies[node["id"]] = []
        
        for edge in edges:
            target = edge["target"]
            source = edge["source"]
            
            if target not in dependencies:
                dependencies[target] = []
            
            dependencies[target].append(source)
        
        return dependencies
    
    def _gather_node_inputs(
        self, 
        node_id: str, 
        edges: List[Dict], 
        node_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Gather input data for a node from connected nodes"""
        
        input_data = {}
        
        # Find edges that connect to this node
        incoming_edges = [edge for edge in edges if edge["target"] == node_id]
        
        for edge in incoming_edges:
            source_node_id = edge["source"]
            source_handle = edge.get("sourceHandle", "output")
            target_handle = edge.get("targetHandle", "input")
            
            if source_node_id in node_results:
                source_result = node_results[source_node_id]
                if source_result.get("success") and source_result.get("output_data"):
                    source_output = source_result["output_data"]
                    
                    # Map the output data to the target input
                    if isinstance(source_output, dict):
                        # If specific handle is mentioned, use that field
                        if source_handle in source_output:
                            input_data[target_handle] = source_output[source_handle]
                        else:
                            # Otherwise, merge all output data
                            input_data.update(source_output)
                    else:
                        input_data[target_handle] = source_output
        
        return input_data
    
    def _find_output_nodes(self, nodes: List[Dict], edges: List[Dict]) -> List[str]:
        """Find nodes that don't have outgoing edges (final output nodes)"""
        
        nodes_with_outgoing = set()
        for edge in edges:
            nodes_with_outgoing.add(edge["source"])
        
        all_node_ids = {node["id"] for node in nodes}
        output_nodes = list(all_node_ids - nodes_with_outgoing)
        
        return output_nodes

@router.post("/execute", response_model=FlowExecutionResponse)
async def execute_flow(
    request: FlowExecutionRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Execute a flow with given input data"""
    
    try:
        # Load flow data
        flow = await Flow.get_by_id(db, request.flow_id)
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        # Check permissions
        if flow.owner_id != current_user.id and not flow.is_public:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Parse flow data
        flow_data = flow.flow_data
        if not flow_data:
            raise HTTPException(status_code=400, detail="Flow has no data")
        
        # Execute based on mode
        if request.execution_mode == "chat":
            executor = ChatFlowExecutor()
            result = await executor.execute_flow(
                flow_data, 
                request.input_data, 
                request.session_id
            )
        else:
            # Standard execution mode
            gateway = FlowAPIGateway()
            result = await gateway.execute_flow(
                flow_data,
                request.input_data
            )
        
        # Create execution record
        execution = Execution(
            flow_id=request.flow_id,
            user_id=current_user.id,
            input_data=request.input_data,
            status="completed" if result["success"] else "failed",
            execution_time_ms=result["execution_time_ms"],
            error_message=result.get("error")
        )
        await execution.save(db)
        
        return FlowExecutionResponse(
            success=result["success"],
            execution_id=str(execution.id),
            results=result["results"],
            execution_time_ms=result["execution_time_ms"],
            error=result.get("error"),
            node_results=result.get("node_results")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Flow execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")

@router.get("/{flow_id}/data")
async def get_flow_data(
    flow_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get flow data for execution"""
    
    try:
        flow = await Flow.get_by_id(db, flow_id)
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        # Check permissions
        if flow.owner_id != current_user.id and not flow.is_public:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "id": flow.id,
            "name": flow.name,
            "description": flow.description,
            "flow_data": flow.flow_data,
            "is_public": flow.is_public,
            "owner_id": flow.owner_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting flow data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get flow data: {str(e)}")

@router.get("")
async def list_flows(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """List available flows for the user"""
    
    try:
        # Get user's flows and public flows
        flows = await Flow.get_user_flows(db, current_user.id)
        
        return [
            {
                "id": flow.id,
                "name": flow.name,
                "description": flow.description,
                "flow_data": flow.flow_data,
                "is_public": flow.is_public,
                "owner_id": flow.owner_id,
                "created_at": flow.created_at,
                "updated_at": flow.updated_at
            }
            for flow in flows
        ]
        
    except Exception as e:
        logger.error(f"Error listing flows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list flows: {str(e)}") 