"""
FlowStudio Flow Component model
Represents component instances within a specific flow
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..db.database import Base

class FlowComponent(Base):
    """Flow component model representing component instances in flows"""
    __tablename__ = "flow_studio_components"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        index=True
    )
    
    # Flow relationship
    flow_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("flows.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Template relationship
    template_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("flow_studio_component_templates.id"),
        nullable=False,
        index=True
    )
    
    # Component instance data
    component_key = Column(String(100), nullable=False)  # Unique within flow
    display_name = Column(String(200), nullable=True)   # Custom name for this instance
    
    # Position and visual properties
    position_x = Column(Float, default=0, nullable=False)
    position_y = Column(Float, default=0, nullable=False)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    
    # Component configuration
    config_data = Column(JSON, nullable=False, default=dict)
    input_values = Column(JSON, nullable=False, default=dict)
    
    # Component state
    is_active = Column(Boolean, default=True, nullable=False)
    is_selected = Column(Boolean, default=False, nullable=False)
    
    # Execution metadata
    last_execution_status = Column(String(20), nullable=True)  # success, error, running
    last_execution_output = Column(JSON, nullable=True)
    last_execution_error = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    # Relationships
    template = relationship("ComponentTemplate", lazy="select")
    
    def __repr__(self):
        return f"<FlowComponent(id={self.id}, key={self.component_key}, flow_id={self.flow_id})>"
    
    def to_dict(self):
        """Convert flow component to dictionary"""
        return {
            "id": str(self.id),
            "flow_id": str(self.flow_id),
            "template_id": str(self.template_id),
            "component_key": self.component_key,
            "display_name": self.display_name,
            "position_x": self.position_x,
            "position_y": self.position_y,
            "width": self.width,
            "height": self.height,
            "config_data": self.config_data,
            "input_values": self.input_values,
            "is_active": self.is_active,
            "is_selected": self.is_selected,
            "last_execution_status": self.last_execution_status,
            "last_execution_output": self.last_execution_output,
            "last_execution_error": self.last_execution_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }