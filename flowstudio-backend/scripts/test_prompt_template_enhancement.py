#!/usr/bin/env python3
"""
Test the enhanced Prompt Template component with Input Section
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.models.flow import Flow
from app.models.flow_component import FlowComponent
from app.models.flow_connection import FlowConnection
from app.models.component_template import ComponentTemplate
from app.models.user import User
from app.db.database import engine

async def create_test_flow():
    """Create a test flow with Chat Input -> Prompt Template"""
    print("Creating test flow for Prompt Template Input Section...")
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Get existing user
            user_result = await session.execute(select(User).limit(1))
            user = user_result.scalar_one_or_none()
            
            if not user:
                print("❌ No user found. Please create a user first.")
                return
            
            # Get component templates
            chat_input_result = await session.execute(
                select(ComponentTemplate).where(ComponentTemplate.component_type == "chat_input")
            )
            chat_input_template = chat_input_result.scalar_one_or_none()
            
            prompt_template_result = await session.execute(
                select(ComponentTemplate).where(ComponentTemplate.component_type == "prompt_template")
            )
            prompt_template = prompt_template_result.scalar_one_or_none()
            
            if not chat_input_template or not prompt_template:
                print("❌ Required component templates not found")
                return
            
            # Create test flow
            test_flow = Flow(
                name="Prompt Template Input Test",
                description="Test flow for Prompt Template Input Section enhancement",
                owner_id=user.id,
                flow_data={
                    "nodes": [],
                    "edges": [],
                    "viewport": {"x": 0, "y": 0, "zoom": 1}
                },
                is_published=False
            )
            session.add(test_flow)
            await session.flush()
            
            # Create Chat Input component
            chat_input_component = FlowComponent(
                flow_id=test_flow.id,
                template_id=chat_input_template.id,
                component_key="chat_input_1",
                display_name="User Input",
                position_x=100,
                position_y=100,
                input_values={
                    "message": "Hello, how are you today?"
                },
                config_data={}
            )
            session.add(chat_input_component)
            await session.flush()
            
            # Create Prompt Template component
            prompt_template_component = FlowComponent(
                flow_id=test_flow.id,
                template_id=prompt_template.id,
                component_key="prompt_template_1",
                display_name="Enhanced Prompt",
                position_x=400,
                position_y=100,
                input_values={
                    "template": "System: You are a helpful assistant.\nUser: {user_message}\nContext: {context}",
                    "variable_mappings": [
                        {
                            "input_field": "message",
                            "variable_name": "user_message",
                            "default_value": "No message provided"
                        }
                    ],
                    "manual_variables": {
                        "context": "This is a test conversation"
                    }
                },
                config_data={}
            )
            session.add(prompt_template_component)
            await session.flush()
            
            # Create connection between components
            connection = FlowConnection(
                flow_id=test_flow.id,
                source_component_id=chat_input_component.id,
                target_component_id=prompt_template_component.id,
                source_handle="message",
                target_handle="input_data",
                connection_key="chat_to_prompt_connection"
            )
            session.add(connection)
            
            # Update flow data with components
            test_flow.flow_data = {
                "nodes": [
                    {
                        "id": str(chat_input_component.id),
                        "type": "langflowNode",
                        "position": {"x": 100, "y": 100},
                        "data": {
                            "template": {
                                "id": str(chat_input_template.id),
                                "component_type": "chat_input",
                                "display_name": "Chat Input",
                                "description": "Receives user messages",
                                "category": "Chat",
                                "icon": "MessageOutlined",
                                "color": "#52c41a",
                                "input_schema": chat_input_template.input_schema,
                                "output_schema": chat_input_template.output_schema
                            },
                            "display_name": "User Input",
                            "input_values": chat_input_component.input_values,
                            "config_data": chat_input_component.config_data
                        }
                    },
                    {
                        "id": str(prompt_template_component.id),
                        "type": "langflowNode", 
                        "position": {"x": 400, "y": 100},
                        "data": {
                            "template": {
                                "id": str(prompt_template.id),
                                "component_type": "prompt_template",
                                "display_name": "Prompt Template",
                                "description": "Create dynamic prompts with variable substitution",
                                "category": "Text Processing",
                                "icon": "FieldStringOutlined",
                                "color": "#fa8c16",
                                "input_schema": prompt_template.input_schema,
                                "output_schema": prompt_template.output_schema
                            },
                            "display_name": "Enhanced Prompt",
                            "input_values": prompt_template_component.input_values,
                            "config_data": prompt_template_component.config_data
                        }
                    }
                ],
                "edges": [
                    {
                        "id": str(connection.id),
                        "source": str(chat_input_component.id),
                        "target": str(prompt_template_component.id),
                        "sourceHandle": "message",
                        "targetHandle": "input_data"
                    }
                ],
                "viewport": {"x": 0, "y": 0, "zoom": 1}
            }
            
            await session.commit()
            
            print("🎉 Test flow created successfully!")
            print(f"   - Flow ID: {test_flow.id}")
            print(f"   - Flow Name: {test_flow.name}")
            print(f"   - Chat Input Component ID: {chat_input_component.id}")
            print(f"   - Prompt Template Component ID: {prompt_template_component.id}")
            print(f"   - Connection ID: {connection.id}")
            print("\n🧪 Test Scenario:")
            print("   1. Chat Input outputs: {\"message\": \"Hello, how are you today?\"}")
            print("   2. Prompt Template receives this via input_data")
            print("   3. Variable mapping: \"message\" → \"user_message\"")
            print("   4. Manual variable: \"context\" → \"This is a test conversation\"")
            print("   5. Template: \"System: You are a helpful assistant.\\nUser: {user_message}\\nContext: {context}\"")
            print("   6. Expected output: Rendered prompt with variables substituted")
            
            return test_flow.id
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating test flow: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_test_flow())