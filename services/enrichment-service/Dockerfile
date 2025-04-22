# Ensure you are using the correct Python base image
FROM python:3.12-slim

# Set working directory in container
WORKDIR /app

# Copy requirements.txt to container
COPY requirements.txt /app/

# Install dependencies from requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Explicitly install Celery if it’s not in your requirements.txt
RUN pip install celery

# Copy the rest of the application code
COPY . /app/

# Expose the port
EXPOSE 8000

# Start the application (this may vary depending on your project)
CMD ["python", "app.py"]
