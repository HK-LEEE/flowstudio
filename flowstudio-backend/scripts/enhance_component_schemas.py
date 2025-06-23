#!/usr/bin/env python3
"""
Enhance Component Schemas for Unified Configuration System
Updates existing component templates with enhanced schema metadata for advanced UI features
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.models.component_template import ComponentTemplate
from app.db.database import engine

# Enhanced schema definitions with section metadata and UI hints
ENHANCED_SCHEMAS = {
    "text_input": {
        "input_schema": {
            "properties": {
                "text_value": {
                    "type": "string",
                    "title": "Text Value",
                    "description": "The text content to output",
                    "default": "",
                    "required": True,
                    "is_handle": False,
                    "field_type": "textarea",
                    "section": "content",
                    "is_template_field": True,
                    "supports_variables": True
                },
                "output_format": {
                    "type": "string",
                    "title": "Output Format",
                    "description": "How to format the output text",
                    "enum": ["text", "markdown", "html"],
                    "default": "text",
                    "section": "formatting",
                    "advanced": False
                }
            },
            "required": ["text_value"],
            "sections": {
                "content": {
                    "title": "Content Configuration",
                    "description": "Define the text content and variables",
                    "icon": "FileTextOutlined",
                    "color": "#1890ff",
                    "collapsible": False
                },
                "formatting": {
                    "title": "Output Formatting",
                    "description": "Configure how the text is formatted",
                    "icon": "FormatPainterOutlined",
                    "color": "#13c2c2",
                    "collapsible": True,
                    "defaultExpanded": False
                }
            }
        }
    },
    
    "chat_input": {
        "input_schema": {
            "properties": {
                "message": {
                    "type": "string",
                    "title": "User Message",
                    "description": "The user's input message",
                    "required": True,
                    "is_handle": True,
                    "field_type": "textarea",
                    "section": "input",
                    "is_template_field": True,
                    "supports_variables": True
                },
                "session_id": {
                    "type": "string",
                    "title": "Session ID",
                    "description": "Unique identifier for the chat session",
                    "default": "default_session",
                    "section": "session",
                    "advanced": False
                },
                "user_id": {
                    "type": "string",
                    "title": "User ID",
                    "description": "Unique identifier for the user",
                    "default": "anonymous",
                    "section": "session",
                    "advanced": False
                },
                "context": {
                    "type": "object",
                    "title": "Context Data",
                    "description": "Additional context data for the conversation",
                    "section": "advanced",
                    "advanced": True,
                    "is_connection_aware": True
                },
                "metadata": {
                    "type": "object",
                    "title": "Metadata",
                    "description": "Request metadata (timestamp, client info, etc.)",
                    "section": "advanced",
                    "advanced": True
                }
            },
            "required": ["message"],
            "sections": {
                "input": {
                    "title": "Message Input",
                    "description": "Configure the user message input",
                    "icon": "MessageOutlined",
                    "color": "#52c41a",
                    "collapsible": False
                },
                "session": {
                    "title": "Session Management",
                    "description": "Manage user and session identifiers",
                    "icon": "UserOutlined",
                    "color": "#1890ff",
                    "collapsible": True,
                    "defaultExpanded": False
                },
                "advanced": {
                    "title": "Advanced Options",
                    "description": "Advanced context and metadata configuration",
                    "icon": "SettingOutlined",
                    "color": "#722ed1",
                    "collapsible": True,
                    "defaultExpanded": False,
                    "advanced": True
                }
            }
        }
    },
    
    "azure_openai": {
        "input_schema": {
            "properties": {
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Azure OpenAI API key",
                    "required": True,
                    "is_handle": False,
                    "field_type": "password",
                    "section": "authentication"
                },
                "endpoint": {
                    "type": "string",
                    "title": "Endpoint URL",
                    "description": "Azure OpenAI endpoint URL",
                    "required": True,
                    "is_handle": False,
                    "field_type": "text",
                    "section": "authentication"
                },
                "deployment_name": {
                    "type": "string",
                    "title": "Deployment Name",
                    "description": "Azure OpenAI deployment name",
                    "required": True,
                    "is_handle": False,
                    "field_type": "text",
                    "section": "authentication"
                },
                "prompt": {
                    "type": "string",
                    "title": "Prompt",
                    "description": "The prompt to send to the LLM",
                    "required": True,
                    "is_handle": True,
                    "field_type": "textarea",
                    "section": "input",
                    "is_template_field": True,
                    "supports_variables": True,
                    "is_connection_aware": True
                },
                "temperature": {
                    "type": "number",
                    "title": "Temperature",
                    "description": "Controls randomness in the response (0.0-1.0)",
                    "default": 0.7,
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "section": "parameters",
                    "advanced": False
                },
                "max_tokens": {
                    "type": "integer",
                    "title": "Max Tokens",
                    "description": "Maximum number of tokens to generate",
                    "default": 1000,
                    "minimum": 1,
                    "maximum": 4000,
                    "section": "parameters",
                    "advanced": False
                },
                "top_p": {
                    "type": "number",
                    "title": "Top P",
                    "description": "Controls diversity via nucleus sampling",
                    "default": 1.0,
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "section": "parameters",
                    "advanced": True
                }
            },
            "required": ["api_key", "endpoint", "deployment_name", "prompt"],
            "sections": {
                "authentication": {
                    "title": "Azure OpenAI Configuration",
                    "description": "Configure Azure OpenAI connection settings",
                    "icon": "CloudOutlined",
                    "color": "#BD10E0",
                    "collapsible": True,
                    "defaultExpanded": True
                },
                "input": {
                    "title": "Prompt Input",
                    "description": "Configure the prompt to send to the LLM",
                    "icon": "EditOutlined",
                    "color": "#fa8c16",
                    "collapsible": False
                },
                "parameters": {
                    "title": "Model Parameters",
                    "description": "Fine-tune the model's behavior",
                    "icon": "ControlOutlined",
                    "color": "#13c2c2",
                    "collapsible": True,
                    "defaultExpanded": False
                }
            }
        }
    },
    
    "variable_mapper": {
        "input_schema": {
            "properties": {
                "input_data": {
                    "type": "object",
                    "title": "Input Data",
                    "description": "Data received from previous nodes",
                    "required": True,
                    "is_handle": True,
                    "section": "input",
                    "is_connection_aware": True
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
                    ],
                    "section": "mapping"
                }
            },
            "required": ["input_data"],
            "sections": {
                "input": {
                    "title": "Input Data",
                    "description": "Data received from connected nodes",
                    "icon": "LinkOutlined",
                    "color": "#52c41a",
                    "collapsible": False
                },
                "mapping": {
                    "title": "Variable Mapping",
                    "description": "Configure how input fields map to variables",
                    "icon": "NodeIndexOutlined",
                    "color": "#13c2c2",
                    "collapsible": False
                }
            }
        }
    },
    
    "response_formatter": {
        "input_schema": {
            "properties": {
                "content": {
                    "type": "string",
                    "title": "Content",
                    "description": "Raw content to format",
                    "required": True,
                    "is_handle": True,
                    "field_type": "textarea",
                    "section": "input",
                    "is_connection_aware": True
                },
                "template": {
                    "type": "string",
                    "title": "Format Template",
                    "description": "Template with placeholders for formatting",
                    "default": "{content}",
                    "field_type": "textarea",
                    "section": "template",
                    "is_template_field": True,
                    "supports_variables": True
                },
                "format_type": {
                    "type": "string",
                    "title": "Format Type",
                    "description": "Output format type",
                    "enum": ["text", "markdown", "html", "json"],
                    "default": "text",
                    "section": "formatting"
                },
                "variables": {
                    "type": "object",
                    "title": "Template Variables",
                    "description": "Variables to substitute in template",
                    "section": "template",
                    "advanced": False
                },
                "styling": {
                    "type": "object",
                    "title": "Styling Options",
                    "description": "Styling configuration for the response",
                    "section": "formatting",
                    "advanced": True
                }
            },
            "required": ["content"],
            "sections": {
                "input": {
                    "title": "Content Input",
                    "description": "Raw content to be formatted",
                    "icon": "FileTextOutlined",
                    "color": "#1890ff",
                    "collapsible": False
                },
                "template": {
                    "title": "Template Configuration",
                    "description": "Configure the formatting template",
                    "icon": "FieldStringOutlined",
                    "color": "#fa8c16",
                    "collapsible": False
                },
                "formatting": {
                    "title": "Output Formatting",
                    "description": "Configure output format and styling",
                    "icon": "FormatPainterOutlined",
                    "color": "#13c2c2",
                    "collapsible": True,
                    "defaultExpanded": False
                }
            }
        }
    }
}

async def enhance_component_schemas():
    """Enhance existing component templates with advanced schema metadata"""
    print("🚀 Enhancing component schemas for unified configuration system...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            updated_count = 0
            
            for component_type, enhanced_schema in ENHANCED_SCHEMAS.items():
                # Find existing component
                result = await session.execute(
                    select(ComponentTemplate).where(
                        ComponentTemplate.component_type == component_type
                    )
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    print(f"📝 Updating {component_type}...")
                    
                    # Update input schema with enhanced metadata
                    existing.input_schema = enhanced_schema["input_schema"]
                    
                    # Mark for enhanced configuration
                    if not existing.examples:
                        existing.examples = {}
                    existing.examples["enhanced_config"] = True
                    existing.examples["supports_unified_ui"] = True
                    
                    updated_count += 1
                    print(f"   ✅ Enhanced {existing.display_name}")
                    
                    # Show key enhancements
                    sections = enhanced_schema["input_schema"].get("sections", {})
                    if sections:
                        print(f"   📋 Added {len(sections)} configuration sections:")
                        for section_id, section_config in sections.items():
                            print(f"      - {section_config['title']}")
                    
                    # Count enhanced fields
                    properties = enhanced_schema["input_schema"].get("properties", {})
                    template_fields = sum(1 for field in properties.values() 
                                        if field.get("is_template_field"))
                    connection_fields = sum(1 for field in properties.values() 
                                          if field.get("is_connection_aware"))
                    
                    if template_fields > 0:
                        print(f"   🔗 {template_fields} template field(s) with variable support")
                    if connection_fields > 0:
                        print(f"   🔌 {connection_fields} connection-aware field(s)")
                    
                else:
                    print(f"⚠️  Component {component_type} not found - skipping")
            
            await session.commit()
            
            print(f"\n🎉 Successfully enhanced {updated_count} component schemas!")
            print("\n📋 Enhancement Summary:")
            print("   ✅ Section-based organization")
            print("   ✅ Template field detection")
            print("   ✅ Connection-aware fields")
            print("   ✅ Advanced/basic field categorization")
            print("   ✅ UI hints and field types")
            print("   ✅ Variable substitution support")
            
            # Show total count
            total_result = await session.execute(
                select(ComponentTemplate).where(ComponentTemplate.is_active == True)
            )
            total_components = len(total_result.scalars().all())
            print(f"\n📊 Total active components: {total_components}")
            print(f"📊 Enhanced components: {updated_count}")
            print(f"📊 Coverage: {(updated_count/total_components)*100:.1f}%")
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error enhancing schemas: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enhance_component_schemas())