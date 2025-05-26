import os
import redis
from celery import Celery

# Configure Celery
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
app = Celery('test_app', broker=redis_url, backend=redis_url)

# Set the task destination
app.conf.task_routes = {
    'app.tasks.process_csv_file': {'queue': 'enrichment_batch'},
}

# Submit a test task
if __name__ == "__main__":
    print("Submitting a test task to the worker...")
    
    # Use a path that's accessible inside the Docker container
    # The /app/csv directory is mounted from ./csv in the host
    docker_csv_path = "/app/csv/linkedin_leads_2025-05-19T15-53-50.csv"
    
    # Submit the task
    result = app.send_task(
        'app.tasks.process_csv_file',
        args=[docker_csv_path, "job_test_4", "user_test"],
        queue='enrichment_batch'
    )
    
    print(f"Task submitted with ID: {result.id}")
    print("Check the worker logs to see the task processing.") 