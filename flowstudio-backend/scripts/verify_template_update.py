#!/usr/bin/env python3
"""
Verify Text Input Component Template Update
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

async def verify_template_update():
    """Verify the Text Input Component template has been updated correctly"""
    print("Verifying Text Input Component template update...")
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Get the updated template
            result = await session.execute(
                text("""
                SELECT component_type, display_name, output_schema 
                FROM flow_studio_component_templates 
                WHERE component_type = 'text_input'
                """)
            )
            template_row = result.fetchone()
            
            if not template_row:
                print("❌ Text Input Component template not found!")
                return False
            
            component_type, display_name, output_schema = template_row
            print(f"✅ Found template: {component_type} - {display_name}")
            
            # Check if the output schema has the single 'output' property
            if 'output' in output_schema.get('properties', {}):
                output_prop = output_schema['properties']['output']
                if output_prop.get('type') == 'object' and 'properties' in output_prop:
                    nested_props = output_prop['properties']
                    expected_props = ['text', 'length', 'word_count']
                    
                    missing_props = [prop for prop in expected_props if prop not in nested_props]
                    if not missing_props:
                        print("✅ Output schema correctly updated to single output port structure!")
                        print(f"   - Single 'output' port containing: {list(nested_props.keys())}")
                        return True
                    else:
                        print(f"❌ Missing expected properties in output: {missing_props}")
                        return False
                else:
                    print("❌ Output property is not properly structured as object with properties")
                    return False
            else:
                print("❌ Output schema still has old multi-port structure")
                print(f"   - Current properties: {list(output_schema.get('properties', {}).keys())}")
                return False
                
        except Exception as e:
            print(f"❌ Error verifying template: {e}")
            return False
        finally:
            await session.close()

async def check_all_templates():
    """Check all component templates and their output structures"""
    print("\n" + "="*60)
    print("COMPONENT TEMPLATE OUTPUT STRUCTURES")
    print("="*60)
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            result = await session.execute(
                text("""
                SELECT component_type, display_name, output_schema 
                FROM flow_studio_component_templates 
                ORDER BY component_type
                """)
            )
            templates = result.fetchall()
            
            for component_type, display_name, output_schema in templates:
                props = list(output_schema.get('properties', {}).keys()) if output_schema else []
                ports_count = len(props)
                
                print(f"\n📋 {component_type} ({display_name})")
                if ports_count == 1 and 'output' in props:
                    print(f"   ✅ Single output port: {props[0]}")
                    nested_props = output_schema['properties']['output'].get('properties', {})
                    if nested_props:
                        print(f"      Contains: {list(nested_props.keys())}")
                elif ports_count > 1:
                    print(f"   ⚠️  Multiple output ports ({ports_count}): {props}")
                else:
                    print(f"   ❓ Output ports: {props}")
                    
        except Exception as e:
            print(f"❌ Error checking templates: {e}")
        finally:
            await session.close()

if __name__ == "__main__":
    asyncio.run(verify_template_update())
    asyncio.run(check_all_templates())