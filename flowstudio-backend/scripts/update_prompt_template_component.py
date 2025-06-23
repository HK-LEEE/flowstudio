#!/usr/bin/env python3
"""
Update Prompt Template Component to include Input Section
Adds ability to receive data from previous nodes and map them to template variables
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.component_template import ComponentTemplate
from app.db.database import engine

# Updated Prompt Template Component with Input Section
UPDATED_PROMPT_TEMPLATE = {
    "component_type": "prompt_template",
    "name": "prompt_template",
    "display_name": "Prompt Template",
    "description": "Create dynamic prompts with variable substitution from previous nodes or manual input",
    "category": "Text Processing",
    "icon": "FieldStringOutlined",
    "color": "#fa8c16",
    "input_schema": {
        "properties": {
            "template": {
                "type": "string",
                "title": "Template",
                "description": "Template with {variable} placeholders",
                "default": "Default template: {input_text}"
            },
            "input_data": {
                "type": "object",
                "title": "Input Data",
                "description": "Data received from previous nodes (connected via edges)"
            },
            "variable_mappings": {
                "type": "array",
                "title": "Variable Mappings",
                "description": "Map input data fields to template variables",
                "items": {
                    "type": "object",
                    "properties": {
                        "input_field": {
                            "type": "string",
                            "title": "Input Field",
                            "description": "Field name from input_data"
                        },
                        "variable_name": {
                            "type": "string",
                            "title": "Variable Name", 
                            "description": "Variable name in template (without {})"
                        },
                        "default_value": {
                            "type": "string",
                            "title": "Default Value",
                            "description": "Default value if input field is missing",
                            "default": ""
                        }
                    },
                    "required": ["input_field", "variable_name"]
                },
                "default": [
                    {
                        "input_field": "message",
                        "variable_name": "input_text",
                        "default_value": "No input provided"
                    }
                ]
            },
            "manual_variables": {
                "type": "object",
                "title": "Manual Variables",
                "description": "Additional variables to substitute (not from input_data)",
                "default": {}
            }
        },
        "required": ["template"]
    },
    "output_schema": {
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Rendered prompt with variables substituted"
            },
            "template_used": {
                "type": "string",
                "description": "Original template"
            },
            "variables_applied": {
                "type": "object",
                "description": "All variables that were applied"
            },
            "input_data_received": {
                "type": "object",
                "description": "Data received from input_data"
            },
            "mapping_results": {
                "type": "array",
                "description": "Results of variable mapping",
                "items": {
                    "type": "object",
                    "properties": {
                        "input_field": {"type": "string"},
                        "variable_name": {"type": "string"},
                        "value": {"type": "string"},
                        "used_default": {"type": "boolean"}
                    }
                }
            }
        }
    },
    "version": "1.1.0",
    "is_active": True,
    "is_beta": False,
    "sort_order": 11,
    "documentation": """
Enhanced Prompt Template component with Input Section support.

Features:
1. **Template Definition**: Define templates with {variable} placeholders
2. **Input Data Mapping**: Receive data from previous nodes via edges
3. **Variable Mapping**: Map input fields to template variables
4. **Manual Variables**: Add static variables manually
5. **Default Values**: Fallback values for missing data

Usage Examples:

**Basic Flow**: 
Chat Input → Prompt Template
- Input data: {"message": "Hello"}
- Variable mapping: input_field="message" → variable_name="user_input"
- Template: "User said: {user_input}"
- Result: "User said: Hello"

**Advanced Flow**:
LLM → Prompt Template → Another LLM
- Input data: {"response": "AI answer", "confidence": "high"}
- Mappings: 
  - "response" → "ai_text"
  - "confidence" → "certainty"
- Template: "Based on AI response '{ai_text}' with {certainty} confidence, please..."

**Mixed Variables**:
- Input data: {"user": "Alice"}
- Manual variables: {"system": "ChatBot", "version": "2.0"}
- Template: "{system} v{version}: Hello {user}!"
- Result: "ChatBot v2.0: Hello Alice!"
""",
    "examples": {
        "basic": {
            "template": "User question: {user_input}",
            "variable_mappings": [
                {
                    "input_field": "message",
                    "variable_name": "user_input",
                    "default_value": "No question"
                }
            ]
        },
        "advanced": {
            "template": "Previous AI said: '{ai_response}'. Context: {context}. User: {user_message}",
            "variable_mappings": [
                {
                    "input_field": "response",
                    "variable_name": "ai_response",
                    "default_value": "No previous response"
                },
                {
                    "input_field": "message", 
                    "variable_name": "user_message",
                    "default_value": "No user input"
                }
            ],
            "manual_variables": {
                "context": "continuing conversation"
            }
        }
    }
}

async def update_prompt_template_component():
    """Update Prompt Template component with Input Section"""
    print("Updating Prompt Template component with Input Section...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Find existing component
            from sqlalchemy import select
            result = await session.execute(
                select(ComponentTemplate).where(
                    ComponentTemplate.component_type == "prompt_template"
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"✅ Found existing Prompt Template component (ID: {existing.id})")
                print("📝 Updating with Input Section support...")
                
                # Update existing component
                for key, value in UPDATED_PROMPT_TEMPLATE.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
                
                await session.commit()
                
                print("🎉 Prompt Template component updated successfully!")
                print("📋 New Features Added:")
                print("   ✅ Input Data Section - receive data from previous nodes")
                print("   ✅ Variable Mappings - map input fields to template variables")
                print("   ✅ Default Values - fallback for missing data")
                print("   ✅ Manual Variables - static variables support")
                print("   ✅ Enhanced Documentation - usage examples")
                
            else:
                print("❌ Prompt Template component not found!")
                return
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error updating Prompt Template component: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(update_prompt_template_component())