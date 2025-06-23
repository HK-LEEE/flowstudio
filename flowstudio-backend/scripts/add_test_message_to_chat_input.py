#!/usr/bin/env python3

import sys
import os
import asyncio
from pathlib import Path

# Add the parent directory to the path to import from the app package
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings
from app.models.component_template import ComponentTemplate
from app.db.database import get_db
import json

settings = get_settings()

# Create async engine
engine = create_async_engine(settings.database_url, echo=True)
async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def update_chat_input_component():
    """Update Chat Input component to include test_message field"""
    async with async_session_maker() as session:
        try:
            # Find Chat Input component template
            result = await session.execute(
                text("SELECT * FROM component_templates WHERE component_type = 'chat_input'")
            )
            chat_input_template = result.fetchone()
            
            if not chat_input_template:
                print("❌ Chat Input component template not found")
                return
            
            print(f"✅ Found Chat Input template: {chat_input_template.display_name}")
            
            # Get current input_schema
            current_input_schema = json.loads(chat_input_template.input_schema)
            
            # Add test_message field to input_schema
            current_input_schema["properties"]["test_message"] = {
                "type": "string",
                "title": "Test Message",
                "description": "Test message for preview and testing (will be used as the Chat Input message)",
                "default": "안녕하세요! 이것은 테스트 메시지입니다.",
                "supports_variables": False
            }
            
            # Update required fields if needed
            if "required" not in current_input_schema:
                current_input_schema["required"] = []
            
            # Update the database
            await session.execute(
                text("""
                    UPDATE component_templates 
                    SET input_schema = :input_schema
                    WHERE component_type = 'chat_input'
                """),
                {
                    "input_schema": json.dumps(current_input_schema)
                }
            )
            
            await session.commit()
            print("✅ Chat Input component updated with test_message field")
            print(f"📋 Updated input schema: {json.dumps(current_input_schema, indent=2)}")
            
        except Exception as e:
            print(f"❌ Error updating Chat Input component: {e}")
            await session.rollback()
            raise

async def main():
    """Main function"""
    print("🚀 Starting Chat Input component update...")
    await update_chat_input_component()
    print("✅ Chat Input component update completed!")

if __name__ == "__main__":
    asyncio.run(main()) 