from celery import Celery
from common.config import get_settings

settings = get_settings()
celery_app = Celery(
    "captely",
    broker=settings.redis_url,
)
celery_app.conf.task_routes = {
    "enrichment_worker.tasks.*": {"queue": "enrichment"},
}
