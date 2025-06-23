#!/usr/bin/env python3
"""
Add new FlowStudio Component Templates
Adds additional useful component types to expand the library
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

# Additional component template definitions
NEW_COMPONENT_TEMPLATES = [
    {
        "component_type": "claude_llm",
        "name": "claude_llm",
        "display_name": "Claude LLM",
        "description": "Generate text using Anthropic's Claude AI models",
        "category": "AI/LLM",
        "icon": "RobotOutlined",
        "color": "#7c3aed",
        "input_schema": {
            "properties": {
                "prompt": {
                    "type": "string",
                    "title": "Prompt",
                    "description": "Text prompt for Claude"
                },
                "system_message": {
                    "type": "string",
                    "title": "System Message",
                    "description": "System message to guide Claude"
                },
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Anthropic API key",
                    "format": "password"
                },
                "model": {
                    "type": "string",
                    "title": "Model",
                    "description": "Claude model to use",
                    "default": "claude-3-haiku-20240307",
                    "enum": ["claude-3-haiku-20240307", "claude-3-sonnet-20240229", "claude-3-opus-20240229"]
                },
                "max_tokens": {
                    "type": "integer",
                    "title": "Max Tokens",
                    "description": "Maximum response length",
                    "default": 1000
                }
            },
            "required": ["prompt", "api_key"]
        },
        "output_schema": {
            "properties": {
                "response": {
                    "type": "string",
                    "description": "Claude AI response"
                },
                "model_used": {
                    "type": "string",
                    "description": "Model used for generation"
                },
                "usage": {
                    "type": "object",
                    "description": "Token usage statistics"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 15,
        "documentation": "Claude LLM component for advanced text generation",
        "examples": {
            "basic": {
                "prompt": "Explain quantum computing in simple terms",
                "model": "claude-3-haiku-20240307"
            }
        }
    },
    {
        "component_type": "json_parser",
        "name": "json_parser",
        "display_name": "JSON Parser",
        "description": "Parse and extract data from JSON strings",
        "category": "Data Processing",
        "icon": "CodeOutlined",
        "color": "#059669",
        "input_schema": {
            "properties": {
                "json_string": {
                    "type": "string",
                    "title": "JSON String",
                    "description": "JSON string to parse"
                },
                "path": {
                    "type": "string",
                    "title": "JSON Path",
                    "description": "Path to extract (e.g., $.data.items[0].name)"
                }
            },
            "required": ["json_string"]
        },
        "output_schema": {
            "properties": {
                "parsed_data": {
                    "type": "object",
                    "description": "Parsed JSON data"
                },
                "extracted_value": {
                    "type": "string",
                    "description": "Extracted value from path"
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether parsing was successful"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 32,
        "documentation": "JSON parser for extracting structured data",
        "examples": {
            "basic": {
                "json_string": '{"name": "John", "age": 30}',
                "path": "$.name"
            }
        }
    },
    {
        "component_type": "delay",
        "name": "delay",
        "display_name": "Delay",
        "description": "Add a time delay in the workflow execution",
        "category": "Logic",
        "icon": "ClockCircleOutlined",
        "color": "#7c2d12",
        "input_schema": {
            "properties": {
                "duration": {
                    "type": "integer",
                    "title": "Duration (ms)",
                    "description": "Delay duration in milliseconds",
                    "default": 1000,
                    "minimum": 100,
                    "maximum": 60000
                },
                "message": {
                    "type": "string",
                    "title": "Message",
                    "description": "Optional message to pass through"
                }
            },
            "required": ["duration"]
        },
        "output_schema": {
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Message passed through"
                },
                "delay_completed": {
                    "type": "boolean",
                    "description": "Whether delay was completed"
                },
                "actual_duration": {
                    "type": "integer",
                    "description": "Actual delay duration"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 21,
        "documentation": "Delay component for timing control",
        "examples": {
            "basic": {
                "duration": 2000,
                "message": "Processing..."
            }
        }
    },
    {
        "component_type": "webhook",
        "name": "webhook",
        "display_name": "Webhook Trigger",
        "description": "Trigger workflows from external webhook calls",
        "category": "Network",
        "icon": "SendOutlined",
        "color": "#dc2626",
        "input_schema": {
            "properties": {
                "url": {
                    "type": "string",
                    "title": "Webhook URL",
                    "description": "URL to send webhook payload"
                },
                "method": {
                    "type": "string",
                    "title": "HTTP Method",
                    "enum": ["POST", "PUT", "PATCH"],
                    "default": "POST"
                },
                "headers": {
                    "type": "object",
                    "title": "Headers",
                    "description": "HTTP headers to include"
                },
                "payload": {
                    "type": "object",
                    "title": "Payload",
                    "description": "Data to send in request body"
                }
            },
            "required": ["url"]
        },
        "output_schema": {
            "properties": {
                "response_status": {
                    "type": "integer",
                    "description": "HTTP response status code"
                },
                "response_body": {
                    "type": "object",
                    "description": "Response body data"
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether webhook was successful"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": True,
        "sort_order": 35,
        "documentation": "Webhook component for external integrations",
        "examples": {
            "basic": {
                "url": "https://webhook.site/unique-id",
                "method": "POST",
                "payload": {"message": "Hello World"}
            }
        }
    },
    {
        "component_type": "email_sender",
        "name": "email_sender",
        "display_name": "Email Sender",
        "description": "Send emails via SMTP or email service APIs",
        "category": "Network",
        "icon": "MailOutlined",
        "color": "#0891b2",
        "input_schema": {
            "properties": {
                "to": {
                    "type": "string",
                    "title": "To Email",
                    "description": "Recipient email address"
                },
                "subject": {
                    "type": "string",
                    "title": "Subject",
                    "description": "Email subject line"
                },
                "body": {
                    "type": "string",
                    "title": "Email Body",
                    "description": "Email content"
                },
                "smtp_server": {
                    "type": "string",
                    "title": "SMTP Server",
                    "description": "SMTP server hostname",
                    "default": "smtp.gmail.com"
                },
                "smtp_port": {
                    "type": "integer",
                    "title": "SMTP Port",
                    "description": "SMTP server port",
                    "default": 587
                },
                "username": {
                    "type": "string",
                    "title": "Username",
                    "description": "SMTP username"
                },
                "password": {
                    "type": "string",
                    "title": "Password",
                    "description": "SMTP password",
                    "format": "password"
                }
            },
            "required": ["to", "subject", "body", "username", "password"]
        },
        "output_schema": {
            "properties": {
                "sent": {
                    "type": "boolean",
                    "description": "Whether email was sent successfully"
                },
                "message_id": {
                    "type": "string",
                    "description": "Email message ID"
                },
                "error": {
                    "type": "string",
                    "description": "Error message if sending failed"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": True,
        "sort_order": 36,
        "documentation": "Email sender component for notifications",
        "examples": {
            "basic": {
                "to": "user@example.com",
                "subject": "FlowStudio Notification",
                "body": "Your workflow has completed successfully."
            }
        }
    },
    {
        "component_type": "code_executor",
        "name": "code_executor",
        "display_name": "Code Executor",
        "description": "Execute custom Python code snippets",
        "category": "Programming",
        "icon": "CodeOutlined",
        "color": "#7c3aed",
        "input_schema": {
            "properties": {
                "code": {
                    "type": "string",
                    "title": "Python Code",
                    "description": "Python code to execute"
                },
                "inputs": {
                    "type": "object",
                    "title": "Input Variables",
                    "description": "Variables to pass to the code"
                },
                "timeout": {
                    "type": "integer",
                    "title": "Timeout (seconds)",
                    "description": "Maximum execution time",
                    "default": 30,
                    "minimum": 1,
                    "maximum": 300
                }
            },
            "required": ["code"]
        },
        "output_schema": {
            "properties": {
                "result": {
                    "type": "object",
                    "description": "Code execution result"
                },
                "stdout": {
                    "type": "string",
                    "description": "Standard output"
                },
                "stderr": {
                    "type": "string",
                    "description": "Standard error"
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether execution was successful"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": True,
        "sort_order": 40,
        "documentation": "Code executor for custom Python logic",
        "examples": {
            "basic": {
                "code": "result = inputs.get('x', 0) * 2\nprint(f'Result: {result}')",
                "inputs": {"x": 5}
            }
        }
    }
]

async def add_new_components():
    """Add new component templates to the database"""
    print("Adding new FlowStudio component templates...")
    
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
                template for template in NEW_COMPONENT_TEMPLATES 
                if template['component_type'] not in existing_set
            ]
            
            if not new_templates:
                print("All new components already exist in database")
                return
            
            # Insert new templates
            for template_data in new_templates:
                template = ComponentTemplate(**template_data)
                session.add(template)
                print(f"  ✅ Added: {template_data['display_name']}")
            
            await session.commit()
            print(f"\n🎉 Successfully added {len(new_templates)} new component templates!")
            
            # Show total count
            total_count = await session.execute(
                text("SELECT COUNT(*) FROM flow_studio_component_templates")
            )
            total = total_count.scalar()
            print(f"📊 Total components in library: {total}")
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error adding new templates: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_new_components())