FROM python:3.12-alpine

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    postgresql-dev \
    postgresql-client \
    netcat-openbsd \
    dos2unix

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make wait script executable
COPY wait-for-db.sh /usr/local/bin/wait-for-db.sh
RUN dos2unix /usr/local/bin/wait-for-db.sh && chmod +x /usr/local/bin/wait-for-db.sh

ENTRYPOINT ["/bin/sh", "/usr/local/bin/wait-for-db.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
