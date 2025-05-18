# services/common/__init__.py
from .config import get_settings
from .celery_app import celery_app
from .db import get_session, engine, get_async_session, async_engine

# For backward compatibility
async_session = get_async_session
