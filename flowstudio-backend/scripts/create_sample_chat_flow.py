#!/usr/bin/env python3
"""
Create a sample chat flow for testing
Creates a simple Chat Input -> LLM -> Chat Output flow
"""
import asyncio
import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.flow import Flow
from app.models.user import User
from app.db.database import engine
from sqlalchemy import select

# Sample chat flow definition
SAMPLE_CHAT_FLOW = {
    "flow_id": "sample_chat_flow",
    "nodes": [
        {
            "id": "chat_input_1",
            "type": "langflowNode",
            "position": {"x": 100, "y": 100},
            "data": {
                "template": {
                    "id": "chat_input_template",
                    "component_type": "chat_input",
                    "display_name": "Chat Input",
                    "description": "Receives user messages",
                    "category": "Input/Output",
                    "icon": "MessageOutlined",
                    "color": "#52c41a",
                    "input_schema": {
                        "properties": {
                            "message": {
                                "type": "string",
                                "title": "User Message",
                                "description": "The user's input message"
                            }
                        },
                        "required": ["message"]
                    },
                    "output_schema": {
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": "Processed user message"
                            }
                        }
                    }
                },
                "input_values": {},
                "config_data": {}
            }
        },
        {
            "id": "claude_llm_1",
            "type": "langflowNode",
            "position": {"x": 400, "y": 100},
            "data": {
                "template": {
                    "id": "claude_llm_template",
                    "component_type": "claude_llm",
                    "display_name": "Claude LLM",
                    "description": "Generate text using Claude AI",
                    "category": "AI/LLM",
                    "icon": "RobotOutlined",
                    "color": "#7c3aed",
                    "input_schema": {
                        "properties": {
                            "prompt": {
                                "type": "string",
                                "title": "Prompt",
                                "description": "Text prompt for Claude"
                            }
                        },
                        "required": ["prompt"]
                    },
                    "output_schema": {
                        "properties": {
                            "response": {
                                "type": "string",
                                "description": "Claude AI response"
                            }
                        }
                    }
                },
                "input_values": {
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 1000,
                    "system_message": "You are a helpful AI assistant. Provide helpful and accurate responses."
                },
                "config_data": {}
            }
        },
        {
            "id": "chat_output_1",
            "type": "langflowNode",
            "position": {"x": 700, "y": 100},
            "data": {
                "template": {
                    "id": "chat_output_template",
                    "component_type": "chat_output",
                    "display_name": "Chat Output",
                    "description": "Formats and returns AI responses",
                    "category": "Input/Output",
                    "icon": "SendOutlined",
                    "color": "#1890ff",
                    "input_schema": {
                        "properties": {
                            "response": {
                                "type": "string",
                                "title": "AI Response",
                                "description": "The AI-generated response message"
                            }
                        },
                        "required": ["response"]
                    },
                    "output_schema": {
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": "Formatted response message"
                            }
                        }
                    }
                },
                "input_values": {
                    "response_type": "text"
                },
                "config_data": {}
            }
        }
    ],
    "edges": [
        {
            "id": "edge_1",
            "source": "chat_input_1",
            "target": "claude_llm_1",
            "sourceHandle": "message",
            "targetHandle": "prompt",
            "type": "customEdge"
        },
        {
            "id": "edge_2",
            "source": "claude_llm_1",
            "target": "chat_output_1",
            "sourceHandle": "response",
            "targetHandle": "response",
            "type": "customEdge"
        }
    ]
}

# Advanced chat flow with memory
ADVANCED_CHAT_FLOW = {
    "flow_id": "advanced_chat_flow",
    "nodes": [
        {
            "id": "chat_input_1",
            "type": "langflowNode",
            "position": {"x": 100, "y": 100},
            "data": {
                "template": {
                    "id": "chat_input_template",
                    "component_type": "chat_input",
                    "display_name": "Chat Input",
                    "description": "Receives user messages",
                    "category": "Input/Output",
                    "icon": "MessageOutlined",
                    "color": "#52c41a",
                    "input_schema": {
                        "properties": {
                            "message": {"type": "string", "title": "User Message"},
                            "session_id": {"type": "string", "title": "Session ID"}
                        },
                        "required": ["message"]
                    },
                    "output_schema": {
                        "properties": {
                            "message": {"type": "string"},
                            "session_id": {"type": "string"}
                        }
                    }
                }
            }
        },
        {
            "id": "chat_memory_1",
            "type": "langflowNode",
            "position": {"x": 100, "y": 300},
            "data": {
                "template": {
                    "id": "chat_memory_template",
                    "component_type": "chat_memory",
                    "display_name": "Chat Memory",
                    "description": "Manages conversation history",
                    "category": "Data Processing",
                    "icon": "DatabaseOutlined",
                    "color": "#722ed1",
                    "input_schema": {
                        "properties": {
                            "session_id": {"type": "string", "title": "Session ID"},
                            "message": {"type": "string", "title": "New Message"}
                        },
                        "required": ["session_id"]
                    },
                    "output_schema": {
                        "properties": {
                            "context": {"type": "string"},
                            "history": {"type": "array"}
                        }
                    }
                },
                "input_values": {
                    "max_history": 10,
                    "memory_type": "buffer"
                }
            }
        },
        {
            "id": "prompt_template_1",
            "type": "langflowNode",
            "position": {"x": 400, "y": 200},
            "data": {
                "template": {
                    "id": "prompt_template_template",
                    "component_type": "prompt_template",
                    "display_name": "Prompt Template",
                    "description": "Formats prompts with context",
                    "category": "Text Processing",
                    "icon": "FieldStringOutlined",
                    "color": "#fa8c16",
                    "input_schema": {
                        "properties": {
                            "template": {"type": "string", "title": "Template"},
                            "message": {"type": "string", "title": "User Message"},
                            "context": {"type": "string", "title": "Context"}
                        },
                        "required": ["template"]
                    },
                    "output_schema": {
                        "properties": {
                            "prompt": {"type": "string"}
                        }
                    }
                },
                "input_values": {
                    "template": "Context: {context}\n\nUser: {message}\n\nAssistant:",
                    "variables": {}
                }
            }
        },
        {
            "id": "openai_llm_1",
            "type": "langflowNode",
            "position": {"x": 700, "y": 200},
            "data": {
                "template": {
                    "id": "openai_llm_template",
                    "component_type": "openai_llm",
                    "display_name": "OpenAI LLM",
                    "description": "Generate text using OpenAI",
                    "category": "AI/LLM",
                    "icon": "RobotOutlined",
                    "color": "#10a37f",
                    "input_schema": {
                        "properties": {
                            "prompt": {"type": "string", "title": "Prompt"}
                        },
                        "required": ["prompt"]
                    },
                    "output_schema": {
                        "properties": {
                            "response": {"type": "string"}
                        }
                    }
                },
                "input_values": {
                    "model": "gpt-3.5-turbo",
                    "max_tokens": 1000,
                    "temperature": 0.7
                }
            }
        },
        {
            "id": "response_formatter_1",
            "type": "langflowNode",
            "position": {"x": 1000, "y": 200},
            "data": {
                "template": {
                    "id": "response_formatter_template",
                    "component_type": "response_formatter",
                    "display_name": "Response Formatter",
                    "description": "Formats AI responses",
                    "category": "Text Processing",
                    "icon": "FormatPainterOutlined",
                    "color": "#fa8c16",
                    "input_schema": {
                        "properties": {
                            "content": {"type": "string", "title": "Content"}
                        },
                        "required": ["content"]
                    },
                    "output_schema": {
                        "properties": {
                            "formatted_content": {"type": "string"}
                        }
                    }
                },
                "input_values": {
                    "template": "🤖 Assistant: {content}",
                    "format_type": "text"
                }
            }
        },
        {
            "id": "chat_output_1",
            "type": "langflowNode",
            "position": {"x": 1300, "y": 200},
            "data": {
                "template": {
                    "id": "chat_output_template",
                    "component_type": "chat_output",
                    "display_name": "Chat Output",
                    "description": "Returns formatted response",
                    "category": "Input/Output",
                    "icon": "SendOutlined",
                    "color": "#1890ff",
                    "input_schema": {
                        "properties": {
                            "response": {"type": "string", "title": "Response"}
                        },
                        "required": ["response"]
                    },
                    "output_schema": {
                        "properties": {
                            "message": {"type": "string"}
                        }
                    }
                }
            }
        }
    ],
    "edges": [
        {
            "id": "edge_1",
            "source": "chat_input_1",
            "target": "chat_memory_1",
            "sourceHandle": "session_id",
            "targetHandle": "session_id"
        },
        {
            "id": "edge_2",
            "source": "chat_input_1",
            "target": "chat_memory_1",
            "sourceHandle": "message",
            "targetHandle": "message"
        },
        {
            "id": "edge_3",
            "source": "chat_input_1",
            "target": "prompt_template_1",
            "sourceHandle": "message",
            "targetHandle": "message"
        },
        {
            "id": "edge_4",
            "source": "chat_memory_1",
            "target": "prompt_template_1",
            "sourceHandle": "context",
            "targetHandle": "context"
        },
        {
            "id": "edge_5",
            "source": "prompt_template_1",
            "target": "openai_llm_1",
            "sourceHandle": "prompt",
            "targetHandle": "prompt"
        },
        {
            "id": "edge_6",
            "source": "openai_llm_1",
            "target": "response_formatter_1",
            "sourceHandle": "response",
            "targetHandle": "content"
        },
        {
            "id": "edge_7",
            "source": "response_formatter_1",
            "target": "chat_output_1",
            "sourceHandle": "formatted_content",
            "targetHandle": "response"
        }
    ]
}

async def create_sample_flows():
    """Create sample flows in the database"""
    print("Creating sample chat flows...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Get first available user or create a system user
            result = await session.execute(select(User).limit(1))
            user = result.scalar_one_or_none()
            
            if not user:
                # Create a system user if no users exist
                user = User(
                    username="system",
                    email="system@flowstudio.com",
                    password_hash="system_user",  # Not used for login
                    full_name="System User",
                    is_active=True
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                print(f"Created system user: {user.id}")
            
            owner_id = user.id
            
            # Create simple chat flow
            simple_flow = Flow(
                name="Simple Chat Flow",
                description="A simple chat flow with Chat Input -> LLM -> Chat Output",
                flow_data=SAMPLE_CHAT_FLOW,
                version="1.0.0",
                is_active=True,
                is_public=True,
                is_published=False,
                owner_id=owner_id
            )
            
            session.add(simple_flow)
            
            # Create advanced chat flow
            advanced_flow = Flow(
                name="Advanced Chat Flow with Memory",
                description="An advanced chat flow with memory, prompt templating, and response formatting",
                flow_data=ADVANCED_CHAT_FLOW,
                version="1.0.0",
                is_active=True,
                is_public=True,
                is_published=False,
                owner_id=owner_id
            )
            
            session.add(advanced_flow)
            
            await session.commit()
            await session.refresh(simple_flow)
            await session.refresh(advanced_flow)
            
            print(f"✅ Created Simple Chat Flow (ID: {simple_flow.id})")
            print(f"✅ Created Advanced Chat Flow (ID: {advanced_flow.id})")
            
            # Save flow IDs to a file for easy reference
            flow_ids = {
                "simple_chat_flow_id": str(simple_flow.id),
                "advanced_chat_flow_id": str(advanced_flow.id)
            }
            
            with open("sample_flow_ids.json", "w") as f:
                json.dump(flow_ids, f, indent=2)
            
            print("📋 Flow IDs saved to sample_flow_ids.json")
            print("\n🎉 Sample flows created successfully!")
            print("\nTo test these flows:")
            print("1. Start the FlowStudio backend server")
            print("2. Use the Flow Editor to load and view these flows")
            print("3. Publish them as APIs using the Publish button")
            print("4. Test the APIs with curl or Postman")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating sample flows: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_sample_flows())