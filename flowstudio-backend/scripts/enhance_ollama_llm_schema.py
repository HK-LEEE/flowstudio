#!/usr/bin/env python3
"""
Enhance Ollama LLM Component Schema
Updates the Ollama LLM component with advanced configuration, variable support, and enhanced UI features
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

# Enhanced Ollama LLM Schema with unified configuration support
ENHANCED_OLLAMA_LLM_SCHEMA = {
    "component_type": "ollama_llm",
    "name": "ollama_llm",
    "display_name": "Ollama LLM",
    "description": "Advanced local LLM execution with Ollama - supports variable substitution, connection awareness, and performance monitoring",
    "category": "AI/LLM",
    "icon": "RobotOutlined",
    "color": "#ff6b35",
    "input_schema": {
        "properties": {
            "prompt": {
                "type": "string",
                "title": "Prompt",
                "description": "Text prompt for the Ollama model with {variable} support",
                "required": True,
                "is_handle": True,
                "field_type": "textarea",
                "section": "prompt",
                "supports_variables": True,
                "variable_detection": True,
                "show_variable_analysis": True,
                "placeholder": "Enter your prompt here. Use {variable} for dynamic content."
            },
            "system_message": {
                "type": "string",
                "title": "System Message",
                "description": "System message to guide the model behavior with {variable} support",
                "required": False,
                "is_handle": True,
                "field_type": "textarea",
                "section": "prompt",
                "supports_variables": True,
                "variable_detection": True,
                "placeholder": "You are a helpful assistant. Use {context} if available."
            },
            "input_data": {
                "type": "object",
                "title": "Connected Input Data",
                "description": "Data automatically received from connected nodes",
                "is_handle": True,
                "section": "connections",
                "is_connection_aware": True,
                "auto_mapping": True,
                "show_connection_status": True
            },
            "variable_mappings": {
                "type": "array",
                "title": "Variable Mappings",
                "description": "Map input data fields to prompt/system message variables",
                "items": {
                    "type": "object",
                    "properties": {
                        "input_field": {
                            "type": "string",
                            "title": "Input Field",
                            "description": "Field name from connected node output"
                        },
                        "variable_name": {
                            "type": "string",
                            "title": "Variable Name",
                            "description": "Variable name in prompt/system message (without {})"
                        },
                        "default_value": {
                            "type": "string",
                            "title": "Default Value",
                            "description": "Fallback value if input field is missing or empty",
                            "default": ""
                        },
                        "transform": {
                            "type": "string",
                            "title": "Transform",
                            "description": "Apply transformation to the value",
                            "enum": ["none", "uppercase", "lowercase", "title_case", "trim"],
                            "default": "none"
                        }
                    },
                    "required": ["input_field", "variable_name"]
                },
                "default": [],
                "section": "mapping",
                "auto_generate": True,
                "smart_suggestions": True
            },
            "manual_variables": {
                "type": "object",
                "title": "Manual Variables",
                "description": "Static variables that don't come from connected nodes",
                "default": {},
                "section": "manual",
                "supports_dynamic_keys": True,
                "key_value_editor": True
            },
            "model": {
                "type": "string",
                "title": "Model",
                "description": "Ollama model name to use for generation",
                "enum": [
                    "llama2", "llama2:7b", "llama2:13b", "llama2:70b",
                    "codellama", "codellama:7b", "codellama:13b", "codellama:34b",
                    "mistral", "mistral:7b", "mistral:instruct",
                    "mixtral", "mixtral:8x7b", "mixtral:8x22b",
                    "phi", "phi:2.7b", "phi:3.8b",
                    "vicuna", "vicuna:7b", "vicuna:13b",
                    "orca-mini", "orca-mini:3b", "orca-mini:7b",
                    "gemma", "gemma:2b", "gemma:7b",
                    "qwen", "qwen:7b", "qwen:14b",
                    "neural-chat", "neural-chat:7b",
                    "starling-lm", "starling-lm:7b",
                    "openchat", "openchat:7b"
                ],
                "default": "llama2",
                "required": True,
                "section": "model",
                "field_type": "select",
                "is_handle": False
            },
            "ollama_base_url": {
                "type": "string",
                "title": "Ollama Server URL",
                "description": "Base URL of the Ollama server",
                "default": "http://localhost:11434",
                "required": False,
                "section": "connection",
                "field_type": "text",
                "is_handle": False,
                "validation": "url"
            },
            "temperature": {
                "type": "number",
                "title": "Temperature",
                "description": "Randomness of responses (0.0 = deterministic, 1.0 = very random)",
                "default": 0.7,
                "minimum": 0.0,
                "maximum": 2.0,
                "required": False,
                "section": "parameters",
                "field_type": "slider",
                "is_handle": False,
                "step": 0.1
            },
            "num_predict": {
                "type": "integer",
                "title": "Max Tokens",
                "description": "Maximum number of tokens to generate (-1 for unlimited)",
                "default": 1000,
                "minimum": -1,
                "maximum": 8192,
                "required": False,
                "section": "parameters",
                "field_type": "number",
                "is_handle": False
            },
            "top_p": {
                "type": "number",
                "title": "Top P",
                "description": "Nucleus sampling parameter (0.1 = only top 10% of tokens)",
                "default": 0.9,
                "minimum": 0.0,
                "maximum": 1.0,
                "required": False,
                "section": "parameters",
                "field_type": "slider",
                "is_handle": False,
                "step": 0.05
            },
            "top_k": {
                "type": "integer",
                "title": "Top K",
                "description": "Limits token selection to top K choices (0 = disabled)",
                "default": 40,
                "minimum": 0,
                "maximum": 100,
                "required": False,
                "section": "advanced",
                "field_type": "number",
                "is_handle": False,
                "advanced": True
            },
            "repeat_penalty": {
                "type": "number",
                "title": "Repeat Penalty",
                "description": "Penalty for repeating tokens (1.0 = no penalty)",
                "default": 1.1,
                "minimum": 0.0,
                "maximum": 2.0,
                "required": False,
                "section": "advanced",
                "field_type": "slider",
                "is_handle": False,
                "step": 0.1,
                "advanced": True
            },
            "stream": {
                "type": "boolean",
                "title": "Enable Streaming",
                "description": "Stream response tokens as they are generated",
                "default": False,
                "required": False,
                "section": "advanced",
                "field_type": "switch",
                "is_handle": False,
                "advanced": True
            },
            "timeout": {
                "type": "integer",
                "title": "Timeout (seconds)",
                "description": "Maximum time to wait for response",
                "default": 120,
                "minimum": 10,
                "maximum": 600,
                "required": False,
                "section": "advanced",
                "field_type": "number",
                "is_handle": False,
                "advanced": True
            }
        },
        "required": ["prompt", "model"],
        "sections": {
            "prompt": {
                "title": "Prompt Configuration",
                "description": "Define prompts and system messages with variable support",
                "icon": "MessageOutlined",
                "color": "#ff6b35",
                "collapsible": False,
                "defaultExpanded": True,
                "features": ["variable_detection", "syntax_highlighting", "placeholder_insertion"]
            },
            "model": {
                "title": "Model Selection",
                "description": "Choose the Ollama model for text generation",
                "icon": "RobotOutlined",
                "color": "#722ed1",
                "collapsible": True,
                "defaultExpanded": True,
                "features": ["model_validation", "performance_info", "capability_hints"]
            },
            "connections": {
                "title": "Input Connections",
                "description": "Data automatically received from connected nodes",
                "icon": "LinkOutlined",
                "color": "#52c41a",
                "collapsible": True,
                "defaultExpanded": True,
                "conditional_display": "has_connections",
                "features": ["connection_status", "real_time_data", "node_execution_tracking"]
            },
            "mapping": {
                "title": "Variable Mapping",
                "description": "Map connected data to prompt variables with smart suggestions",
                "icon": "NodeIndexOutlined",
                "color": "#1890ff",
                "collapsible": True,
                "defaultExpanded": True,
                "conditional_display": "has_connections",
                "features": ["auto_mapping", "smart_suggestions", "transformation_options"]
            },
            "manual": {
                "title": "Manual Variables",
                "description": "Add static variables that don't change based on connections",
                "icon": "PlusOutlined",
                "color": "#10b981",
                "collapsible": True,
                "defaultExpanded": False,
                "features": ["dynamic_key_value", "variable_validation", "quick_templates"]
            },
            "connection": {
                "title": "Ollama Server",
                "description": "Configure connection to Ollama server",
                "icon": "CloudServerOutlined",
                "color": "#1890ff",
                "collapsible": True,
                "defaultExpanded": False,
                "features": ["connection_test", "health_check", "server_info"]
            },
            "parameters": {
                "title": "Generation Parameters",
                "description": "Control how the model generates responses",
                "icon": "SettingOutlined",
                "color": "#faad14",
                "collapsible": True,
                "defaultExpanded": False,
                "features": ["parameter_presets", "real_time_preview", "performance_impact"]
            },
            "advanced": {
                "title": "Advanced Options",
                "description": "Advanced generation and performance settings",
                "icon": "ExperimentOutlined",
                "color": "#722ed1",
                "collapsible": True,
                "defaultExpanded": False,
                "advanced": True,
                "features": ["streaming_options", "timeout_settings", "debugging_tools"]
            }
        },
        "ui_features": {
            "real_time_preview": True,
            "variable_analysis": True,
            "connection_awareness": True,
            "auto_mapping": True,
            "smart_suggestions": True,
            "validation_feedback": True,
            "performance_monitoring": True,
            "model_health_check": True,
            "server_connectivity_test": True
        }
    },
    "output_schema": {
        "properties": {
            "response": {
                "type": "string",
                "title": "Generated Response",
                "description": "The text generated by the Ollama model"
            },
            "model_used": {
                "type": "string",
                "title": "Model Used",
                "description": "The actual model that generated the response"
            },
            "prompt_used": {
                "type": "string",
                "title": "Final Prompt",
                "description": "The prompt after variable substitution"
            },
            "system_message_used": {
                "type": "string",
                "title": "Final System Message",
                "description": "The system message after variable substitution"
            },
            "variables_applied": {
                "type": "object",
                "title": "Applied Variables",
                "description": "All variables that were successfully applied"
            },
            "generation_stats": {
                "type": "object",
                "title": "Generation Statistics",
                "description": "Detailed statistics about the generation process",
                "properties": {
                    "total_duration": {"type": "integer", "description": "Total time in nanoseconds"},
                    "eval_count": {"type": "integer", "description": "Number of tokens evaluated"},
                    "eval_duration": {"type": "integer", "description": "Time spent evaluating in nanoseconds"},
                    "prompt_eval_count": {"type": "integer", "description": "Number of prompt tokens"},
                    "prompt_eval_duration": {"type": "integer", "description": "Time spent on prompt evaluation"},
                    "tokens_per_second": {"type": "number", "description": "Generation speed"}
                }
            },
            "performance_metrics": {
                "type": "object",
                "title": "Performance Metrics",
                "description": "Performance and timing information",
                "properties": {
                    "execution_time_ms": {"type": "integer", "description": "Total execution time"},
                    "tokens_generated": {"type": "integer", "description": "Number of tokens generated"},
                    "average_token_time": {"type": "number", "description": "Average time per token"}
                }
            },
            "server_info": {
                "type": "object",
                "title": "Server Information",
                "description": "Information about the Ollama server response"
            },
            "context": {
                "type": "array",
                "title": "Context Vector",
                "description": "Context vector for conversation continuity",
                "items": {"type": "integer"}
            }
        }
    },
    "version": "2.0.0",
    "is_active": True,
    "is_beta": False,
    "sort_order": 17,
    "documentation": """
# Enhanced Ollama LLM Component

The most advanced local LLM component for running AI models with Ollama.

## Key Features

### 🤖 Local AI Execution
- Run powerful open-source models locally without API costs
- Support for 20+ popular models (Llama2, CodeLlama, Mistral, etc.)
- No data leaves your server - complete privacy

### 🎯 Intelligent Variable Support
- Use `{variable}` syntax in prompts and system messages
- Automatic variable detection and validation
- Smart mapping from connected node outputs

### 🔗 Connection Awareness
- Automatically detects connected nodes and available data
- Real-time status of connected node execution
- Seamless data flow integration

### ⚡ Performance Monitoring
- Real-time token generation speed tracking
- Detailed timing and performance metrics
- Memory and resource usage insights

### 🛠 Advanced Configuration
- Comprehensive parameter control (temperature, top_p, top_k, etc.)
- Streaming support for real-time responses
- Connection health checking and diagnostics

## Supported Models

### Code Generation
- **CodeLlama**: Specialized for programming tasks
- **Phind CodeLlama**: Enhanced coding assistant
- **WizardCoder**: Advanced code generation

### General Purpose
- **Llama 2**: Meta's flagship model (7B, 13B, 70B)
- **Mistral**: Fast and efficient French model
- **Mixtral**: Mixture of experts model
- **Vicuna**: GPT-4 level conversational AI

### Specialized Models
- **Orca Mini**: Microsoft's compact model
- **Neural Chat**: Intel's optimized model
- **Gemma**: Google's lightweight model

## Usage Patterns

### Simple Text Generation
```
Prompt: "Explain {topic} in simple terms"
Variables: topic = "quantum computing"
```

### Code Assistant
```
System: "You are an expert {language} programmer"
Prompt: "Write a function to {task}"
Variables: language = "Python", task = "sort a list"
```

### Context-Aware Chat
```
System: "You are a helpful assistant. Previous context: {context}"
Prompt: "User question: {user_input}"
Variables: context = "conversation history", user_input = "user message"
```

## Performance Tips

1. **Model Selection**: Larger models are more capable but slower
2. **Temperature**: Lower values (0.1-0.3) for factual responses, higher (0.7-1.0) for creative
3. **Token Limits**: Set appropriate limits to control response length
4. **Streaming**: Enable for real-time user experience with long responses

## Best Practices

- Use descriptive variable names: `{user_question}` not `{q}`
- Set meaningful default values for reliable fallbacks
- Test different models for your specific use case
- Monitor token generation speed for performance optimization
- Use system messages to guide model behavior consistently
""",
    "examples": {
        "enhanced_config": True,
        "supports_unified_ui": True,
        "simple_chat": {
            "prompt": "User: {user_message}\nAssistant:",
            "model": "llama2",
            "temperature": 0.7,
            "variable_mappings": [
                {
                    "input_field": "message",
                    "variable_name": "user_message",
                    "default_value": "Hello",
                    "transform": "trim"
                }
            ]
        },
        "code_assistant": {
            "system_message": "You are an expert {language} programmer. Provide clean, well-documented code.",
            "prompt": "Task: {task}\nRequirements: {requirements}",
            "model": "codellama",
            "temperature": 0.3,
            "top_p": 0.95,
            "manual_variables": {
                "language": "Python"
            },
            "variable_mappings": [
                {"input_field": "task", "variable_name": "task", "transform": "trim"},
                {"input_field": "requirements", "variable_name": "requirements", "default_value": "Standard implementation"}
            ]
        },
        "creative_writing": {
            "system_message": "You are a creative writing assistant. Write in the style of {style}.",
            "prompt": "Topic: {topic}\nGenre: {genre}\nLength: {length}",
            "model": "mistral",
            "temperature": 0.9,
            "top_p": 0.95,
            "num_predict": 2000,
            "manual_variables": {
                "style": "professional novelist",
                "genre": "science fiction",
                "length": "short story"
            }
        },
        "advanced_features": {
            "prompt": "Context: {context}\nQuery: {user_query}\nAdditional info: {metadata}",
            "model": "mixtral:8x7b",
            "temperature": 0.5,
            "top_k": 50,
            "repeat_penalty": 1.1,
            "stream": True,
            "timeout": 180,
            "variable_mappings": [
                {"input_field": "query", "variable_name": "user_query", "transform": "trim"},
                {"input_field": "context_data", "variable_name": "context", "transform": "none"}
            ]
        }
    }
}

async def enhance_ollama_llm_schema():
    """Enhance the Ollama LLM component with advanced unified configuration"""
    print("🚀 Enhancing Ollama LLM component with advanced configuration...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Find existing Ollama LLM component
            result = await session.execute(
                select(ComponentTemplate).where(
                    ComponentTemplate.component_type == "ollama_llm"
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"📝 Updating existing Ollama LLM component (ID: {existing.id})")
                
                # Update with enhanced schema
                for key, value in ENHANCED_OLLAMA_LLM_SCHEMA.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
                
                await session.commit()
                
                print("🎉 Ollama LLM component enhanced successfully!")
                print("\n✨ New Advanced Features:")
                print("   🤖 20+ supported Ollama models")
                print("   🎯 Intelligent variable detection in prompts")
                print("   🔗 Full connection awareness with real-time status")
                print("   🧠 Smart auto-mapping with field suggestions") 
                print("   ⚡ Performance monitoring and metrics")
                print("   🛠 8 organized configuration sections")
                print("   🔧 Advanced generation parameters")
                print("   📊 Detailed execution metadata")
                print("   🌐 Server health checking")
                
                # Show schema structure
                sections = ENHANCED_OLLAMA_LLM_SCHEMA["input_schema"]["sections"]
                print(f"\n📋 Configuration Sections ({len(sections)}):")
                for section_id, section_config in sections.items():
                    icon = section_config.get("icon", "")
                    title = section_config["title"]
                    features = section_config.get("features", [])
                    print(f"   {icon} {title}")
                    if features:
                        print(f"      Features: {', '.join(features)}")
                
                # Show model options
                models = ENHANCED_OLLAMA_LLM_SCHEMA["input_schema"]["properties"]["model"]["enum"]
                print(f"\n🤖 Supported Models ({len(models)}):")
                print(f"   Code: {[m for m in models if 'code' in m.lower()]}")
                print(f"   Chat: {[m for m in models if any(x in m.lower() for x in ['llama', 'mistral', 'vicuna'])]}")
                print(f"   Specialized: {[m for m in models if any(x in m.lower() for x in ['gemma', 'phi', 'orca'])]}")
                
                # Show UI features
                ui_features = ENHANCED_OLLAMA_LLM_SCHEMA["input_schema"]["ui_features"]
                print(f"\n🎨 UI Features:")
                for feature, enabled in ui_features.items():
                    if enabled:
                        print(f"   ✅ {feature.replace('_', ' ').title()}")
                
            else:
                print("❌ Ollama LLM component not found!")
                print("Creating new enhanced Ollama LLM component...")
                
                # Create new component
                component = ComponentTemplate(**ENHANCED_OLLAMA_LLM_SCHEMA)
                session.add(component)
                await session.commit()
                
                print("✅ New enhanced Ollama LLM component created!")
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error enhancing Ollama LLM: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enhance_ollama_llm_schema())