"""
Shared Celery application for all services
"""
import os
from celery import Celery
from kombu import Queue, Exchange

# Initialize the Celery app
redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery(
    'captely',
    broker=redis_url,
    backend=redis_url,
)

# Task routing configuration
celery_app.conf.task_routes = {
    'enrichment.tasks.cascade_enrich': {'queue': 'cascade_enrichment'},
    'enrichment.tasks.process_enrichment_batch': {'queue': 'enrichment_batch'},
    'enrichment.tasks.process_csv_file': {'queue': 'csv_processing'},
}

# Configure Celery using object config
celery_app.conf.update(
    # Task execution settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    
    # Task timeouts and limits
    task_soft_time_limit=180,  # 3 minutes
    task_time_limit=300,       # 5 minutes
    
    # Task retry settings
    task_acks_late=True,       # Tasks acknowledged after execution (enables retries)
    task_reject_on_worker_lost=True,  # Re-queue if worker crashes
    
    # Worker concurrency settings
    worker_prefetch_multiplier=1,     # Fetch one task at a time
    worker_max_tasks_per_child=200,   # Restart worker after processing 200 tasks
    
    # Result backend settings
    result_expires=86400,             # Results expire after 24 hours
)

# Define task queues with priorities
celery_app.conf.task_queues = (
    Queue('cascade_enrichment', Exchange('cascade_enrichment'), routing_key='cascade_enrichment', 
          queue_arguments={'x-max-priority': 8}),
    Queue('enrichment_batch', Exchange('enrichment_batch'), routing_key='enrichment_batch', 
          queue_arguments={'x-max-priority': 5}),
    Queue('csv_processing', Exchange('csv_processing'), routing_key='csv_processing', 
          queue_arguments={'x-max-priority': 3}),
)

if __name__ == '__main__':
    celery_app.start()
