# services/common/celery_app.py
from celery import Celery
from .config import get_settings

settings = get_settings()
celery_app = Celery(
    "captely",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"],    # point at your tasks module
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
)
