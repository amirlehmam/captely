from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

from common.config import get_settings

settings = get_settings()

# Non-async engine (for services that need it)
# Convert async URL to sync URL
db_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+pg8000://", "postgresql://")
engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async engine (for services that require async)
# Use asyncpg driver for the async engine
async_url = settings.database_url.replace("postgresql+pg8000://", "postgresql+asyncpg://")
async_engine = create_async_engine(async_url)
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

# Non-async session
def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Async session
async def get_async_session():
    async with AsyncSessionLocal() as session:
        yield session

# For backward compatibility
async_session = get_async_session
