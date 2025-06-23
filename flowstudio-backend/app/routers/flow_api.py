"""
Flow API Router
Handles published flow API endpoints and execution requests
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
import json

from ..db.database import get_db
from ..services.flow_api_gateway import get_flow_api_gateway, FlowAPIGateway
from ..services.flow_execution_engine import get_execution_engine, execute_flow_simple
from ..models.flow import Flow
from ..core.auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/api/flow-api", tags=["Flow API"])

@router.post("/publish/{flow_id}")
async def publish_flow(
    flow_id: str,
    publish_config: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Publish a flow as an API endpoint
    
    Body:
    {
        "version": "1.0.0",
        "is_public": false,
        "rate_limit": 100,
        "max_instances": 3,
        "description": "API description"
    }
    """
    gateway = await get_flow_api_gateway(db)
    
    version = publish_config.get('version', '1.0.0')
    
    # Publish the flow
    endpoint = await gateway.publish_flow(flow_id, version, publish_config)
    
    return {
        "success": True,
        "message": "Flow published successfully",
        "endpoint": endpoint,
        "flow_id": flow_id,
        "version": version,
        "published_at": "now"
    }

@router.delete("/unpublish/{flow_id}")
async def unpublish_flow(
    flow_id: str,
    version: str = "1.0.0",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unpublish a flow API"""
    gateway = await get_flow_api_gateway(db)
    
    await gateway.unpublish_flow(flow_id, version)
    
    return {
        "success": True,
        "message": "Flow unpublished successfully",
        "flow_id": flow_id,
        "version": version
    }

@router.get("/published")
async def list_published_flows(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all published flows"""
    gateway = await get_flow_api_gateway(db)
    
    published_flows = gateway.list_published_flows()
    
    return {
        "success": True,
        "flows": published_flows,
        "count": len(published_flows)
    }

@router.get("/status/{flow_id}")
async def get_flow_api_status(
    flow_id: str,
    version: str = "1.0.0",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get status of a published flow API"""
    gateway = await get_flow_api_gateway(db)
    
    status = gateway.get_flow_status(flow_id, version)
    
    return {
        "success": True,
        "status": status
    }

@router.post("/flows/{flow_id}/v{version}/execute")
async def execute_published_flow(
    flow_id: str,
    version: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Execute a published flow
    This is the main API endpoint for published flows
    """
    try:
        # Get input data from request using safe parsing
        input_data = {}
        try:
            # Use request.json() but with better error handling
            raw_body = await request.body()
            if raw_body:
                body_str = raw_body.decode('utf-8')
                # Clean any problematic characters
                import re
                clean_body = re.sub(r'\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})', r'\\\\', body_str)
                input_data = json.loads(clean_body)
        except Exception as e:
            logging.warning(f"Failed to parse request JSON: {e}")
            input_data = {"error": "Could not parse input"}
        
        # Get flow data from database
        from sqlalchemy import select
        result = await db.execute(select(Flow).where(Flow.id == flow_id))
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
            
        if not flow.is_published:
            raise HTTPException(status_code=403, detail="Flow is not published")
        
        # Execute flow using simplified execution engine
        execution_result = await execute_flow_simple(flow.flow_data, input_data)
        
        # Return comprehensive execution result
        return {
            "success": True,
            "flow_id": flow_id,
            "version": version,
            "flow_name": flow.name,
            "execution_id": execution_result.get("execution_id"),
            "status": execution_result.get("status"),
            "execution_time_ms": execution_result.get("execution_time_ms"),
            "input_data": input_data,
            "output": execution_result.get("output_data", {}),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")

@router.get("/flows/{flow_id}/v{version}/info")
async def get_flow_api_info(
    flow_id: str,
    version: str,
    db: AsyncSession = Depends(get_db)
):
    """Get information about a published flow API"""
    endpoint = f"/api/flows/{flow_id}/v{version}/execute"
    
    gateway = await get_flow_api_gateway(db)
    
    if endpoint not in gateway.published_flows:
        raise HTTPException(status_code=404, detail="Flow API not found")
        
    config = gateway.published_flows[endpoint]
    status = gateway.get_flow_status(flow_id, version)
    
    return {
        "success": True,
        "flow_info": {
            "flow_id": config.flow_id,
            "version": config.flow_version,
            "name": config.flow_name,
            "endpoint": config.api_endpoint,
            "is_public": config.is_public,
            "rate_limit": config.rate_limit,
            "max_instances": config.max_instances,
            "components_count": len(config.flow_data.get('nodes', [])),
            "connections_count": len(config.flow_data.get('edges', [])),
            "status": status.get('status', 'unknown')
        }
    }

# Direct execution endpoint for testing
@router.post("/test-execute")
async def test_execute_flow(
    request_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Test execute a flow directly (for development/testing)
    
    Body:
    {
        "flow_data": {...},  // Flow definition
        "input_data": {...}  // Input data
    }
    """
    flow_data = request_data.get('flow_data')
    input_data = request_data.get('input_data', {})
    
    if not flow_data:
        raise HTTPException(status_code=400, detail="flow_data is required")
    
    # Execute flow directly using simplified function
    execution = await execute_flow_simple(flow_data, input_data)
    
    # Extract outputs from simplified execution result
    outputs = execution.get("output_data", {})
    
    return {
        "success": True,
        "execution_id": execution.get("execution_id"),
        "status": execution.get("status"),
        "execution_time_ms": execution.get("execution_time_ms"),
        "outputs": outputs,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/processes")
async def list_flow_processes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all running flow processes"""
    gateway = await get_flow_api_gateway(db)
    
    processes = []
    for process_key, flow_process in gateway.process_manager.processes.items():
        processes.append({
            "process_key": process_key,
            "flow_id": flow_process.flow_id,
            "version": flow_process.flow_version,
            "port": flow_process.port,
            "process_id": flow_process.process_id,
            "status": flow_process.status,
            "start_time": flow_process.start_time.isoformat(),
            "last_request_time": flow_process.last_request_time.isoformat(),
            "request_count": flow_process.request_count
        })
    
    return {
        "success": True,
        "processes": processes,
        "count": len(processes),
        "available_ports": len(gateway.process_manager.port_pool),
        "used_ports": len(gateway.process_manager.used_ports)
    }

@router.post("/cleanup")
async def cleanup_idle_processes(
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually trigger cleanup of idle processes"""
    gateway = await get_flow_api_gateway(db)
    
    initial_count = len(gateway.process_manager.processes)
    await gateway.process_manager._cleanup_idle_processes(force=force)
    final_count = len(gateway.process_manager.processes)
    
    cleaned_up = initial_count - final_count
    
    return {
        "success": True,
        "message": f"Cleaned up {cleaned_up} processes",
        "initial_processes": initial_count,
        "remaining_processes": final_count,
        "cleaned_up": cleaned_up
    }