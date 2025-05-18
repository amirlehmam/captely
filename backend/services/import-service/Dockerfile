FROM python:3.12-alpine

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    postgresql-dev \
    postgresql-client \
    netcat-openbsd

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt \
 && pip install jinja2 asyncpg

# Copy the common directory - we'll use a volume mount instead
# COPY ../common /app/common

# Copy the rest of the application
COPY . /app

# Set PYTHONPATH so Python can find the common package
ENV PYTHONPATH=/app:/app/common

# Make wait script executable
COPY wait-for-db.sh /usr/local/bin/wait-for-db.sh
RUN chmod +x /usr/local/bin/wait-for-db.sh

# Add a debug command - creates an init file if it doesn't exist
RUN mkdir -p /app/common && touch /app/common/__init__.py

ENTRYPOINT ["/bin/sh", "/usr/local/bin/wait-for-db.sh"]
