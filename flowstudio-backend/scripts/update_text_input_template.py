#!/usr/bin/env python3
"""
Update Text Input Component Template to use single output port
Updates existing template instead of recreating to avoid foreign key issues
"""
import asyncio
import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.component_template import ComponentTemplate
from app.db.database import Base, engine
from app.core.config import settings

# New single output schema for Text Input Component
NEW_OUTPUT_SCHEMA = {
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
}

async def update_text_input_template():
    """Update the Text Input Component template to use single output port"""
    print("Updating Text Input Component template...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Find the text_input component template
            result = await session.execute(
                text("SELECT id, output_schema FROM flow_studio_component_templates WHERE component_type = 'text_input'")
            )
            template_row = result.fetchone()
            
            if not template_row:
                print("Text Input Component template not found!")
                return
            
            template_id, current_output_schema = template_row
            print(f"Found Text Input template with ID: {template_id}")
            print(f"Current output schema: {current_output_schema}")
            
            # Update the output schema
            await session.execute(
                text("UPDATE flow_studio_component_templates SET output_schema = :new_schema WHERE id = :template_id"),
                {"new_schema": json.dumps(NEW_OUTPUT_SCHEMA), "template_id": template_id}
            )
            
            await session.commit()
            print("Successfully updated Text Input Component template!")
            
            # Verify the update
            result = await session.execute(
                text("SELECT output_schema FROM flow_studio_component_templates WHERE component_type = 'text_input'")
            )
            updated_schema = result.scalar()
            print(f"Updated output schema: {updated_schema}")
            
        except Exception as e:
            await session.rollback()
            print(f"Error updating template: {e}")
            raise
        finally:
            await session.close()

if __name__ == "__main__":
    asyncio.run(update_text_input_template())