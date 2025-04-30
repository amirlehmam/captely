from celery import Celery

app = Celery('tasks', broker='redis://redis:6379/0')


# Initialize the Celery app with the broker URL (Redis)
celery_app = Celery(
    'enrichment_worker',  # Name of the app
    broker='redis://localhost:6379/0',  # Redis URL (replace with your actual Redis URL if different)
)

# Optional: Load configuration if needed (e.g., from a settings file)
celery_app.config_from_object('celeryconfig')

# Optional: Discover tasks dynamically if needed
celery_app.autodiscover_tasks(['enrichment_worker.tasks'])

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
