"""
Initialize FlowStudio component templates
Creates initial set of component templates for the component library
"""
import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models import ComponentTemplate

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Component template definitions based on the roadmap
COMPONENT_TEMPLATES = [
    # Input Components
    {
        "component_type": "input.chat",
        "name": "Chat Input",
        "display_name": "Chat Input",
        "description": "Receives chat messages from users",
        "category": "Inputs",
        "icon": "MessageOutlined",
        "color": "#4A90E2",
        "input_schema": {},
        "output_schema": {
            "text": {
                "display_name": "Message Text",
                "type": "Text",
                "description": "The user's chat message"
            }
        },
        "python_code": """
def run(inputs=None):
    # This will be replaced with actual user input during execution
    user_message = inputs.get('user_input', 'Hello, world!')
    return {'text': user_message}
""",
        "documentation": "Captures user chat input and passes it to the next component.",
        "examples": {"sample_output": {"text": "Hello, how can I help you?"}}
    },
    {
        "component_type": "input.text",
        "name": "Text Input",
        "display_name": "Text Input",
        "description": "Static text input component",
        "category": "Inputs",
        "icon": "FileTextOutlined",
        "color": "#4A90E2",
        "input_schema": {
            "text_value": {
                "display_name": "Text Value",
                "type": "string",
                "required": True,
                "is_handle": False,
                "field_type": "textarea"
            }
        },
        "output_schema": {
            "text": {
                "display_name": "Text Output",
                "type": "Text",
                "description": "The configured text value"
            }
        },
        "python_code": """
def run(inputs=None):
    text_value = inputs.get('text_value', '')
    return {'text': text_value}
""",
        "documentation": "Outputs a predefined text value."
    },
    
    # Output Components
    {
        "component_type": "output.chat",
        "name": "Chat Output",
        "display_name": "Chat Output",
        "description": "Displays chat responses to users",
        "category": "Outputs",
        "icon": "MessageOutlined",
        "color": "#52C41A",
        "input_schema": {
            "message": {
                "display_name": "Message",
                "type": "Text",
                "required": True,
                "is_handle": True,
                "field_type": "text"
            }
        },
        "output_schema": {},
        "python_code": """
def run(inputs=None):
    message = inputs.get('message', '')
    # Display the message to the user
    print(f"Assistant: {message}")
    return {}
""",
        "documentation": "Displays the final chat response to the user."
    },
    
    # LLM Components
    {
        "component_type": "llm.azure_openai",
        "name": "Azure OpenAI",
        "display_name": "Azure OpenAI",
        "description": "Azure OpenAI language model",
        "category": "LLMs",
        "icon": "CloudOutlined",
        "color": "#BD10E0",
        "input_schema": {
            "api_key": {
                "display_name": "API Key",
                "type": "string",
                "required": True,
                "is_handle": False,
                "field_type": "password"
            },
            "endpoint": {
                "display_name": "Endpoint URL",
                "type": "string",
                "required": True,
                "is_handle": False,
                "field_type": "text"
            },
            "deployment_name": {
                "display_name": "Deployment Name",
                "type": "string",
                "required": True,
                "is_handle": False,
                "field_type": "text"
            },
            "prompt": {
                "display_name": "Prompt",
                "type": "Text",
                "required": True,
                "is_handle": True,
                "field_type": "text"
            },
            "temperature": {
                "display_name": "Temperature",
                "type": "number",
                "required": False,
                "is_handle": False,
                "field_type": "text"
            }
        },
        "output_schema": {
            "response": {
                "display_name": "Response",
                "type": "Text",
                "description": "The LLM's response"
            }
        },
        "python_code": """
def run(inputs=None):
    import openai
    
    api_key = inputs.get('api_key')
    endpoint = inputs.get('endpoint')
    deployment_name = inputs.get('deployment_name')
    prompt = inputs.get('prompt', '')
    temperature = float(inputs.get('temperature', 0.7))
    
    # Configure Azure OpenAI
    client = openai.AzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version="2024-02-01"
    )
    
    # Make the API call
    response = client.chat.completions.create(
        model=deployment_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature
    )
    
    return {'response': response.choices[0].message.content}
""",
        "documentation": "Connects to Azure OpenAI to generate text responses."
    },
    
    # Prompt Components
    {
        "component_type": "prompt.basic",
        "name": "Prompt",
        "display_name": "Prompt Template",
        "description": "Basic prompt template with variables",
        "category": "Prompts",
        "icon": "EditOutlined",
        "color": "#FA8C16",
        "input_schema": {
            "template": {
                "display_name": "Prompt Template",
                "type": "string",
                "required": True,
                "is_handle": False,
                "field_type": "textarea"
            },
            "input_text": {
                "display_name": "Input Text",
                "type": "Text",
                "required": False,
                "is_handle": True,
                "field_type": "text"
            }
        },
        "output_schema": {
            "prompt": {
                "display_name": "Formatted Prompt",
                "type": "Text",
                "description": "The formatted prompt with variables replaced"
            }
        },
        "python_code": """
def run(inputs=None):
    template = inputs.get('template', '')
    input_text = inputs.get('input_text', '')
    
    # Simple variable replacement
    formatted_prompt = template.replace('{input}', input_text)
    
    return {'prompt': formatted_prompt}
""",
        "documentation": "Creates a formatted prompt by replacing variables in a template."
    },
    
    # Logic Components
    {
        "component_type": "logic.conditional",
        "name": "Conditional",
        "display_name": "If Condition",
        "description": "Conditional logic for flow branching",
        "category": "Logic",
        "icon": "BranchesOutlined",
        "color": "#722ED1",
        "input_schema": {
            "condition": {
                "display_name": "Condition",
                "type": "string",
                "required": True,
                "is_handle": False,
                "field_type": "text"
            },
            "input_value": {
                "display_name": "Input Value",
                "type": "Generic",
                "required": True,
                "is_handle": True,
                "field_type": "text"
            }
        },
        "output_schema": {
            "true_output": {
                "display_name": "True Output",
                "type": "Generic",
                "description": "Output when condition is true"
            },
            "false_output": {
                "display_name": "False Output",
                "type": "Generic",
                "description": "Output when condition is false"
            }
        },
        "python_code": """
def run(inputs=None):
    condition = inputs.get('condition', 'True')
    input_value = inputs.get('input_value')
    
    # Evaluate the condition (simplified)
    try:
        result = eval(condition)
        if result:
            return {'true_output': input_value, 'false_output': None}
        else:
            return {'true_output': None, 'false_output': input_value}
    except:
        return {'true_output': None, 'false_output': input_value}
""",
        "documentation": "Evaluates a condition and routes the flow accordingly."
    },
    
    # Utility Components
    {
        "component_type": "utility.text_formatter",
        "name": "Text Formatter",
        "display_name": "Text Formatter",
        "description": "Formats and transforms text",
        "category": "Utilities",
        "icon": "FormatPainterOutlined",
        "color": "#13C2C2",
        "input_schema": {
            "text": {
                "display_name": "Input Text",
                "type": "Text",
                "required": True,
                "is_handle": True,
                "field_type": "text"
            },
            "format_type": {
                "display_name": "Format Type",
                "type": "string",
                "required": True,
                "is_handle": False,
                "field_type": "select",
                "options": ["uppercase", "lowercase", "title", "strip"]
            }
        },
        "output_schema": {
            "formatted_text": {
                "display_name": "Formatted Text",
                "type": "Text",
                "description": "The formatted text output"
            }
        },
        "python_code": """
def run(inputs=None):
    text = inputs.get('text', '')
    format_type = inputs.get('format_type', 'strip')
    
    if format_type == 'uppercase':
        result = text.upper()
    elif format_type == 'lowercase':
        result = text.lower()
    elif format_type == 'title':
        result = text.title()
    elif format_type == 'strip':
        result = text.strip()
    else:
        result = text
    
    return {'formatted_text': result}
""",
        "documentation": "Applies various text formatting operations."
    }
]

async def init_component_templates():
    """Initialize component templates in the database"""
    
    # Create database engine
    engine = create_async_engine(settings.database_url, echo=True)
    
    # Create session
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting component template initialization...")
            
            # Create component templates
            for i, template_data in enumerate(COMPONENT_TEMPLATES):
                template = ComponentTemplate(
                    component_type=template_data["component_type"],
                    name=template_data["name"],
                    display_name=template_data["display_name"],
                    description=template_data["description"],
                    category=template_data["category"],
                    icon=template_data["icon"],
                    color=template_data["color"],
                    input_schema=template_data["input_schema"],
                    output_schema=template_data["output_schema"],
                    python_code=template_data["python_code"],
                    documentation=template_data.get("documentation"),
                    examples=template_data.get("examples"),
                    sort_order=i * 10  # Leave space for future insertions
                )
                
                db.add(template)
                logger.info(f"Added template: {template.display_name}")
            
            await db.commit()
            logger.info(f"Successfully created {len(COMPONENT_TEMPLATES)} component templates")
            
        except Exception as e:
            logger.error(f"Error initializing component templates: {e}")
            await db.rollback()
            raise
        
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_component_templates())