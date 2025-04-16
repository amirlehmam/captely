# api/main.py
from fastapi import FastAPI
from core.config import settings

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        description="B2B email & phone enrichment SaaS (MVP Skeleton)",
        # You can add more metadata as you like
    )

    # For now, just a test root endpoint
    @app.get("/")
    async def root():
        return {
            "message": f"Welcome to {settings.PROJECT_NAME}",
            "environment": settings.ENVIRONMENT
        }

    return app

app = create_app()
