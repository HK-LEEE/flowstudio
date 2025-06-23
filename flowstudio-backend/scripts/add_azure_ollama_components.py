#!/usr/bin/env python3
"""
Add Azure OpenAI and Ollama Component Templates
Expands the AI/LLM section with additional AI providers
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

# Azure OpenAI and Ollama component template definitions
AZURE_OLLAMA_TEMPLATES = [
    {
        "component_type": "azure_openai_llm",
        "name": "azure_openai_llm",
        "display_name": "Azure OpenAI",
        "description": "Generate text using Azure OpenAI service",
        "category": "AI/LLM",
        "icon": "RobotOutlined",
        "color": "#0078d4",
        "input_schema": {
            "properties": {
                "prompt": {
                    "type": "string",
                    "title": "Prompt",
                    "description": "Text prompt for Azure OpenAI"
                },
                "system_message": {
                    "type": "string",
                    "title": "System Message",
                    "description": "System message to guide the AI"
                },
                "azure_endpoint": {
                    "type": "string",
                    "title": "Azure Endpoint",
                    "description": "Azure OpenAI service endpoint URL"
                },
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Azure OpenAI API key",
                    "format": "password"
                },
                "deployment_name": {
                    "type": "string",
                    "title": "Deployment Name",
                    "description": "Azure OpenAI deployment name"
                },
                "api_version": {
                    "type": "string",
                    "title": "API Version",
                    "description": "Azure OpenAI API version",
                    "default": "2024-02-15-preview"
                },
                "max_tokens": {
                    "type": "integer",
                    "title": "Max Tokens",
                    "description": "Maximum response length",
                    "default": 1000,
                    "minimum": 1,
                    "maximum": 8000
                },
                "temperature": {
                    "type": "number",
                    "title": "Temperature",
                    "description": "Randomness of responses (0-2)",
                    "default": 0.7,
                    "minimum": 0,
                    "maximum": 2
                }
            },
            "required": ["prompt", "azure_endpoint", "api_key", "deployment_name"]
        },
        "output_schema": {
            "properties": {
                "response": {
                    "type": "string",
                    "description": "Azure OpenAI response"
                },
                "model_used": {
                    "type": "string",
                    "description": "Model deployment used"
                },
                "usage": {
                    "type": "object",
                    "description": "Token usage statistics"
                },
                "finish_reason": {
                    "type": "string",
                    "description": "Reason for completion"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 16,
        "documentation": "Azure OpenAI component for enterprise AI generation",
        "examples": {
            "basic": {
                "prompt": "Explain machine learning concepts",
                "deployment_name": "gpt-35-turbo",
                "temperature": 0.7
            }
        }
    },
    {
        "component_type": "ollama_llm",
        "name": "ollama_llm",
        "display_name": "Ollama LLM",
        "description": "Run local LLM models using Ollama",
        "category": "AI/LLM",
        "icon": "RobotOutlined",
        "color": "#ff6b35",
        "input_schema": {
            "properties": {
                "prompt": {
                    "type": "string",
                    "title": "Prompt",
                    "description": "Text prompt for Ollama model"
                },
                "system_message": {
                    "type": "string",
                    "title": "System Message",
                    "description": "System message to guide the model"
                },
                "ollama_base_url": {
                    "type": "string",
                    "title": "Ollama Base URL",
                    "description": "Ollama server URL",
                    "default": "http://localhost:11434"
                },
                "model": {
                    "type": "string",
                    "title": "Model",
                    "description": "Ollama model name",
                    "default": "llama2",
                    "enum": [
                        "llama2", "llama2:13b", "llama2:70b",
                        "codellama", "codellama:13b", "codellama:34b",
                        "mistral", "mistral:7b",
                        "mixtral", "mixtral:8x7b",
                        "phi", "vicuna", "orca-mini",
                        "gemma", "gemma:7b"
                    ]
                },
                "temperature": {
                    "type": "number",
                    "title": "Temperature",
                    "description": "Randomness of responses (0-1)",
                    "default": 0.7,
                    "minimum": 0,
                    "maximum": 1
                },
                "num_predict": {
                    "type": "integer",
                    "title": "Max Tokens",
                    "description": "Maximum number of tokens to generate",
                    "default": 1000,
                    "minimum": 1,
                    "maximum": 4096
                },
                "top_p": {
                    "type": "number",
                    "title": "Top P",
                    "description": "Nucleus sampling parameter",
                    "default": 0.9,
                    "minimum": 0,
                    "maximum": 1
                },
                "stream": {
                    "type": "boolean",
                    "title": "Stream Response",
                    "description": "Stream the response",
                    "default": False
                }
            },
            "required": ["prompt", "model"]
        },
        "output_schema": {
            "properties": {
                "response": {
                    "type": "string",
                    "description": "Ollama model response"
                },
                "model_used": {
                    "type": "string",
                    "description": "Model name used for generation"
                },
                "total_duration": {
                    "type": "integer",
                    "description": "Total generation time in nanoseconds"
                },
                "eval_count": {
                    "type": "integer",
                    "description": "Number of tokens evaluated"
                },
                "eval_duration": {
                    "type": "integer",
                    "description": "Time spent evaluating in nanoseconds"
                }
            }
        },
        "version": "1.0.0",
        "is_active": True,
        "is_beta": False,
        "sort_order": 17,
        "documentation": "Ollama component for local LLM execution",
        "examples": {
            "basic": {
                "prompt": "Write a Python function to sort a list",
                "model": "codellama",
                "temperature": 0.3
            },
            "chat": {
                "prompt": "What is the capital of France?",
                "model": "llama2",
                "temperature": 0.7
            }
        }
    }
]

async def add_azure_ollama_components():
    """Add Azure OpenAI and Ollama component templates to the database"""
    print("Adding Azure OpenAI and Ollama component templates...")
    
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
                template for template in AZURE_OLLAMA_TEMPLATES 
                if template['component_type'] not in existing_set
            ]
            
            if not new_templates:
                print("Azure OpenAI and Ollama components already exist in database")
                return
            
            # Insert new templates
            for template_data in new_templates:
                template = ComponentTemplate(**template_data)
                session.add(template)
                print(f"  ✅ Added: {template_data['display_name']}")
            
            await session.commit()
            print(f"\n🎉 Successfully added {len(new_templates)} AI/LLM component templates!")
            
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
    asyncio.run(add_azure_ollama_components())