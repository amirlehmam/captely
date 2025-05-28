from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, Session

from common.config import get_settings

settings = get_settings()

# Convert async URL to sync URL for regular SQLAlchemy
sync_database_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

# Create sync engine for regular operations
sync_engine = create_engine(sync_database_url, future=True)
SyncSessionLocal = sessionmaker(sync_engine, class_=Session, expire_on_commit=False)

# Keep async engine for async operations if needed
async_engine = create_async_engine(settings.database_url, future=True)
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

def get_session():
    """Sync session for regular FastAPI endpoints"""
    session = SyncSessionLocal()
    try:
        yield session
    finally:
        session.close()

async def get_async_session():
    """Async session for async operations"""
    async with AsyncSessionLocal() as session:
        yield session

# For backward compatibility
engine = sync_engine
