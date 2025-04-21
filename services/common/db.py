from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from . import get_settings

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False, future=True)
async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_session():
    async with async_session() as s:
        yield s
