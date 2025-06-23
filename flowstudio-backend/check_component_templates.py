#!/usr/bin/env python3
"""Check if component templates are loaded in the database"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from app.models.component_template import ComponentTemplate
from app.core.config import settings

async def check_templates():
    """Check component templates in database"""
    # Create engine
    engine = create_async_engine(
        settings.database_url,
        echo=True
    )
    
    # Create session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        try:
            # Query component templates
            result = await session.execute(
                select(ComponentTemplate)
            )
            templates = result.scalars().all()
            
            print(f"\nFound {len(templates)} component templates in database")
            
            if templates:
                print("\nCategories:")
                categories = {}
                for template in templates:
                    if template.category not in categories:
                        categories[template.category] = 0
                    categories[template.category] += 1
                
                for category, count in categories.items():
                    print(f"  - {category}: {count} templates")
                
                print("\nComponent types:")
                for template in templates:
                    print(f"  - {template.component_type}: {template.display_name}")
            else:
                print("\nNo component templates found!")
                print("Run 'python init_component_templates.py' to initialize templates")
        
        except Exception as e:
            print(f"Error checking templates: {e}")
        
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_templates())