"""
Flow model for FlowStudio
Represents visual flow designs created by users
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..db.database import Base

class Flow(Base):
    """Flow model representing a visual flow design"""
    __tablename__ = "flows"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        index=True
    )
    
    # Basic flow information
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Flow data (JSON structure for React Flow)
    flow_data = Column(JSON, nullable=True)
    
    # Flow metadata
    version = Column(String(20), default="1.0.0", nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    
    # User relationship
    owner_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
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
    
    def __repr__(self):
        return f"<Flow(id={self.id}, name={self.name}, owner_id={self.owner_id})>"
    
    def to_dict(self):
        """Convert flow to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "flow_data": self.flow_data,
            "version": self.version,
            "is_public": self.is_public,
            "is_active": self.is_active,
            "is_published": self.is_published,
            "owner_id": str(self.owner_id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }