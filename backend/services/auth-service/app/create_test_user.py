"""
Script to create a test user for Captely
"""
from app.main import get_password_hash
from app.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import asyncio
from common.db import async_engine
from sqlalchemy.orm import sessionmaker

async def create_test_user():
    # Create a session
    async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if user exists
        result = await session.execute(select(User).where(User.email == 'test@captely.com'))
        user = result.scalar_one_or_none()
        
        if not user:
            # Create test user
            hashed_password = get_password_hash('password123')
            user = User(
                email='test@captely.com',
                password_hash=hashed_password
            )
            session.add(user)
            await session.commit()
            print('Test user created')
        else:
            print('Test user already exists')

if __name__ == "__main__":
    asyncio.run(create_test_user()) 