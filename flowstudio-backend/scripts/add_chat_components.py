#!/usr/bin/env python3
"""
Add Chat Input and Chat Output components for LLMOps testing
These components are essential for conversational AI flows
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.component_template import ComponentTemplate
from app.db.database import engine

# Chat Input/Output component template definitions
CHAT_COMPONENT_TEMPLATES = [
    {
        "component_type": "chat_input",
        "name": "chat_input",
        "display_name": "Chat Input",
        "description": "Automatically receives user messages from the chat interface - no manual input required",
        "category": "Input/Output",
        "icon": "MessageOutlined",
        "color": "#52c41a",
        "input_schema": {
            "properties": {
                "auto_message": {
                    "type": "string",
                    "title": "Auto Message",
                    "description": "This field is automatically populated with user messages from the chat interface",
                    "readOnly": True
                }
            }
        },
        "output_schema": {
            "properties": {
                "message": {
                    "type": "string",
                    "description": "User message from chat interface"
                },
                "session_id": {
                    "type": "string",
                    "description": "Chat session identifier"
                },
                "user_id": {
                    "type": "string",
                    "description": "User identifier"
                },
                "timestamp": {
                    "type": "string",
                    "description": "Message timestamp"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 1,
        "documentation": "Chat Input component that automatically receives user messages from the chat interface. No manual configuration required.",
        "examples": {
            "basic": {
                "message": "User message will appear here automatically",
                "session_id": "auto_generated",
                "user_id": "auto_detected"
            }
        }
    },
    {
        "component_type": "chat_output",
        "name": "chat_output",
        "display_name": "Chat Output",
        "description": "Automatically sends AI responses to the chat interface - no manual configuration required",
        "category": "Input/Output",
        "icon": "SendOutlined",
        "color": "#1890ff",
        "input_schema": {
            "properties": {
                "response": {
                    "type": "string",
                    "title": "AI Response",
                    "description": "The AI-generated response that will be automatically sent to the chat interface"
                }
            },
            "required": ["response"]
        },
        "output_schema": {
            "properties": {
                "message": {
                    "type": "string",
                    "description": "AI response sent to chat interface"
                },
                "timestamp": {
                    "type": "string",
                    "description": "Response timestamp"
                },
                "status": {
                    "type": "string",
                    "description": "Delivery status"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 2,
        "documentation": "Chat Output component that automatically sends AI responses to the chat interface. Simply connect an LLM output to this component.",
        "examples": {
            "basic": {
                "response": "AI response will be automatically sent to chat",
                "status": "delivered"
            }
        }
    },
    {
        "component_type": "chat_memory",
        "name": "chat_memory",
        "display_name": "Chat Memory",
        "description": "Manages conversation history and context memory",
        "category": "Data Processing",
        "icon": "DatabaseOutlined",
        "color": "#722ed1",
        "input_schema": {
            "properties": {
                "session_id": {
                    "type": "string",
                    "title": "Session ID",
                    "description": "Chat session identifier"
                },
                "message": {
                    "type": "string",
                    "title": "New Message",
                    "description": "New message to add to memory"
                },
                "role": {
                    "type": "string",
                    "title": "Message Role",
                    "description": "Role of the message sender",
                    "enum": ["user", "assistant", "system"],
                    "default": "user"
                },
                "max_history": {
                    "type": "integer",
                    "title": "Max History",
                    "description": "Maximum number of messages to keep",
                    "default": 10,
                    "minimum": 1,
                    "maximum": 100
                },
                "memory_type": {
                    "type": "string",
                    "title": "Memory Type",
                    "description": "Type of memory to use",
                    "enum": ["buffer", "summary", "token_buffer"],
                    "default": "buffer"
                }
            },
            "required": ["session_id"]
        },
        "output_schema": {
            "properties": {
                "history": {
                    "type": "array",
                    "description": "Conversation history"
                },
                "context": {
                    "type": "string",
                    "description": "Formatted conversation context"
                },
                "summary": {
                    "type": "string",
                    "description": "Conversation summary (if using summary memory)"
                },
                "message_count": {
                    "type": "integer",
                    "description": "Number of messages in memory"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 25,
        "documentation": "Chat Memory component for managing conversation history",
        "examples": {
            "basic": {
                "session_id": "session_123",
                "message": "What's the weather like?",
                "role": "user",
                "max_history": 10
            }
        }
    },
    {
        "component_type": "response_formatter",
        "name": "response_formatter",
        "display_name": "Response Formatter",
        "description": "Formats AI responses with templates and styling",
        "category": "Text Processing",
        "icon": "FormatPainterOutlined",
        "color": "#fa8c16",
        "input_schema": {
            "properties": {
                "content": {
                    "type": "string",
                    "title": "Content",
                    "description": "Raw content to format"
                },
                "template": {
                    "type": "string",
                    "title": "Template",
                    "description": "Response template with placeholders",
                    "default": "{content}"
                },
                "format_type": {
                    "type": "string",
                    "title": "Format Type",
                    "description": "Output format type",
                    "enum": ["text", "markdown", "html", "json"],
                    "default": "text"
                },
                "variables": {
                    "type": "object",
                    "title": "Template Variables",
                    "description": "Variables to substitute in template"
                },
                "styling": {
                    "type": "object",
                    "title": "Styling Options",
                    "description": "Styling configuration for the response"
                }
            },
            "required": ["content"]
        },
        "output_schema": {
            "properties": {
                "formatted_content": {
                    "type": "string",
                    "description": "Formatted response content"
                },
                "format_type": {
                    "type": "string",
                    "description": "Output format type"
                },
                "template_used": {
                    "type": "string",
                    "description": "Template that was applied"
                },
                "variables_applied": {
                    "type": "object",
                    "description": "Variables that were substituted"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 28,
        "documentation": "Response Formatter for styling and templating AI responses",
        "examples": {
            "basic": {
                "content": "The weather is sunny today.",
                "template": "🌤️ Weather Update: {content}",
                "format_type": "text"
            }
        }
    }
]

async def add_chat_components():
    """Add Chat Input/Output component templates to the database"""
    print("Adding Chat Input/Output component templates...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Check existing components
            existing_types = await session.execute(
                text("SELECT component_type FROM flow_studio_component_templates")
            )
            existing_set = {row[0] for row in existing_types.fetchall()}
            
            # Filter out existing components
            new_templates = [
                template for template in CHAT_COMPONENT_TEMPLATES 
                if template['component_type'] not in existing_set
            ]
            
            if not new_templates:
                print("Chat components already exist in database")
                return
            
            # Insert new templates
            for template_data in new_templates:
                template = ComponentTemplate(**template_data)
                session.add(template)
                print(f"  ✅ Added: {template_data['display_name']}")
            
            await session.commit()
            print(f"\n🎉 Successfully added {len(new_templates)} chat component templates!")
            
            # Show total count
            total_count = await session.execute(
                text("SELECT COUNT(*) FROM flow_studio_component_templates")
            )
            total = total_count.scalar()
            print(f"📊 Total components in library: {total}")
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error adding templates: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_chat_components())