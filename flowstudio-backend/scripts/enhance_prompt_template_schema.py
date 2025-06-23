#!/usr/bin/env python3
"""
Enhance Prompt Template Component Schema
Updates the prompt template with the most advanced schema configuration
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

# Enhanced Prompt Template Schema with full unified configuration support
ENHANCED_PROMPT_TEMPLATE_SCHEMA = {
    "component_type": "prompt_template",
    "name": "prompt_template",
    "display_name": "Prompt Template",
    "description": "Advanced prompt template with dynamic variable substitution, connection awareness, and real-time preview",
    "category": "Text Processing",
    "icon": "FieldStringOutlined",
    "color": "#fa8c16",
    "input_schema": {
        "properties": {
            "template": {
                "type": "string",
                "title": "Template Definition",
                "description": "Template with {variable} placeholders for dynamic content",
                "default": "Hello {input_text}! How can I help you today?",
                "required": True,
                "is_handle": False,
                "field_type": "textarea",
                "section": "template",
                "is_template_field": True,
                "supports_variables": True,
                "variable_detection": True,
                "show_variable_analysis": True
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
                "description": "Map input data fields to template variables with transformations",
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
                            "description": "Variable name in template (without {})"
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
                "default": [
                    {
                        "input_field": "message",
                        "variable_name": "input_text",
                        "default_value": "No input provided",
                        "transform": "trim"
                    }
                ],
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
            "validation_mode": {
                "type": "string",
                "title": "Validation Mode",
                "description": "How to handle missing or unmapped variables",
                "enum": ["strict", "warning", "ignore"],
                "default": "warning",
                "section": "advanced",
                "advanced": True
            },
            "preview_mode": {
                "type": "boolean",
                "title": "Enable Real-time Preview",
                "description": "Show live preview of rendered template",
                "default": True,
                "section": "advanced",
                "advanced": True
            }
        },
        "required": ["template"],
        "sections": {
            "template": {
                "title": "Template Definition",
                "description": "Define your prompt template with variable placeholders",
                "icon": "FieldStringOutlined",
                "color": "#fa8c16",
                "collapsible": False,
                "defaultExpanded": True,
                "features": ["variable_detection", "syntax_highlighting", "placeholder_insertion"]
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
                "description": "Map connected data to template variables with smart suggestions",
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
            "advanced": {
                "title": "Advanced Options",
                "description": "Advanced validation and preview settings",
                "icon": "SettingOutlined",
                "color": "#722ed1",
                "collapsible": True,
                "defaultExpanded": False,
                "advanced": True,
                "features": ["validation_modes", "preview_settings", "performance_options"]
            }
        },
        "ui_features": {
            "real_time_preview": True,
            "variable_analysis": True,
            "connection_awareness": True,
            "auto_mapping": True,
            "smart_suggestions": True,
            "validation_feedback": True,
            "performance_optimized": True
        }
    },
    "output_schema": {
        "properties": {
            "prompt": {
                "type": "string",
                "title": "Rendered Prompt",
                "description": "Final prompt with all variables substituted"
            },
            "template_used": {
                "type": "string",
                "title": "Original Template",
                "description": "The template that was used for rendering"
            },
            "variables_applied": {
                "type": "object",
                "title": "Applied Variables",
                "description": "All variables that were successfully applied"
            },
            "input_data_received": {
                "type": "object",
                "title": "Input Data",
                "description": "Raw data received from connected nodes"
            },
            "mapping_results": {
                "type": "array",
                "title": "Mapping Results",
                "description": "Detailed results of variable mapping process",
                "items": {
                    "type": "object",
                    "properties": {
                        "input_field": {"type": "string"},
                        "variable_name": {"type": "string"},
                        "value": {"type": "string"},
                        "used_default": {"type": "boolean"},
                        "was_transformed": {"type": "boolean"},
                        "source_node": {"type": "string"}
                    }
                }
            },
            "unmapped_variables": {
                "type": "array",
                "title": "Unmapped Variables",
                "description": "Variables in template that were not mapped to any input",
                "items": {"type": "string"}
            },
            "execution_metadata": {
                "type": "object",
                "title": "Execution Metadata",
                "description": "Information about the template rendering process"
            }
        }
    },
    "version": "2.0.0",
    "is_active": True,
    "is_beta": False,
    "sort_order": 10,
    "documentation": """
# Advanced Prompt Template Component

The most sophisticated prompt template component with full unified configuration support.

## Key Features

### 🎯 Intelligent Variable Detection
- Automatically detects `{variable}` patterns in templates
- Real-time validation and syntax highlighting
- Smart placeholder insertion and completion

### 🔗 Connection Awareness
- Automatically detects connected nodes and available data
- Real-time status of connected node execution
- Automatic data flow tracking and validation

### 🧠 Smart Variable Mapping
- Auto-generates suggested mappings based on available data
- Intelligent field name matching and suggestions
- Support for data transformations (case, trim, etc.)

### ⚡ Real-time Preview
- Live preview of rendered template with actual data
- Execution status tracking for connected nodes
- Performance-optimized updates and rendering

### 🛠 Advanced Configuration
- Manual variable override system
- Flexible validation modes (strict, warning, ignore)
- Advanced preview and performance settings

## Usage Patterns

### Basic Text Template
```
Hello {name}! Welcome to our {service}.
```

### Multi-input Template
```
Based on your message: "{user_message}"
Context: {context}
System response: {system_prompt}
```

### Complex Conditional Template
```
User: {user_input}
Previous conversation: {conversation_history}
Confidence level: {confidence_score}
Suggested response: {ai_suggestion}
```

## Section Organization

1. **Template Definition**: Core template with variable placeholders
2. **Input Connections**: Real-time data from connected nodes
3. **Variable Mapping**: Smart mapping of inputs to variables
4. **Manual Variables**: Static variables and overrides
5. **Advanced Options**: Validation and performance settings

## Best Practices

- Use descriptive variable names: `{user_question}` not `{q}`
- Set meaningful default values for reliable fallbacks
- Use transformations to ensure consistent formatting
- Enable real-time preview for immediate feedback
- Organize complex templates with sections and comments
""",
    "examples": {
        "enhanced_config": True,
        "supports_unified_ui": True,
        "basic_chat": {
            "template": "User: {user_message}\nAssistant: Please respond helpfully.",
            "variable_mappings": [
                {
                    "input_field": "message",
                    "variable_name": "user_message",
                    "default_value": "Hello",
                    "transform": "trim"
                }
            ]
        },
        "multi_context": {
            "template": "Context: {context}\nUser: {user_input}\nPrevious: {history}\nRespond as {persona}:",
            "variable_mappings": [
                {"input_field": "message", "variable_name": "user_input", "transform": "trim"},
                {"input_field": "context", "variable_name": "context", "default_value": "general"},
                {"input_field": "history", "variable_name": "history", "default_value": "none"}
            ],
            "manual_variables": {
                "persona": "helpful assistant"
            }
        },
        "advanced_features": {
            "template": "System: {system_prompt}\nData: {processed_data}\nQuery: {user_query}",
            "validation_mode": "strict",
            "preview_mode": True,
            "variable_mappings": [
                {"input_field": "query", "variable_name": "user_query", "transform": "trim"},
                {"input_field": "data", "variable_name": "processed_data", "transform": "none"}
            ],
            "manual_variables": {
                "system_prompt": "You are an expert assistant with access to the following data:"
            }
        }
    }
}

async def enhance_prompt_template_schema():
    """Enhance the prompt template component with the most advanced schema"""
    print("🚀 Enhancing Prompt Template component with advanced unified configuration...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Find existing prompt template component
            result = await session.execute(
                select(ComponentTemplate).where(
                    ComponentTemplate.component_type == "prompt_template"
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"📝 Updating existing Prompt Template component (ID: {existing.id})")
                
                # Update with enhanced schema
                for key, value in ENHANCED_PROMPT_TEMPLATE_SCHEMA.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
                
                await session.commit()
                
                print("🎉 Prompt Template component enhanced successfully!")
                print("\n✨ New Advanced Features:")
                print("   🎯 Intelligent variable detection and validation")
                print("   🔗 Full connection awareness with real-time status")
                print("   🧠 Smart auto-mapping with field suggestions")
                print("   ⚡ Real-time preview with actual data")
                print("   🛠 Advanced configuration sections")
                print("   📋 5 organized configuration sections")
                print("   🔧 Data transformation support")
                print("   📊 Detailed execution metadata")
                
                # Show schema structure
                sections = ENHANCED_PROMPT_TEMPLATE_SCHEMA["input_schema"]["sections"]
                print(f"\n📋 Configuration Sections ({len(sections)}):")
                for section_id, section_config in sections.items():
                    icon = section_config.get("icon", "")
                    title = section_config["title"]
                    features = section_config.get("features", [])
                    print(f"   {icon} {title}")
                    if features:
                        print(f"      Features: {', '.join(features)}")
                
                # Show UI features
                ui_features = ENHANCED_PROMPT_TEMPLATE_SCHEMA["input_schema"]["ui_features"]
                print(f"\n🎨 UI Features:")
                for feature, enabled in ui_features.items():
                    if enabled:
                        print(f"   ✅ {feature.replace('_', ' ').title()}")
                
            else:
                print("❌ Prompt Template component not found!")
                print("Creating new enhanced Prompt Template component...")
                
                # Create new component
                component = ComponentTemplate(**ENHANCED_PROMPT_TEMPLATE_SCHEMA)
                session.add(component)
                await session.commit()
                
                print("✅ New enhanced Prompt Template component created!")
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error enhancing Prompt Template: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(enhance_prompt_template_schema())