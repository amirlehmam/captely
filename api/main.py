# api/main.py
from fastapi import FastAPI
from core.config import settings
from api.routes import auth  # <-- import our new auth routes

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        description="B2B email & phone enrichment SaaS (with DB + Auth)"
    )

    # Include our auth router
    app.include_router(auth.router, prefix="/auth", tags=["Auth"])

    @app.get("/")
    async def root():
        return {
            "message": f"Welcome to {settings.PROJECT_NAME}",
            "environment": settings.ENVIRONMENT
        }

    return app

app = create_app()
