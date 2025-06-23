#!/usr/bin/env python3
"""
Update existing Chat Input and Chat Output components for simplified usage
"""
import asyncio
import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.component_template import ComponentTemplate
from app.db.database import engine

# Updated Chat Component schemas
UPDATED_CHAT_INPUT = {
    "description": "Automatically receives user messages from the chat interface - no manual input required",
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
            "output": {
                "type": "object",
                "description": "Combined output containing all chat variables",
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
            }
        }
    },
    "documentation": "Chat Input component that automatically receives user messages from the chat interface. No manual configuration required."
}

UPDATED_CHAT_OUTPUT = {
    "description": "Automatically sends AI responses to the chat interface - no manual configuration required",
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
    "documentation": "Chat Output component that automatically sends AI responses to the chat interface. Simply connect an LLM output to this component."
}

async def update_chat_components():
    """Update existing chat input and output components"""
    
    # Create async session
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        try:
            # Update Chat Input component
            result = await session.execute(
                text("""
                    UPDATE flow_studio_component_templates 
                    SET 
                        description = :description,
                        input_schema = :input_schema,
                        output_schema = :output_schema,
                        documentation = :documentation
                    WHERE component_type = 'chat_input'
                """),
                {
                    "description": UPDATED_CHAT_INPUT["description"],
                    "input_schema": json.dumps(UPDATED_CHAT_INPUT["input_schema"]),
                    "output_schema": json.dumps(UPDATED_CHAT_INPUT["output_schema"]),
                    "documentation": UPDATED_CHAT_INPUT["documentation"]
                }
            )
            
            print(f"Updated Chat Input component: {result.rowcount} rows affected")
            
            # Update Chat Output component
            result = await session.execute(
                text("""
                    UPDATE flow_studio_component_templates 
                    SET 
                        description = :description,
                        input_schema = :input_schema,
                        output_schema = :output_schema,
                        documentation = :documentation
                    WHERE component_type = 'chat_output'
                """),
                {
                    "description": UPDATED_CHAT_OUTPUT["description"],
                    "input_schema": json.dumps(UPDATED_CHAT_OUTPUT["input_schema"]),
                    "output_schema": json.dumps(UPDATED_CHAT_OUTPUT["output_schema"]),
                    "documentation": UPDATED_CHAT_OUTPUT["documentation"]
                }
            )
            
            print(f"Updated Chat Output component: {result.rowcount} rows affected")
            
            await session.commit()
            print("✅ Chat components updated successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error updating chat components: {e}")
            raise

if __name__ == "__main__":
    print("Updating Chat Input/Output component templates...")
    asyncio.run(update_chat_components()) 