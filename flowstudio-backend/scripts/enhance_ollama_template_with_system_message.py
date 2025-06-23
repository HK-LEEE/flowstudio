#!/usr/bin/env python3
"""
Enhance Ollama LLM Component with System Message Variable Support
Updates the Ollama LLM component to fully support variable templating in both Prompt and System Message
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

# Enhanced Ollama LLM Schema with System Message variable support
ENHANCED_OLLAMA_LLM_SCHEMA = {
    "component_type": "ollama_llm",
    "name": "ollama_llm", 
    "display_name": "Ollama LLM",
    "description": "Advanced local LLM with full variable support in both Prompt and System Message",
    "category": "AI/LLM",
    "icon": "RobotOutlined",
    "color": "#ff6b35",
    "input_schema": {
        "properties": {
            # Prompt with enhanced variable support
            "prompt": {
                "type": "string",
                "title": "User Prompt",
                "description": "Main prompt for the AI with full {variable} support",
                "required": True,
                "is_handle": True,
                "field_type": "textarea",
                "section": "prompt",
                "supports_variables": True,
                "variable_detection": True,
                "show_variable_analysis": True,
                "placeholder": "Enter your prompt here. Use {variable} for dynamic content.\nExample: Question: {user_input}\nContext: {context}",
                "rows": 4
            },
            
            # System Message with enhanced variable support  
            "system_message": {
                "type": "string",
                "title": "System Message", 
                "description": "System message with full {variable} support - defines AI behavior and context",
                "required": False,
                "is_handle": True,
                "field_type": "textarea",
                "section": "prompt",
                "supports_variables": True,
                "variable_detection": True,
                "show_variable_analysis": True,
                "placeholder": "Define AI behavior. Use {variable} for dynamic context.\nExample: You are a {role} expert in {domain}. Answer in {style} tone.",
                "rows": 3
            },
            
            # Input data from connected nodes
            "input_data": {
                "type": "object",
                "title": "Connected Input Data",
                "description": "Data automatically received from connected nodes",
                "is_handle": True,
                "section": "connections",
                "is_connection_aware": True,
                "auto_mapping": True,
                "show_connection_status": True,
                "required": False
            },
            
            # Variable mappings for connected data
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
                "smart_suggestions": True,
                "required": False
            },
            
            # Manual variables
            "manual_variables": {
                "type": "object",
                "title": "Manual Variables",
                "description": "Static variables that don't come from connected nodes",
                "default": {},
                "section": "manual",
                "supports_dynamic_keys": True,
                "key_value_editor": True,
                "required": False
            },
            
            # Ollama server configuration
            "ollama_base_url": {
                "type": "string",
                "title": "Ollama Server URL",
                "description": "Base URL of the Ollama server",
                "default": "http://localhost:11434",
                "required": False,
                "section": "server",
                "field_type": "text",
                "is_handle": False,
                "validation": "url",
                "test_connection": True
            },
            
            # Model selection with dynamic loading
            "model": {
                "type": "string",
                "title": "Model",
                "description": "Ollama model name (loaded dynamically from server)",
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
                "is_handle": False,
                "dynamic_options": True,
                "load_from_server": True
            },
            
            # Generation parameters
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
            
            # Advanced parameters (collapsed by default)
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
        
        # UI Sections Configuration
        "sections": {
            "prompt": {
                "title": "Prompt & System Message",
                "description": "Configure AI prompts with full variable support", 
                "icon": "MessageOutlined",
                "color": "#ff6b35",
                "collapsible": False,
                "defaultExpanded": True,
                "features": [
                    "variable_detection",
                    "syntax_highlighting", 
                    "placeholder_insertion",
                    "variable_validation",
                    "auto_completion"
                ]
            },
            
            "connections": {
                "title": "Connected Variables",
                "description": "Variables available from connected nodes",
                "icon": "LinkOutlined", 
                "color": "#52c41a",
                "collapsible": True,
                "defaultExpanded": True,
                "conditional_display": "has_connections",
                "features": [
                    "connection_status",
                    "real_time_data",
                    "variable_preview",
                    "data_type_info"
                ]
            },
            
            "mapping": {
                "title": "Variable Mapping",
                "description": "Map connected data to template variables",
                "icon": "NodeIndexOutlined",
                "color": "#1890ff", 
                "collapsible": True,
                "defaultExpanded": True,
                "conditional_display": "has_connections",
                "features": [
                    "auto_mapping",
                    "smart_suggestions", 
                    "transformation_options",
                    "validation_feedback"
                ]
            },
            
            "manual": {
                "title": "Manual Variables",
                "description": "Add static variables",
                "icon": "PlusOutlined",
                "color": "#10b981",
                "collapsible": True,
                "defaultExpanded": False,
                "features": [
                    "dynamic_key_value",
                    "variable_validation",
                    "quick_templates"
                ]
            },
            
            "server": {
                "title": "Ollama Server",
                "description": "Configure connection to Ollama server",
                "icon": "CloudServerOutlined",
                "color": "#1890ff",
                "collapsible": True,
                "defaultExpanded": False,
                "features": [
                    "connection_test",
                    "health_check",
                    "server_info",
                    "auto_discovery"
                ]
            },
            
            "model": {
                "title": "Model Selection",
                "description": "Choose Ollama model for text generation",
                "icon": "RobotOutlined",
                "color": "#722ed1",
                "collapsible": True,
                "defaultExpanded": False,
                "features": [
                    "dynamic_loading",
                    "model_validation",
                    "performance_info",
                    "capability_hints"
                ]
            },
            
            "parameters": {
                "title": "Generation Parameters",
                "description": "Control how the model generates responses",
                "icon": "SettingOutlined",
                "color": "#faad14",
                "collapsible": True,
                "defaultExpanded": False,
                "features": [
                    "parameter_presets",
                    "real_time_preview",
                    "performance_impact"
                ]
            },
            
            "advanced": {
                "title": "Advanced Options",
                "description": "Advanced generation settings",
                "icon": "ExperimentOutlined",
                "color": "#722ed1",
                "collapsible": True,
                "defaultExpanded": False,
                "advanced": True,
                "features": [
                    "streaming_options",
                    "timeout_settings",
                    "debugging_tools"
                ]
            }
        },
        
        # UI Features
        "ui_features": {
            "variable_templating": True,
            "real_time_preview": True,
            "variable_analysis": True,
            "connection_awareness": True,
            "auto_mapping": True,
            "smart_suggestions": True,
            "validation_feedback": True,
            "performance_monitoring": True,
            "model_health_check": True,
            "server_connectivity_test": True,
            "system_message_support": True,
            "dynamic_model_loading": True
        }
    },
    
    # Enhanced output schema
    "output_schema": {
        "properties": {
            "output": {
                "type": "object",
                "description": "Combined output containing all response data",
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
                    }
                }
            }
        }
    },
    
    "version": "2.1.0",
    "is_active": True,
    "is_beta": False,
    "sort_order": 17,
    
    "documentation": """
# Enhanced Ollama LLM Component

The most advanced local LLM component with full variable templating support.

## 🚀 Key Features

### 🎯 Variable Templating
- Use `{variable}` syntax in **both** Prompt and System Message
- Automatic variable detection and validation
- Smart auto-completion and suggestions
- Real-time variable status feedback

### 🔗 Connection Awareness  
- Automatically detects connected nodes and available variables
- Real-time display of available variables
- Smart mapping from connected node outputs
- Variable type detection and validation

### 🤖 System Message Support
- Full variable templating in System Message
- Define AI behavior dynamically based on context
- Examples:
  - `You are a {role} expert in {domain}`
  - `Answer in {style} tone. Context: {context}`

### ⚡ Dynamic Model Loading
- Real-time model list from Ollama server
- Connection testing and health checks
- Model performance information
- Automatic server discovery

## 📝 Usage Examples

### Basic Chat with Context
```
System Message: You are a helpful assistant in the {domain} field.
Prompt: User question: {user_input}
Context: {background_info}
```

### Code Assistant
```
System Message: You are an expert {language} programmer. Write clean, {style} code.
Prompt: Task: {task}
Requirements: {requirements}
```

### Dynamic Role-Based Assistant
```
System Message: You are a {role}. Your expertise is in {field}. 
Answer questions about {topic} in a {tone} manner.
Prompt: Question: {question}
Additional context: {context}
```

## 🛠 Best Practices

1. **Variable Naming**: Use descriptive names like `{user_question}` not `{q}`
2. **Default Values**: Set meaningful defaults for reliable fallbacks  
3. **System Messages**: Use to set consistent AI behavior and context
4. **Variable Validation**: Check variable availability before execution
5. **Performance**: Monitor token generation speed for optimization

## 🔧 Advanced Features

- **Streaming Support**: Real-time response generation
- **Performance Monitoring**: Token speed and timing metrics
- **Connection Health**: Automatic server status checking
- **Variable Debugging**: Real-time variable resolution preview
""",
    
    "examples": {
        "enhanced_system_message": True,
        "variable_templating": True,
        
        "chat_assistant": {
            "prompt": "User: {user_message}\\nContext: {context}\\nAssistant:",
            "system_message": "You are a helpful assistant specialized in {domain}. Answer in {style} tone.",
            "variable_mappings": [
                {"input_field": "message", "variable_name": "user_message", "transform": "trim"},
                {"input_field": "context_data", "variable_name": "context", "default_value": "general"}
            ],
            "manual_variables": {
                "domain": "technology",
                "style": "professional"
            }
        },
        
        "code_assistant": {
            "system_message": "You are an expert {language} programmer. Write clean, well-documented code in {style} style.",
            "prompt": "Task: {task}\\nRequirements: {requirements}\\nConstraints: {constraints}",
            "model": "codellama",
            "temperature": 0.3,
            "manual_variables": {
                "language": "Python",
                "style": "modern"
            }
        },
        
        "creative_writer": {
            "system_message": "You are a creative writing assistant. Write in the style of {author} for {genre} genre.",
            "prompt": "Topic: {topic}\\nMood: {mood}\\nLength: {length}",
            "model": "mistral",
            "temperature": 0.9,
            "num_predict": 2000
        }
    }
}

async def enhance_ollama_template():
    """Enhance the Ollama LLM component with System Message variable support"""
    print("🚀 Enhancing Ollama LLM component with System Message variable support...")
    
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
                print("\\n✨ New Features Added:")
                print("   🎯 Full variable templating in System Message")
                print("   🔗 Enhanced connection awareness") 
                print("   🤖 Dynamic model loading from server")
                print("   📊 Real-time variable validation")
                print("   🎨 8 organized configuration sections")
                print("   ⚡ Performance monitoring")
                print("   🌐 Server health checking")
                
                # Show sections
                sections = ENHANCED_OLLAMA_LLM_SCHEMA["input_schema"]["sections"]
                print(f"\\n📋 Configuration Sections ({len(sections)}):")
                for section_id, section_config in sections.items():
                    title = section_config["title"]
                    features = section_config.get("features", [])
                    print(f"   • {title}: {len(features)} features")
                
                # Show variable features
                print("\\n🎯 Variable Templating Features:")
                print("   ✅ {variable} syntax in Prompt")
                print("   ✅ {variable} syntax in System Message") 
                print("   ✅ Automatic variable detection")
                print("   ✅ Smart auto-completion")
                print("   ✅ Real-time validation")
                print("   ✅ Connected node awareness")
                
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
    asyncio.run(enhance_ollama_template())