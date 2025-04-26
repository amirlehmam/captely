# Ensure you are using the correct Python base image
FROM python:3.12-slim

# Set working directory in container
WORKDIR /app

# Copy requirements.txt to container
COPY requirements.txt /app/

# Install dependencies from requirements.txt
# before requirements
RUN pip install --no-cache-dir -r requirements.txt


# Copy the rest of the application code
COPY . /app/

# Expose the port
EXPOSE 8000

# Start the application (this may vary depending on your project)
CMD ["python", "app.py"]
