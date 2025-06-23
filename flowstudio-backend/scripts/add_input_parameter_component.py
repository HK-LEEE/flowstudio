#!/usr/bin/env python3
"""
Add Input Parameter Component to FlowStudio
This component receives variables from previous nodes and makes them available for template binding
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.component_template import ComponentTemplate
from app.db.database import engine

# Input Parameter Component Template
INPUT_PARAMETER_COMPONENT = {
    "component_type": "input_parameter",
    "name": "input_parameter", 
    "display_name": "Input Parameter",
    "description": "Receives variables from previous nodes and makes them available for template binding",
    "category": "Text Processing",
    "icon": "ParameterOutlined",
    "color": "#52c41a",
    "input_schema": {
        "properties": {
            "variable_name": {
                "type": "string",
                "title": "Variable Name",
                "description": "Name of the variable to store the input value"
            },
            "input_value": {
                "type": "string", 
                "title": "Input Value",
                "description": "Value from previous node (connected via edge)"
            },
            "default_value": {
                "type": "string",
                "title": "Default Value", 
                "description": "Default value if no input is provided",
                "default": ""
            },
            "variable_type": {
                "type": "string",
                "title": "Variable Type",
                "enum": ["string", "number", "boolean", "object"],
                "default": "string",
                "description": "Type of the variable"
            }
        },
        "required": ["variable_name"]
    },
    "output_schema": {
        "properties": {
            "variable_name": {
                "type": "string",
                "description": "Name of the variable"
            },
            "variable_value": {
                "type": "string", 
                "description": "Value of the variable"
            },
            "variable_type": {
                "type": "string",
                "description": "Type of the variable"
            },
            "is_available": {
                "type": "boolean",
                "description": "Whether the variable is available for use"
            }
        }
    },
    "version": "1.0.0",
    "is_active": True,
    "is_beta": False,
    "sort_order": 9,
    "documentation": """
Input Parameter component for receiving variables from previous nodes.

Usage:
1. Connect this component to output of previous nodes
2. Set variable_name to define how the value will be accessible
3. Optionally set default_value for fallback
4. Use the variable in downstream template components

Example:
- Previous node outputs: {"user_name": "Alice", "age": 30}
- Input Parameter receives "user_name" -> outputs variable_value: "Alice"
- Template component can use {user_name} placeholder
""",
    "examples": {
        "basic": {
            "variable_name": "user_input",
            "input_value": "Hello World",
            "default_value": "Default message"
        },
        "from_llm": {
            "variable_name": "ai_response", 
            "input_value": "Connected from LLM output",
            "variable_type": "string"
        }
    }
}

async def add_input_parameter_component():
    """Add Input Parameter component to the database"""
    print("Adding Input Parameter component...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Check if component already exists
            from sqlalchemy import select
            result = await session.execute(
                select(ComponentTemplate).where(
                    ComponentTemplate.component_type == "input_parameter"
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"⚠️  Input Parameter component already exists (ID: {existing.id})")
                print("Updating existing component...")
                
                # Update existing component
                for key, value in INPUT_PARAMETER_COMPONENT.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
            else:
                # Create new component
                component = ComponentTemplate(**INPUT_PARAMETER_COMPONENT)
                session.add(component)
                print("✅ Creating new Input Parameter component")
            
            await session.commit()
            
            print("🎉 Input Parameter component added successfully!")
            print(f"   - Component Type: {INPUT_PARAMETER_COMPONENT['component_type']}")
            print(f"   - Display Name: {INPUT_PARAMETER_COMPONENT['display_name']}")
            print(f"   - Category: {INPUT_PARAMETER_COMPONENT['category']}")
            print(f"   - Description: {INPUT_PARAMETER_COMPONENT['description']}")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error adding Input Parameter component: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_input_parameter_component())