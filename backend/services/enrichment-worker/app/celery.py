import os
from celery import Celery
from kombu import Queue, Exchange

# Import settings
from app.config import get_settings

settings = get_settings()

# Create Celery app
celery_app = Celery(
    "enrichment_worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
    include=["app.tasks"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    enable_utc=True,
    task_track_started=True,
    task_send_sent_event=True,
    worker_send_task_events=True,
    task_routes={
        'app.tasks.process_enrichment_batch': {'queue': 'enrichment_batch'},
        'app.tasks.cascade_enrich': {'queue': 'cascade_enrichment'},
        'app.tasks.verify_existing_contacts': {'queue': 'contact_enrichment'},
        'app.tasks.get_enrichment_stats': {'queue': 'db_operations'},
        'app.tasks.enrich_single_contact_modern': {'queue': 'contact_enrichment'},
        'app.tasks.process_csv_file': {'queue': 'enrichment_batch'},
    }
)

# Define task queues with priorities
celery_app.conf.task_queues = (
    Queue('contact_enrichment', Exchange('contact_enrichment'), routing_key='contact_enrichment', queue_arguments={'x-max-priority': 10}),
    Queue('enrichment_batch', Exchange('enrichment_batch'), routing_key='enrichment_batch', queue_arguments={'x-max-priority': 5}),
    Queue('cascade_enrichment', Exchange('cascade_enrichment'), routing_key='cascade_enrichment', queue_arguments={'x-max-priority': 8}),
    Queue('db_operations', Exchange('db_operations'), routing_key='db_operations', queue_arguments={'x-max-priority': 3}),
)

# This is to ensure the app is initialized properly
if __name__ == "__main__":
    celery_app.start()

# Configuration for Celery tasks
broker_url = 'redis://localhost:6379/0'  # Ensure this matches your Redis URL
result_backend = 'redis://localhost:6379/0'

task_serializer = 'json'
result_serializer = 'json'
accept_content = ['json']  # Limit content to JSON for security
timezone = 'UTC'

# Additional settings as needed...
