#!/usr/bin/env python3
"""
Add is_published column to flows table
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.db.database import engine

async def add_is_published_column():
    """Add is_published column to flows table"""
    print("Adding is_published column to flows table...")
    
    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Check if column already exists
            check_column = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'flows' 
                AND column_name = 'is_published';
            """)
            
            result = await session.execute(check_column)
            column_exists = result.fetchone() is not None
            
            if column_exists:
                print("✅ is_published column already exists")
                return
            
            # Add the column
            add_column_sql = text("""
                ALTER TABLE flows 
                ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE;
            """)
            
            await session.execute(add_column_sql)
            await session.commit()
            
            print("✅ Successfully added is_published column to flows table")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error adding column: {e}")
            raise
        finally:
            await session.close()
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_is_published_column())