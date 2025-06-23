"""
FlowStudio Flow Connection model
Represents connections (edges) between components in a flow
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..db.database import Base

class FlowConnection(Base):
    """Flow connection model representing edges between components"""
    __tablename__ = "flow_studio_connections"
    
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
    
    # Source component connection
    source_component_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("flow_studio_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    source_handle = Column(String(100), nullable=False)  # Output port name
    
    # Target component connection
    target_component_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("flow_studio_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    target_handle = Column(String(100), nullable=False)  # Input port name
    
    # Connection metadata
    connection_key = Column(String(200), nullable=False)  # Unique within flow
    label = Column(String(200), nullable=True)  # Display label for the edge
    
    # Connection properties
    is_active = Column(Boolean, default=True, nullable=False)
    connection_type = Column(String(50), default="default", nullable=False)
    
    # Visual properties
    style_data = Column(JSON, nullable=True)  # Edge styling information
    
    # Data flow metadata
    data_type = Column(String(50), nullable=True)  # Type of data flowing through
    last_data_sample = Column(JSON, nullable=True)  # Sample of last data passed
    
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
    source_component = relationship("FlowComponent", foreign_keys=[source_component_id], lazy="select")
    target_component = relationship("FlowComponent", foreign_keys=[target_component_id], lazy="select")
    
    def __repr__(self):
        return f"<FlowConnection(id={self.id}, {self.source_handle} -> {self.target_handle})>"
    
    def to_dict(self):
        """Convert flow connection to dictionary"""
        return {
            "id": str(self.id),
            "flow_id": str(self.flow_id),
            "source_component_id": str(self.source_component_id),
            "source_handle": self.source_handle,
            "target_component_id": str(self.target_component_id),
            "target_handle": self.target_handle,
            "connection_key": self.connection_key,
            "label": self.label,
            "is_active": self.is_active,
            "connection_type": self.connection_type,
            "style_data": self.style_data,
            "data_type": self.data_type,
            "last_data_sample": self.last_data_sample,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }