"""
FlowStudio Execution Models
Defines models for flow execution tracking and result management
"""
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from ..db.database import Base


class FlowExecution(Base):
    """
    Model for tracking flow execution instances
    """
    __tablename__ = "flow_studio_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    flow_id = Column(UUID(as_uuid=True), ForeignKey("flows.id"), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)  # External user ID
    
    # Execution metadata
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, running, completed, failed, cancelled
    progress = Column(Integer, default=0)  # 0-100 percentage
    total_components = Column(Integer, default=0)
    completed_components = Column(Integer, default=0)
    
    # Execution configuration
    execution_config = Column(JSON, nullable=True)  # Runtime configuration
    flow_snapshot = Column(JSON, nullable=False)  # Snapshot of flow at execution time
    
    # Timing information
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Error information
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)
    
    # Results
    final_output = Column(JSON, nullable=True)
    execution_metrics = Column(JSON, nullable=True)  # Performance metrics, costs, etc.
    
    # Relationships
    flow = relationship("Flow", back_populates="executions")
    component_executions = relationship("ComponentExecution", back_populates="flow_execution", cascade="all, delete-orphan")
    execution_logs = relationship("ExecutionLog", back_populates="flow_execution", cascade="all, delete-orphan")


class ComponentExecution(Base):
    """
    Model for tracking individual component execution within a flow
    """
    __tablename__ = "flow_studio_component_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    flow_execution_id = Column(UUID(as_uuid=True), ForeignKey("flow_studio_executions.id"), nullable=False, index=True)
    component_id = Column(String(255), nullable=False, index=True)  # Component ID from flow
    component_type = Column(String(100), nullable=False, index=True)
    
    # Execution state
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, running, completed, failed, skipped
    execution_order = Column(Integer, nullable=False, index=True)  # Order in execution sequence
    
    # Component data
    input_data = Column(JSON, nullable=True)  # Input data for this component
    output_data = Column(JSON, nullable=True)  # Output data from this component
    config_data = Column(JSON, nullable=True)  # Component configuration at execution time
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)
    retry_count = Column(Integer, default=0)
    
    # Execution metrics
    execution_time_ms = Column(Integer, nullable=True)
    memory_usage_mb = Column(Integer, nullable=True)
    cost_estimate = Column(JSON, nullable=True)  # For LLM calls, API costs, etc.
    
    # Relationships
    flow_execution = relationship("FlowExecution", back_populates="component_executions")


class ExecutionLog(Base):
    """
    Model for storing detailed execution logs
    """
    __tablename__ = "flow_studio_execution_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    flow_execution_id = Column(UUID(as_uuid=True), ForeignKey("flow_studio_executions.id"), nullable=False, index=True)
    component_execution_id = Column(UUID(as_uuid=True), ForeignKey("flow_studio_component_executions.id"), nullable=True, index=True)
    
    # Log details
    level = Column(String(20), nullable=False, index=True)  # debug, info, warning, error
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)  # Additional structured data
    
    # Context
    source = Column(String(100), nullable=True)  # Component type, system, etc.
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    flow_execution = relationship("FlowExecution", back_populates="execution_logs")


# Add relationship to existing Flow model
def add_execution_relationship():
    """
    Function to add execution relationship to existing Flow model
    This should be called after Flow model is imported
    """
    try:
        from .flow import Flow
        if not hasattr(Flow, 'executions'):
            Flow.executions = relationship("FlowExecution", back_populates="flow", cascade="all, delete-orphan")
    except ImportError:
        pass  # Flow model not available yet