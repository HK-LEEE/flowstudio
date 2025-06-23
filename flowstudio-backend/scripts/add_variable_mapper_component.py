#!/usr/bin/env python3
"""
Add Variable Mapper Component to FlowStudio
This component maps multiple input variables and makes them available for template binding
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.component_template import ComponentTemplate
from app.db.database import engine

# Variable Mapper Component Template
VARIABLE_MAPPER_COMPONENT = {
    "component_type": "variable_mapper",
    "name": "variable_mapper", 
    "display_name": "Variable Mapper",
    "description": "Maps multiple input variables and creates a structured data object for template binding",
    "category": "Text Processing",
    "icon": "NodeIndexOutlined",
    "color": "#13c2c2",
    "input_schema": {
        "properties": {
            "input_data": {
                "type": "object",
                "title": "Input Data",
                "description": "Input object from previous nodes"
            },
            "variable_mappings": {
                "type": "array",
                "title": "Variable Mappings",
                "description": "Define how to map input fields to variables",
                "items": {
                    "type": "object",
                    "properties": {
                        "source_field": {
                            "type": "string",
                            "title": "Source Field",
                            "description": "Field name from input data"
                        },
                        "target_variable": {
                            "type": "string", 
                            "title": "Target Variable",
                            "description": "Variable name for template use"
                        },
                        "default_value": {
                            "type": "string",
                            "title": "Default Value",
                            "description": "Default if source field is missing"
                        },
                        "transform": {
                            "type": "string",
                            "title": "Transform",
                            "enum": ["none", "uppercase", "lowercase", "title_case", "trim"],
                            "default": "none"
                        }
                    },
                    "required": ["source_field", "target_variable"]
                },
                "default": [
                    {
                        "source_field": "message",
                        "target_variable": "user_message",
                        "default_value": "",
                        "transform": "trim"
                    }
                ]
            }
        },
        "required": ["input_data"]
    },
    "output_schema": {
        "properties": {
            "variables": {
                "type": "object",
                "description": "Mapped variables ready for template use"
            },
            "mapping_results": {
                "type": "array",
                "description": "Results of each mapping operation",
                "items": {
                    "type": "object", 
                    "properties": {
                        "source_field": {"type": "string"},
                        "target_variable": {"type": "string"},
                        "value": {"type": "string"},
                        "was_transformed": {"type": "boolean"},
                        "used_default": {"type": "boolean"}
                    }
                }
            },
            "total_variables": {
                "type": "integer",
                "description": "Number of variables created"
            }
        }
    },
    "version": "1.0.0",
    "is_active": True,
    "is_beta": False,
    "sort_order": 10,
    "documentation": """
Variable Mapper component for mapping multiple input variables.

Features:
- Maps multiple input fields to named variables
- Supports data transformation (uppercase, lowercase, etc.)
- Provides default values for missing fields  
- Creates structured variable object for templates

Usage:
1. Connect to node that outputs structured data
2. Configure variable mappings
3. Use mapped variables in downstream templates

Example Flow:
API Input -> Variable Mapper -> Prompt Template
""",
    "examples": {
        "basic": {
            "input_data": {"name": "Alice", "age": "30", "city": "Seoul"},
            "variable_mappings": [
                {
                    "source_field": "name",
                    "target_variable": "user_name", 
                    "transform": "title_case"
                },
                {
                    "source_field": "city",
                    "target_variable": "location",
                    "default_value": "Unknown"
                }
            ]
        },
        "chat_flow": {
            "input_data": {"message": "hello world", "session_id": "123"},
            "variable_mappings": [
                {
                    "source_field": "message",
                    "target_variable": "user_input",
                    "transform": "trim"
                },
                {
                    "source_field": "session_id", 
                    "target_variable": "session",
                    "default_value": "default_session"
                }
            ]
        }
    }
}

async def add_variable_mapper_component():
    """Add Variable Mapper component to the database"""
    print("Adding Variable Mapper component...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Check if component already exists
            from sqlalchemy import select
            result = await session.execute(
                select(ComponentTemplate).where(
                    ComponentTemplate.component_type == "variable_mapper"
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"⚠️  Variable Mapper component already exists (ID: {existing.id})")
                print("Updating existing component...")
                
                # Update existing component
                for key, value in VARIABLE_MAPPER_COMPONENT.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
            else:
                # Create new component
                component = ComponentTemplate(**VARIABLE_MAPPER_COMPONENT)
                session.add(component)
                print("✅ Creating new Variable Mapper component")
            
            await session.commit()
            
            print("🎉 Variable Mapper component added successfully!")
            print(f"   - Component Type: {VARIABLE_MAPPER_COMPONENT['component_type']}")
            print(f"   - Display Name: {VARIABLE_MAPPER_COMPONENT['display_name']}")
            print(f"   - Category: {VARIABLE_MAPPER_COMPONENT['category']}")
            print(f"   - Description: {VARIABLE_MAPPER_COMPONENT['description']}")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error adding Variable Mapper component: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_variable_mapper_component())