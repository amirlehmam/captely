FROM python:3.12-slim
WORKDIR /app

# copy common lib
COPY common ./common

# install deps
COPY services/import-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy our app
COPY services/import-service ./app

# run uvicorn
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
