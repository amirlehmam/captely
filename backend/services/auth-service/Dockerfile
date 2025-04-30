# services/auth-service/Dockerfile
FROM python:3.12-slim

# 1) Install OS-level build deps for pg8000/libpq + netcat for wait script
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      gcc \
      libpq-dev \
      netcat \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2) Copy & install all Python deps (including pg8000)
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt

# 3) Copy application code & wait-for-db helper script
COPY . .

# 4) Ensure wait script is executable
RUN chmod +x ./wait-for-db.sh

# 5) Expose port and define startup
EXPOSE 8000
ENTRYPOINT ["./wait-for-db.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
