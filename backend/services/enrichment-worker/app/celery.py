import os
from celery import Celery
from kombu import Queue, Exchange

# Import settings
from app.config import get_settings

settings = get_settings()

# Initialize the Celery app with proper configuration
celery_app = Celery(
    'enrichment_worker',
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=['app.tasks'],
)

# Configure Celery using object config
celery_app.conf.update(
    # Task routing
    task_routes={
        'app.tasks.enrich_contact': {'queue': 'contact_enrichment'},
        'app.tasks.process_enrichment_batch': {'queue': 'enrichment_batch'},
        'app.tasks.cascade_enrich': {'queue': 'cascade_enrichment'},
        'app.tasks.update_contact': {'queue': 'db_operations'},
    },
    
    # Task execution settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    
    # Task timeouts and limits
    task_soft_time_limit=settings.task_soft_time_limit,
    task_time_limit=settings.task_hard_time_limit,
    
    # Task retry settings
    task_acks_late=True,  # Tasks acknowledged after execution (enables retries)
    task_reject_on_worker_lost=True,  # Re-queue if worker crashes
    
    # Worker concurrency settings
    worker_prefetch_multiplier=1,  # Fetch one task at a time (more predictable behavior)
    worker_max_tasks_per_child=200,  # Restart worker after processing 200 tasks (prevents memory leaks)
    
    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours
)

# Define task queues with priorities
celery_app.conf.task_queues = (
    Queue('contact_enrichment', Exchange('contact_enrichment'), routing_key='contact_enrichment', queue_arguments={'x-max-priority': 10}),
    Queue('enrichment_batch', Exchange('enrichment_batch'), routing_key='enrichment_batch', queue_arguments={'x-max-priority': 5}),
    Queue('cascade_enrichment', Exchange('cascade_enrichment'), routing_key='cascade_enrichment', queue_arguments={'x-max-priority': 8}),
    Queue('db_operations', Exchange('db_operations'), routing_key='db_operations', queue_arguments={'x-max-priority': 3}),
)

# This is to ensure the app is initialized properly
if __name__ == '__main__':
    celery_app.start()

# Configuration for Celery tasks
broker_url = 'redis://localhost:6379/0'  # Ensure this matches your Redis URL
result_backend = 'redis://localhost:6379/0'

task_serializer = 'json'
result_serializer = 'json'
accept_content = ['json']  # Limit content to JSON for security
timezone = 'UTC'

# Additional settings as needed...
