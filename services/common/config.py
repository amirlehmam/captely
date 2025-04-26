# services/common/config.py
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    database_url: str = Field(..., env="DATABASE_URL")
    redis_url:    str = Field(..., env="REDIS_URL")
    # any other env vars…

    class Config:
        env_file = ".env"

def get_settings() -> Settings:
    return Settings()
