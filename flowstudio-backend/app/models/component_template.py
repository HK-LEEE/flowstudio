"""
FlowStudio Component Template model
Represents reusable component definitions with MCP compatibility
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from ..db.database import Base

class ComponentTemplate(Base):
    """Component template model for FlowStudio components"""
    __tablename__ = "flow_studio_component_templates"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        index=True
    )
    
    # Component identification
    component_type = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    display_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, index=True)
    
    # Visual properties
    icon = Column(String(200), nullable=True)  # Icon name or URL
    color = Column(String(20), default="#4A90E2", nullable=False)
    
    # Component schemas (MCP compatible)
    input_schema = Column(JSON, nullable=False, default=dict)
    output_schema = Column(JSON, nullable=False, default=dict)
    
    # Execution code
    python_code = Column(Text, nullable=True)
    
    # MCP integration fields
    mcp_tool_schema = Column(JSON, nullable=True)
    mcp_resource_uri = Column(String(512), nullable=True)
    transport_type = Column(String(50), default='stdio', nullable=False)
    
    # Component metadata
    version = Column(String(20), default="1.0.0", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_beta = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    
    # Documentation
    documentation = Column(Text, nullable=True)
    examples = Column(JSON, nullable=True)
    
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
        return f"<ComponentTemplate(id={self.id}, type={self.component_type}, name={self.name})>"
    
    def to_dict(self):
        """Convert component template to dictionary"""
        return {
            "id": str(self.id),
            "component_type": self.component_type,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "category": self.category,
            "icon": self.icon,
            "color": self.color,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
            "python_code": self.python_code,
            "mcp_tool_schema": self.mcp_tool_schema,
            "mcp_resource_uri": self.mcp_resource_uri,
            "transport_type": self.transport_type,
            "version": self.version,
            "is_active": self.is_active,
            "is_beta": self.is_beta,
            "sort_order": self.sort_order,
            "documentation": self.documentation,
            "examples": self.examples,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }