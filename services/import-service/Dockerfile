# services/import-service/Dockerfile
FROM python:3.12-alpine
WORKDIR /app
RUN pip install asyncpg
COPY . /app
RUN pip install --no-cache-dir -r requirements.txt uvicorn
