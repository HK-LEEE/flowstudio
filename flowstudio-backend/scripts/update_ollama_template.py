#!/usr/bin/env python3
"""
Update Ollama LLM Component Template
Updates the Ollama component to use single output port structure and enhanced configuration
"""
import asyncio
import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.db.database import engine

# Enhanced Ollama LLM template with single output port
ENHANCED_OLLAMA_TEMPLATE = {
    "input_schema": {
        "properties": {
            "prompt": {
                "type": "string",
                "title": "Prompt",
                "description": "User message/question for the AI model",
                "placeholder": "Enter your question or prompt here..."
            },
            "system_message": {
                "type": "string", 
                "title": "System Message",
                "description": "System instructions to guide the AI's behavior",
                "placeholder": "You are a helpful assistant..."
            }
        },
        "required": ["prompt"]
    },
    "output_schema": {
        "properties": {
            "output": {
                "type": "object",
                "description": "Combined output containing all response variables",
                "properties": {
                    "response": {
                        "type": "string",
                        "description": "AI model response text"
                    },
                    "model_used": {
                        "type": "string", 
                        "description": "Name of the Ollama model used"
                    },
                    "total_duration": {
                        "type": "integer",
                        "description": "Total generation time in nanoseconds"
                    },
                    "eval_count": {
                        "type": "integer",
                        "description": "Number of tokens generated"
                    },
                    "eval_duration": {
                        "type": "integer",
                        "description": "Time spent evaluating in nanoseconds"
                    },
                    "performance_stats": {
                        "type": "object",
                        "description": "Performance metrics and statistics"
                    }
                }
            }
        }
    },
    "version": "2.0.0"
}

async def update_ollama_template():
    """Update the Ollama LLM component template"""
    print("Updating Ollama LLM component template...")
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Find the ollama_llm component template
            result = await session.execute(
                text("SELECT id, input_schema, output_schema FROM flow_studio_component_templates WHERE component_type = 'ollama_llm'")
            )
            template_row = result.fetchone()
            
            if not template_row:
                print("❌ Ollama LLM component template not found!")
                return False
            
            template_id, current_input_schema, current_output_schema = template_row
            print(f"✅ Found Ollama LLM template with ID: {template_id}")
            print(f"📋 Current input schema: {len(current_input_schema.get('properties', {}))} properties")
            print(f"📋 Current output schema: {len(current_output_schema.get('properties', {}))} properties")
            
            # Update the schemas and version
            await session.execute(
                text("""
                UPDATE flow_studio_component_templates 
                SET input_schema = :input_schema,
                    output_schema = :output_schema,
                    version = :version
                WHERE id = :template_id
                """),
                {
                    "input_schema": json.dumps(ENHANCED_OLLAMA_TEMPLATE["input_schema"]),
                    "output_schema": json.dumps(ENHANCED_OLLAMA_TEMPLATE["output_schema"]),
                    "version": ENHANCED_OLLAMA_TEMPLATE["version"],
                    "template_id": template_id
                }
            )
            
            await session.commit()
            print("✅ Successfully updated Ollama LLM component template!")
            
            # Verify the update
            result = await session.execute(
                text("SELECT input_schema, output_schema, version FROM flow_studio_component_templates WHERE component_type = 'ollama_llm'")
            )
            updated_row = result.fetchone()
            updated_input, updated_output, updated_version = updated_row
            
            print(f"📋 Updated input schema: {len(updated_input.get('properties', {}))} properties")
            print(f"📋 Updated output schema: Single 'output' port with {len(updated_output['properties']['output']['properties'])} nested variables")
            print(f"🔢 Updated version: {updated_version}")
            
            # Show the nested variables
            nested_vars = list(updated_output['properties']['output']['properties'].keys())
            print(f"📊 Available output variables: {', '.join(nested_vars)}")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error updating template: {e}")
            return False
        finally:
            await session.close()

if __name__ == "__main__":
    success = asyncio.run(update_ollama_template())
    if success:
        print("\n🎉 Ollama LLM template update completed successfully!")
        print("💡 Next: Restart the backend to load the new template schema")
    else:
        print("\n💥 Template update failed!")