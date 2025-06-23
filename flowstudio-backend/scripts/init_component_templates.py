#!/usr/bin/env python3
"""
Initialize FlowStudio Component Templates Database
Populates the component_templates table with all available component types
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.component_template import ComponentTemplate
from app.db.database import Base, engine
from app.core.config import settings

# Component template definitions
COMPONENT_TEMPLATES = [
    {
        "component_type": "text_input",
        "name": "text_input",
        "display_name": "Text Input",
        "description": "Basic text input component for entering text data",
        "category": "Input/Output",
        "icon": "EditOutlined",
        "color": "#1890ff",
        "input_schema": {
            "properties": {
                "text": {
                    "type": "string",
                    "title": "Text Input",
                    "description": "Enter your text here"
                }
            },
            "required": ["text"]
        },
        "output_schema": {
            "properties": {
                "output": {
                    "type": "object",
                    "description": "Combined output containing all variables",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "The input text"
                        },
                        "length": {
                            "type": "integer",
                            "description": "Text length"
                        },
                        "word_count": {
                            "type": "integer",
                            "description": "Number of words"
                        }
                    }
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 1,
        "documentation": "Text input component for capturing user text input",
        "examples": {
            "basic": {
                "text": "Hello, world!"
            }
        }
    },
    {
        "component_type": "text_output",
        "name": "text_output",
        "display_name": "Text Output",
        "description": "Display text output in the flow",
        "category": "Input/Output",
        "icon": "FileTextOutlined",
        "color": "#52c41a",
        "input_schema": {
            "properties": {
                "text": {
                    "type": "string",
                    "title": "Text to Display",
                    "description": "Text to output"
                }
            },
            "required": ["text"]
        },
        "output_schema": {
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The displayed text"
                },
                "formatted_output": {
                    "type": "string",
                    "description": "Formatted text output"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 2,
        "documentation": "Text output component for displaying results",
        "examples": {
            "basic": {
                "text": "Output: Hello, world!"
            }
        }
    },
    {
        "component_type": "openai_llm",
        "name": "openai_llm",
        "display_name": "OpenAI LLM",
        "description": "Generate text using OpenAI's language models",
        "category": "AI/LLM",
        "icon": "RobotOutlined",
        "color": "#722ed1",
        "input_schema": {
            "properties": {
                "prompt": {
                    "type": "string",
                    "title": "Prompt",
                    "description": "Text prompt for the AI model"
                },
                "system_message": {
                    "type": "string",
                    "title": "System Message",
                    "description": "System message to guide the AI"
                },
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "OpenAI API key",
                    "format": "password"
                },
                "model": {
                    "type": "string",
                    "title": "Model",
                    "description": "OpenAI model to use",
                    "default": "gpt-3.5-turbo",
                    "enum": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"]
                },
                "temperature": {
                    "type": "number",
                    "title": "Temperature",
                    "description": "Creativity level (0-1)",
                    "default": 0.7,
                    "minimum": 0,
                    "maximum": 1
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
                    "description": "AI model response"
                },
                "model_used": {
                    "type": "string",
                    "description": "Model used for generation"
                },
                "token_usage": {
                    "type": "object",
                    "description": "Token usage statistics"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 10,
        "documentation": "OpenAI LLM component for text generation",
        "examples": {
            "basic": {
                "prompt": "Write a short poem about AI",
                "model": "gpt-3.5-turbo"
            }
        }
    },
    {
        "component_type": "prompt_template",
        "name": "prompt_template",
        "display_name": "Prompt Template",
        "description": "Create dynamic prompts with variable substitution",
        "category": "Text Processing",
        "icon": "FieldStringOutlined",
        "color": "#fa8c16",
        "input_schema": {
            "properties": {
                "template": {
                    "type": "string",
                    "title": "Template",
                    "description": "Template with {variable} placeholders"
                },
                "variables": {
                    "type": "object",
                    "title": "Variables",
                    "description": "Variables to substitute in template"
                }
            },
            "required": ["template"]
        },
        "output_schema": {
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Rendered prompt"
                },
                "template_used": {
                    "type": "string",
                    "description": "Original template"
                },
                "variables_applied": {
                    "type": "object",
                    "description": "Variables that were applied"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 11,
        "documentation": "Prompt template component for dynamic prompts",
        "examples": {
            "basic": {
                "template": "Hello {name}, how are you today?",
                "variables": {"name": "Alice"}
            }
        }
    },
    {
        "component_type": "conditional",
        "name": "conditional",
        "display_name": "Conditional Logic",
        "description": "Conditional branching based on data values",
        "category": "Logic",
        "icon": "BranchesOutlined",
        "color": "#f5222d",
        "input_schema": {
            "properties": {
                "condition_type": {
                    "type": "string",
                    "title": "Condition Type",
                    "enum": ["equals", "not_equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty"],
                    "default": "equals"
                },
                "left_value": {
                    "type": "string",
                    "title": "Left Value",
                    "description": "Value to compare"
                },
                "right_value": {
                    "type": "string",
                    "title": "Right Value",
                    "description": "Value to compare against"
                }
            },
            "required": ["condition_type", "left_value"]
        },
        "output_schema": {
            "properties": {
                "condition_result": {
                    "type": "boolean",
                    "description": "Result of condition evaluation"
                },
                "left_value": {
                    "type": "string",
                    "description": "Left side value"
                },
                "right_value": {
                    "type": "string",
                    "description": "Right side value"
                },
                "condition_type": {
                    "type": "string",
                    "description": "Type of condition evaluated"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 20,
        "documentation": "Conditional logic component for flow branching",
        "examples": {
            "basic": {
                "condition_type": "equals",
                "left_value": "hello",
                "right_value": "hello"
            }
        }
    },
    {
        "component_type": "text_processor",
        "name": "text_processor",
        "display_name": "Text Processor",
        "description": "Process and transform text data",
        "category": "Text Processing",
        "icon": "FormatPainterOutlined",
        "color": "#13c2c2",
        "input_schema": {
            "properties": {
                "text": {
                    "type": "string",
                    "title": "Input Text",
                    "description": "Text to process"
                },
                "operation": {
                    "type": "string",
                    "title": "Operation",
                    "enum": ["uppercase", "lowercase", "title_case", "trim", "remove_spaces", "reverse", "word_count", "char_count"],
                    "default": "uppercase"
                }
            },
            "required": ["text", "operation"]
        },
        "output_schema": {
            "properties": {
                "processed_text": {
                    "type": "string",
                    "description": "Processed text result"
                },
                "original_text": {
                    "type": "string",
                    "description": "Original input text"
                },
                "operation": {
                    "type": "string",
                    "description": "Operation that was applied"
                },
                "length_change": {
                    "type": "integer",
                    "description": "Change in text length"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 12,
        "documentation": "Text processor component for text transformations",
        "examples": {
            "basic": {
                "text": "hello world",
                "operation": "uppercase"
            }
        }
    },
    {
        "component_type": "file_input",
        "name": "file_input",
        "display_name": "File Input",
        "description": "Read data from files",
        "category": "Input/Output",
        "icon": "FileAddOutlined",
        "color": "#2f54eb",
        "input_schema": {
            "properties": {
                "file_path": {
                    "type": "string",
                    "title": "File Path",
                    "description": "Path to the file to read"
                },
                "file_type": {
                    "type": "string",
                    "title": "File Type",
                    "enum": ["text", "json", "csv"],
                    "default": "text"
                }
            },
            "required": ["file_path", "file_type"]
        },
        "output_schema": {
            "properties": {
                "content": {
                    "type": "string",
                    "description": "File content as text"
                },
                "data": {
                    "type": "object",
                    "description": "Parsed file data (for JSON/CSV)"
                },
                "file_path": {
                    "type": "string",
                    "description": "Path to the file"
                },
                "file_size": {
                    "type": "integer",
                    "description": "File size in bytes"
                },
                "file_type": {
                    "type": "string",
                    "description": "Type of file read"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 3,
        "documentation": "File input component for reading files",
        "examples": {
            "basic": {
                "file_path": "/path/to/file.txt",
                "file_type": "text"
            }
        }
    },
    {
        "component_type": "file_output",
        "name": "file_output",
        "display_name": "File Output",
        "description": "Write data to files",
        "category": "Input/Output",
        "icon": "FilePdfOutlined",
        "color": "#52c41a",
        "input_schema": {
            "properties": {
                "file_path": {
                    "type": "string",
                    "title": "File Path",
                    "description": "Path where to save the file"
                },
                "content": {
                    "type": "string",
                    "title": "Content",
                    "description": "Content to write to file"
                },
                "file_type": {
                    "type": "string",
                    "title": "File Type",
                    "enum": ["text", "json"],
                    "default": "text"
                }
            },
            "required": ["file_path", "content", "file_type"]
        },
        "output_schema": {
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the saved file"
                },
                "file_size": {
                    "type": "integer",
                    "description": "Size of the saved file"
                },
                "file_type": {
                    "type": "string",
                    "description": "Type of file saved"
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether file was saved successfully"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 4,
        "documentation": "File output component for writing files",
        "examples": {
            "basic": {
                "file_path": "/path/to/output.txt",
                "content": "Hello, world!",
                "file_type": "text"
            }
        }
    },
    {
        "component_type": "http_request",
        "name": "http_request",
        "display_name": "HTTP Request",
        "description": "Make HTTP API requests",
        "category": "Network",
        "icon": "ApiOutlined",
        "color": "#eb2f96",
        "input_schema": {
            "properties": {
                "url": {
                    "type": "string",
                    "title": "URL",
                    "description": "API endpoint URL"
                },
                "method": {
                    "type": "string",
                    "title": "Method",
                    "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                    "default": "GET"
                },
                "headers": {
                    "type": "object",
                    "title": "Headers",
                    "description": "HTTP headers"
                },
                "params": {
                    "type": "object",
                    "title": "Query Parameters",
                    "description": "URL query parameters"
                },
                "data": {
                    "type": "object",
                    "title": "Request Body",
                    "description": "Request body data"
                },
                "timeout": {
                    "type": "integer",
                    "title": "Timeout",
                    "description": "Request timeout in seconds",
                    "default": 30
                }
            },
            "required": ["url"]
        },
        "output_schema": {
            "properties": {
                "status_code": {
                    "type": "integer",
                    "description": "HTTP status code"
                },
                "headers": {
                    "type": "object",
                    "description": "Response headers"
                },
                "data": {
                    "type": "object",
                    "description": "Parsed response data"
                },
                "text": {
                    "type": "string",
                    "description": "Raw response text"
                },
                "url": {
                    "type": "string",
                    "description": "Final URL after redirects"
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether request was successful"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 30,
        "documentation": "HTTP request component for API calls",
        "examples": {
            "basic": {
                "url": "https://api.example.com/data",
                "method": "GET"
            }
        }
    },
    {
        "component_type": "data_transform",
        "name": "data_transform",
        "display_name": "Data Transform",
        "description": "Transform and manipulate data structures",
        "category": "Data Processing",
        "icon": "FunctionOutlined",
        "color": "#722ed1",
        "input_schema": {
            "properties": {
                "data": {
                    "type": "object",
                    "title": "Input Data",
                    "description": "Data to transform"
                },
                "operation": {
                    "type": "string",
                    "title": "Operation",
                    "enum": ["filter", "map", "aggregate"],
                    "default": "filter"
                },
                "config": {
                    "type": "object",
                    "title": "Operation Config",
                    "description": "Configuration for the operation"
                }
            },
            "required": ["data", "operation"]
        },
        "output_schema": {
            "properties": {
                "data": {
                    "type": "object",
                    "description": "Transformed data result"
                },
                "operation": {
                    "type": "string",
                    "description": "Operation that was applied"
                },
                "original_count": {
                    "type": "integer",
                    "description": "Original data item count"
                },
                "result_count": {
                    "type": "integer",
                    "description": "Result data item count"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 31,
        "documentation": "Data transformation component for data manipulation",
        "examples": {
            "basic": {
                "data": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}],
                "operation": "filter",
                "config": {"key": "age", "value": 25, "operator": "greater_than"}
            }
        }
    }
]

async def init_component_templates():
    """Initialize component templates in the database"""
    print("Initializing FlowStudio component templates...")
    
    # Use existing engine from database module
    
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Check if templates already exist
            existing_count = await session.execute(
                text("SELECT COUNT(*) FROM flow_studio_component_templates")
            )
            count = existing_count.scalar()
            
            if count > 0:
                print(f"Found {count} existing component templates")
                choice = input("Do you want to recreate all templates? (y/N): ")
                if choice.lower() != 'y':
                    print("Skipping initialization")
                    return
                
                # Delete existing templates
                await session.execute(text("DELETE FROM flow_studio_component_templates"))
                print("Deleted existing templates")
            
            # Insert new templates
            for template_data in COMPONENT_TEMPLATES:
                template = ComponentTemplate(**template_data)
                session.add(template)
            
            await session.commit()
            print(f"Successfully initialized {len(COMPONENT_TEMPLATES)} component templates")
            
            # Verify
            result = await session.execute(
                text("SELECT component_type, display_name FROM flow_studio_component_templates ORDER BY sort_order")
            )
            templates = result.fetchall()
            
            print("\nCreated templates:")
            for component_type, display_name in templates:
                print(f"  - {component_type}: {display_name}")
                
        except Exception as e:
            await session.rollback()
            print(f"Error initializing templates: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_component_templates())