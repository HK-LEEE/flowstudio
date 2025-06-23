"""
FlowStudio Execution API Endpoints
Handles flow execution requests, monitoring, and result retrieval
"""
from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from ..db.database import get_db
from ..api.deps_external_auth import get_current_user_external, UserContext
from ..models.execution import FlowExecution, ComponentExecution, ExecutionLog
from ..services.flow_execution_engine import FlowExecutionEngine

router = APIRouter()


# Pydantic models for request/response
class ExecutionRequest(BaseModel):
    flow_id: str
    execution_config: Optional[Dict[str, Any]] = None


class ExecutionResponse(BaseModel):
    execution_id: str
    status: str
    progress: int
    message: str


class ExecutionStatusResponse(BaseModel):
    execution_id: str
    flow_id: str
    status: str
    progress: int
    total_components: int
    completed_components: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    final_output: Optional[Dict[str, Any]] = None


class ComponentExecutionResponse(BaseModel):
    component_id: str
    component_type: str
    status: str
    execution_order: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    output_data: Optional[Dict[str, Any]] = None


class ExecutionLogResponse(BaseModel):
    id: str
    level: str
    message: str
    timestamp: str
    component_execution_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


@router.post("/flows/{flow_id}/execute", response_model=ExecutionResponse)
async def execute_flow(
    flow_id: str,
    request: ExecutionRequest,
    background_tasks: BackgroundTasks,
    current_user: UserContext = Depends(get_current_user_external),
    db: AsyncSession = Depends(get_db)
):
    """
    Start execution of a flow
    """
    try:
        # Validate flow_id matches request
        if flow_id != request.flow_id:
            raise HTTPException(
                status_code=400,
                detail="Flow ID in URL does not match request body"
            )
        
        # Create execution engine
        engine = FlowExecutionEngine(db)
        
        # Start execution in background
        execution = await engine.execute_flow(
            flow_id=flow_id,
            user_id=current_user.id,
            execution_config=request.execution_config
        )
        
        return ExecutionResponse(
            execution_id=str(execution.id),
            status=execution.status,
            progress=execution.progress,
            message="Flow execution started successfully"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start execution: {str(e)}")


@router.get("/executions/{execution_id}/status", response_model=ExecutionStatusResponse)
async def get_execution_status(
    execution_id: str,
    current_user: UserContext = Depends(get_current_user_external),
    db: AsyncSession = Depends(get_db)
):
    """
    Get execution status and progress
    """
    try:
        # Get execution record
        result = await db.execute(
            select(FlowExecution)
            .where(
                FlowExecution.id == execution_id,
                FlowExecution.user_id == current_user.id
            )
        )
        execution = result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        return ExecutionStatusResponse(
            execution_id=str(execution.id),
            flow_id=str(execution.flow_id),
            status=execution.status,
            progress=execution.progress,
            total_components=execution.total_components,
            completed_components=execution.completed_components,
            started_at=execution.started_at.isoformat() if execution.started_at else None,
            completed_at=execution.completed_at.isoformat() if execution.completed_at else None,
            error_message=execution.error_message,
            final_output=execution.final_output
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution status: {str(e)}")


@router.get("/executions/{execution_id}/components", response_model=List[ComponentExecutionResponse])
async def get_component_executions(
    execution_id: str,
    current_user: UserContext = Depends(get_current_user_external),
    db: AsyncSession = Depends(get_db)
):
    """
    Get component execution details for a flow execution
    """
    try:
        # Verify execution belongs to user
        result = await db.execute(
            select(FlowExecution)
            .where(
                FlowExecution.id == execution_id,
                FlowExecution.user_id == current_user.id
            )
        )
        execution = result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get component executions
        result = await db.execute(
            select(ComponentExecution)
            .where(ComponentExecution.flow_execution_id == execution_id)
            .order_by(ComponentExecution.execution_order)
        )
        component_executions = result.scalars().all()
        
        return [
            ComponentExecutionResponse(
                component_id=ce.component_id,
                component_type=ce.component_type,
                status=ce.status,
                execution_order=ce.execution_order,
                started_at=ce.started_at.isoformat() if ce.started_at else None,
                completed_at=ce.completed_at.isoformat() if ce.completed_at else None,
                execution_time_ms=ce.execution_time_ms,
                error_message=ce.error_message,
                output_data=ce.output_data
            )
            for ce in component_executions
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get component executions: {str(e)}")


@router.get("/executions/{execution_id}/logs", response_model=List[ExecutionLogResponse])
async def get_execution_logs(
    execution_id: str,
    level: Optional[str] = Query(None, description="Filter by log level"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of logs to return"),
    current_user: UserContext = Depends(get_current_user_external),
    db: AsyncSession = Depends(get_db)
):
    """
    Get execution logs
    """
    try:
        # Verify execution belongs to user
        result = await db.execute(
            select(FlowExecution)
            .where(
                FlowExecution.id == execution_id,
                FlowExecution.user_id == current_user.id
            )
        )
        execution = result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Build query for logs
        query = select(ExecutionLog).where(ExecutionLog.flow_execution_id == execution_id)
        
        if level:
            query = query.where(ExecutionLog.level == level)
        
        query = query.order_by(desc(ExecutionLog.timestamp)).limit(limit)
        
        result = await db.execute(query)
        logs = result.scalars().all()
        
        return [
            ExecutionLogResponse(
                id=str(log.id),
                level=log.level,
                message=log.message,
                timestamp=log.timestamp.isoformat(),
                component_execution_id=str(log.component_execution_id) if log.component_execution_id else None,
                details=log.details
            )
            for log in logs
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution logs: {str(e)}")


@router.get("/flows/{flow_id}/executions", response_model=List[ExecutionStatusResponse])
async def get_flow_executions(
    flow_id: str,
    limit: int = Query(10, ge=1, le=100, description="Maximum number of executions to return"),
    current_user: UserContext = Depends(get_current_user_external),
    db: AsyncSession = Depends(get_db)
):
    """
    Get execution history for a flow
    """
    try:
        result = await db.execute(
            select(FlowExecution)
            .where(
                FlowExecution.flow_id == flow_id,
                FlowExecution.user_id == current_user.id
            )
            .order_by(desc(FlowExecution.created_at))
            .limit(limit)
        )
        executions = result.scalars().all()
        
        return [
            ExecutionStatusResponse(
                execution_id=str(execution.id),
                flow_id=str(execution.flow_id),
                status=execution.status,
                progress=execution.progress,
                total_components=execution.total_components,
                completed_components=execution.completed_components,
                started_at=execution.started_at.isoformat() if execution.started_at else None,
                completed_at=execution.completed_at.isoformat() if execution.completed_at else None,
                error_message=execution.error_message,
                final_output=execution.final_output
            )
            for execution in executions
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get flow executions: {str(e)}")


@router.delete("/executions/{execution_id}")
async def cancel_execution(
    execution_id: str,
    current_user: UserContext = Depends(get_current_user_external),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel a running execution
    """
    try:
        # Get execution record
        result = await db.execute(
            select(FlowExecution)
            .where(
                FlowExecution.id == execution_id,
                FlowExecution.user_id == current_user.id
            )
        )
        execution = result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        if execution.status not in ["pending", "running"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel execution with status: {execution.status}"
            )
        
        # Update status to cancelled
        execution.status = "cancelled"
        execution.completed_at = execution.updated_at
        await db.commit()
        
        return {"message": "Execution cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel execution: {str(e)}")


@router.get("/executions/{execution_id}/results")
async def get_execution_results(
    execution_id: str,
    current_user: UserContext = Depends(get_current_user_external),
    db: AsyncSession = Depends(get_db)
):
    """
    Get final results from a completed execution
    """
    try:
        # Get execution record
        result = await db.execute(
            select(FlowExecution)
            .where(
                FlowExecution.id == execution_id,
                FlowExecution.user_id == current_user.id
            )
        )
        execution = result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        if execution.status != "completed":
            raise HTTPException(
                status_code=400,
                detail=f"Execution not completed (status: {execution.status})"
            )
        
        return {
            "execution_id": str(execution.id),
            "flow_id": str(execution.flow_id),
            "status": execution.status,
            "final_output": execution.final_output,
            "execution_metrics": execution.execution_metrics,
            "completed_at": execution.completed_at.isoformat() if execution.completed_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution results: {str(e)}")