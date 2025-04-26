# services/common/config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    # …any other env vars you need

    class Config:
        env_file = ".env"

def get_settings() -> Settings:
    return Settings()
