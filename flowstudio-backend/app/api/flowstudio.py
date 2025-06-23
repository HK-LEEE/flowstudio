"""
FlowStudio API endpoints
Handles flow management, component templates, and flow execution
"""
import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from datetime import datetime

from ..db.database import get_db
from ..api.deps_external_auth import get_current_user_external as get_current_user, UserContext
from ..models import ComponentTemplate, Flow, FlowComponent, FlowConnection
from . import execution, websocket

logger = logging.getLogger(__name__)
router = APIRouter()

# Include execution router
router.include_router(execution.router, prefix="", tags=["Execution"])

# Include WebSocket router
router.include_router(websocket.router, prefix="", tags=["WebSocket"])

# Pydantic schemas for requests/responses
class ComponentTemplateResponse(BaseModel):
    id: str
    component_type: str
    name: str
    display_name: str
    description: str | None
    category: str
    icon: str | None
    color: str
    input_schema: dict
    output_schema: dict
    version: str
    is_active: bool
    is_beta: bool
    sort_order: int
    documentation: str | None
    examples: dict | None

class FlowDataResponse(BaseModel):
    id: str
    name: str
    description: str | None
    flow_data: dict | None
    components: List[dict]
    connections: List[dict]
    version: str
    is_public: bool
    is_active: bool
    owner_id: str

class FlowResponse(BaseModel):
    id: str
    name: str
    description: str | None
    version: str
    is_public: bool
    is_active: bool
    is_published: bool
    owner_id: str
    created_at: str
    updated_at: str

class FlowCreateRequest(BaseModel):
    name: str
    description: str | None = None
    flow_data: dict | None = None
    is_public: bool = False

class FlowUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    flow_data: dict | None = None
    is_public: bool | None = None
    is_active: bool | None = None

class FlowPublishRequest(BaseModel):
    version: str | None = None
    is_public: bool | None = None

@router.get("/component_templates_debug", response_model=List[ComponentTemplateResponse], tags=["FlowStudio"])
async def get_component_templates_debug(
    category: Optional[str] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint without authentication"""
    logger.info("Debug endpoint called - bypassing auth")
    try:
        # Build query
        query = select(ComponentTemplate).where(ComponentTemplate.is_active == is_active)
        
        if category:
            query = query.where(ComponentTemplate.category == category)
        
        # Order by category and sort order
        query = query.order_by(
            ComponentTemplate.category,
            ComponentTemplate.sort_order,
            ComponentTemplate.display_name
        )
        
        result = await db.execute(query)
        templates = result.scalars().all()
        
        logger.info(f"Found {len(templates)} component templates")
        
        return [
            ComponentTemplateResponse(
                id=str(template.id),
                component_type=template.component_type,
                name=template.name,
                display_name=template.display_name,
                description=template.description,
                category=template.category,
                icon=template.icon,
                color=template.color,
                input_schema=template.input_schema,
                output_schema=template.output_schema,
                version=template.version,
                is_active=template.is_active,
                is_beta=template.is_beta,
                sort_order=template.sort_order,
                documentation=template.documentation,
                examples=template.examples
            )
            for template in templates
        ]
        
    except Exception as e:
        logger.error(f"Error fetching component templates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch component templates"
        )

@router.get("/component_templates", response_model=List[ComponentTemplateResponse], tags=["FlowStudio"])
async def get_component_templates(
    category: Optional[str] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_db)
    # Temporarily disable auth for debugging: current_user: UserContext = Depends(get_current_user)
):
    """
    Get all available component templates
    
    Provides the data source for the UI left-side component library
    """
    logger.info("Fetching component templates (auth temporarily disabled)")
    
    try:
        # Build query
        query = select(ComponentTemplate).where(ComponentTemplate.is_active == is_active)
        
        if category:
            query = query.where(ComponentTemplate.category == category)
        
        # Order by category and sort order
        query = query.order_by(
            ComponentTemplate.category,
            ComponentTemplate.sort_order,
            ComponentTemplate.display_name
        )
        
        result = await db.execute(query)
        templates = result.scalars().all()
        
        logger.info(f"Found {len(templates)} component templates")
        
        return [
            ComponentTemplateResponse(
                id=str(template.id),
                component_type=template.component_type,
                name=template.name,
                display_name=template.display_name,
                description=template.description,
                category=template.category,
                icon=template.icon,
                color=template.color,
                input_schema=template.input_schema,
                output_schema=template.output_schema,
                version=template.version,
                is_active=template.is_active,
                is_beta=template.is_beta,
                sort_order=template.sort_order,
                documentation=template.documentation,
                examples=template.examples
            )
            for template in templates
        ]
        
    except Exception as e:
        logger.error(f"Error fetching component templates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch component templates"
        )

@router.get("/flows/{flow_id}/data", response_model=FlowDataResponse, tags=["FlowStudio"])
async def get_flow_data(
    flow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """
    Get detailed data for a specific flow
    
    Returns flow information along with all components and connections
    """
    logger.info(f"Fetching flow data for flow_id: {flow_id}, user: {current_user.email}")
    
    try:
        # Get flow
        flow_query = select(Flow).where(Flow.id == flow_id)
        flow_result = await db.execute(flow_query)
        flow = flow_result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow not found"
            )
        
        # Check ownership or public access
        if flow.owner_id != current_user.id and not flow.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this flow"
            )
        
        # Get components
        components_query = select(FlowComponent).where(FlowComponent.flow_id == flow_id)
        components_result = await db.execute(components_query)
        components = components_result.scalars().all()
        
        # Get connections
        connections_query = select(FlowConnection).where(FlowConnection.flow_id == flow_id)
        connections_result = await db.execute(connections_query)
        connections = connections_result.scalars().all()
        
        logger.info(f"Found flow with {len(components)} components and {len(connections)} connections")
        
        return FlowDataResponse(
            id=str(flow.id),
            name=flow.name,
            description=flow.description,
            flow_data=flow.flow_data,
            components=[component.to_dict() for component in components],
            connections=[connection.to_dict() for connection in connections],
            version=flow.version,
            is_public=flow.is_public,
            is_active=flow.is_active,
            owner_id=str(flow.owner_id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching flow data for {flow_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch flow data"
        )

@router.get("/categories", tags=["FlowStudio"])
async def get_component_categories(
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """
    Get all available component categories
    
    Used for organizing the component library UI
    """
    logger.info(f"Fetching component categories for user: {current_user.email}")
    
    try:
        # Get distinct categories
        query = select(ComponentTemplate.category).distinct().where(ComponentTemplate.is_active == True)
        result = await db.execute(query)
        categories = [row[0] for row in result.fetchall()]
        
        logger.info(f"Found {len(categories)} categories")
        
        return {
            "categories": sorted(categories),
            "total": len(categories)
        }
        
    except Exception as e:
        logger.error(f"Error fetching categories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch categories"
        )

# Flow CRUD Operations

@router.get("/flows", response_model=List[FlowResponse], tags=["Flows"])
async def get_flows(
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Get all flows for the current user"""
    logger.info(f"Fetching flows for user: {current_user.email}")
    
    try:
        query = select(Flow).where(Flow.owner_id == current_user.id, Flow.is_active == True)
        query = query.order_by(Flow.updated_at.desc())
        
        result = await db.execute(query)
        flows = result.scalars().all()
        
        logger.info(f"Found {len(flows)} flows for user")
        
        return [
            FlowResponse(
                id=str(flow.id),
                name=flow.name,
                description=flow.description,
                version=flow.version,
                is_public=flow.is_public,
                is_active=flow.is_active,
                is_published=flow.is_published,
                owner_id=str(flow.owner_id),
                created_at=flow.created_at.isoformat(),
                updated_at=flow.updated_at.isoformat()
            )
            for flow in flows
        ]
        
    except Exception as e:
        logger.error(f"Error fetching flows: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch flows"
        )

@router.post("/flows", response_model=FlowResponse, tags=["Flows"])
async def create_flow(
    flow_data: FlowCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Create a new flow"""
    logger.info(f"Creating new flow '{flow_data.name}' for user: {current_user.email}")
    
    try:
        new_flow = Flow(
            name=flow_data.name,
            description=flow_data.description,
            flow_data=flow_data.flow_data,
            is_public=flow_data.is_public,
            owner_id=current_user.id
        )
        
        db.add(new_flow)
        await db.commit()
        await db.refresh(new_flow)
        
        logger.info(f"Created flow with ID: {new_flow.id}")
        
        return FlowResponse(
            id=str(new_flow.id),
            name=new_flow.name,
            description=new_flow.description,
            version=new_flow.version,
            is_public=new_flow.is_public,
            is_active=new_flow.is_active,
            is_published=new_flow.is_published,
            owner_id=str(new_flow.owner_id),
            created_at=new_flow.created_at.isoformat(),
            updated_at=new_flow.updated_at.isoformat()
        )
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating flow: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create flow"
        )

@router.get("/flows/{flow_id}", response_model=FlowResponse, tags=["Flows"])
async def get_flow(
    flow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Get a specific flow"""
    logger.info(f"Fetching flow {flow_id} for user: {current_user.email}")
    
    try:
        query = select(Flow).where(Flow.id == flow_id)
        result = await db.execute(query)
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow not found"
            )
        
        # Check ownership or public access
        if flow.owner_id != current_user.id and not flow.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this flow"
            )
        
        return FlowResponse(
            id=str(flow.id),
            name=flow.name,
            description=flow.description,
            version=flow.version,
            is_public=flow.is_public,
            is_active=flow.is_active,
            is_published=flow.is_published,
            owner_id=str(flow.owner_id),
            created_at=flow.created_at.isoformat(),
            updated_at=flow.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching flow {flow_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch flow"
        )

@router.put("/flows/{flow_id}", response_model=FlowResponse, tags=["Flows"])
async def update_flow(
    flow_id: str,
    flow_update: FlowUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Update an existing flow (this is the main save functionality)"""
    logger.info(f"Updating flow {flow_id} for user: {current_user.email}")
    
    try:
        query = select(Flow).where(Flow.id == flow_id)
        result = await db.execute(query)
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow not found"
            )
        
        # Check ownership
        if flow.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this flow"
            )
        
        # Update fields if provided
        if flow_update.name is not None:
            flow.name = flow_update.name
        if flow_update.description is not None:
            flow.description = flow_update.description
        if flow_update.flow_data is not None:
            flow.flow_data = flow_update.flow_data
        if flow_update.is_public is not None:
            flow.is_public = flow_update.is_public
        if flow_update.is_active is not None:
            flow.is_active = flow_update.is_active
        
        await db.commit()
        await db.refresh(flow)
        
        logger.info(f"Successfully updated flow {flow_id}")
        
        return FlowResponse(
            id=str(flow.id),
            name=flow.name,
            description=flow.description,
            version=flow.version,
            is_public=flow.is_public,
            is_active=flow.is_active,
            is_published=flow.is_published,
            owner_id=str(flow.owner_id),
            created_at=flow.created_at.isoformat(),
            updated_at=flow.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating flow {flow_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update flow"
        )

@router.delete("/flows/{flow_id}", tags=["Flows"])
async def delete_flow(
    flow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Delete a flow (soft delete by setting is_active to False)"""
    logger.info(f"Deleting flow {flow_id} for user: {current_user.email}")
    
    try:
        query = select(Flow).where(Flow.id == flow_id)
        result = await db.execute(query)
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow not found"
            )
        
        # Check ownership
        if flow.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this flow"
            )
        
        # Soft delete
        flow.is_active = False
        
        await db.commit()
        
        logger.info(f"Successfully deleted flow {flow_id}")
        
        return {"message": "Flow deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting flow {flow_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete flow"
        )

@router.post("/flows/{flow_id}/publish", response_model=FlowResponse, tags=["Flows"])
async def publish_flow(
    flow_id: str,
    publish_data: FlowPublishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Publish a flow"""
    logger.info(f"Publishing flow {flow_id} for user: {current_user.email}")
    
    try:
        query = select(Flow).where(Flow.id == flow_id)
        result = await db.execute(query)
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow not found"
            )
        
        # Check ownership
        if flow.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this flow"
            )
        
        # Update flow
        flow.is_published = True
        if publish_data.version:
            flow.version = publish_data.version
        if publish_data.is_public is not None:
            flow.is_public = publish_data.is_public
        
        await db.commit()
        await db.refresh(flow)
        
        logger.info(f"Successfully published flow {flow_id}")
        
        return FlowResponse(
            id=str(flow.id),
            name=flow.name,
            description=flow.description,
            version=flow.version,
            is_public=flow.is_public,
            is_active=flow.is_active,
            is_published=flow.is_published,
            owner_id=str(flow.owner_id),
            created_at=flow.created_at.isoformat(),
            updated_at=flow.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error publishing flow {flow_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish flow"
        )

@router.post("/flows/{flow_id}/duplicate", response_model=FlowResponse, tags=["Flows"])
async def duplicate_flow(
    flow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Duplicate an existing flow"""
    logger.info(f"Duplicating flow {flow_id} for user: {current_user.email}")
    
    try:
        query = select(Flow).where(Flow.id == flow_id)
        result = await db.execute(query)
        original_flow = result.scalar_one_or_none()
        
        if not original_flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow not found"
            )
        
        # Check access (owner or public)
        if original_flow.owner_id != current_user.id and not original_flow.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this flow"
            )
        
        # Create duplicate
        duplicate_flow = Flow(
            name=f"{original_flow.name} (Copy)",
            description=original_flow.description,
            flow_data=original_flow.flow_data,
            is_public=False,  # Duplicates are always private initially
            owner_id=current_user.id
        )
        
        db.add(duplicate_flow)
        await db.commit()
        await db.refresh(duplicate_flow)
        
        logger.info(f"Successfully duplicated flow {flow_id} to {duplicate_flow.id}")
        
        return FlowResponse(
            id=str(duplicate_flow.id),
            name=duplicate_flow.name,
            description=duplicate_flow.description,
            version=duplicate_flow.version,
            is_public=duplicate_flow.is_public,
            is_active=duplicate_flow.is_active,
            is_published=duplicate_flow.is_published,
            owner_id=str(duplicate_flow.owner_id),
            created_at=duplicate_flow.created_at.isoformat(),
            updated_at=duplicate_flow.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error duplicating flow {flow_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to duplicate flow"
        )