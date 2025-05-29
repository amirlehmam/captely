from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import asynccontextmanager

from common.config import get_settings

settings = get_settings()

# Get base URL
base_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+pg8000://", "postgresql://")

# Non-async engine (for services that need it)
engine = create_engine(base_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async engine (for services that require async)
# Ensure we use asyncpg for async operations
if "postgresql://" in settings.database_url and "+asyncpg" not in settings.database_url:
    async_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")
else:
    async_url = settings.database_url

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

# Async session context manager
@asynccontextmanager
async def get_async_session():
    async with AsyncSessionLocal() as session:
        yield session

# For backward compatibility
async_session = get_async_session
