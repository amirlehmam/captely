FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml poetry.lock /app/

RUN pip install --upgrade pip && pip install poetry && poetry install --no-dev

COPY . /app

CMD ["gunicorn", "auth_service.wsgi:application", "-b", "0.0.0.0:8000"]
