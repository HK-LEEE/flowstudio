#!/usr/bin/env python3
"""
Script to create a test user for FlowStudio
Run this after starting the backend to create a test user for login
"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path
sys.path.append('.')

from app.core.config import settings
from app.models.user import User
from app.utils.auth import get_password_hash
from app.db.database import Base

async def create_test_user():
    """Create a test user for development"""
    
    # Create async engine
    engine = create_async_engine(settings.database_url, echo=True)
    
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if test user already exists
            from sqlalchemy import select
            stmt = select(User).where(User.email == "test@flowstudio.com")
            result = await session.execute(stmt)
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print("Test user already exists!")
                print(f"Email: {existing_user.email}")
                print(f"Username: {existing_user.username}")
                return
            
            # Create test user
            test_user = User(
                email="test@flowstudio.com",
                username="testuser",
                password_hash=get_password_hash("testpassword"),
                full_name="Test User",
                is_active=True,
                is_admin=False,
                is_verified=True
            )
            
            session.add(test_user)
            await session.commit()
            
            print("✅ Test user created successfully!")
            print("📧 Email: test@flowstudio.com")
            print("🔑 Password: testpassword")
            print("👤 Username: testuser")
            print("\nYou can now use these credentials to log in to FlowStudio.")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating test user: {e}")
            
        finally:
            await session.close()
    
    await engine.dispose()

if __name__ == "__main__":
    print("Creating test user for FlowStudio...")
    asyncio.run(create_test_user())