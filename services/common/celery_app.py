from celery import Celery
from . import get_settings
settings = get_settings()

celery_app = Celery(
    "captely",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["services.enrichment-service.tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
)
