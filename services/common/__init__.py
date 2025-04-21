from pathlib import Path
from functools import lru_cache
from pydantic import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    jwt_secret: str
    aws_access_key_id: str
    aws_secret_access_key: str
    s3_bucket_raw: str = "captely-raw"
    s3_bucket_results: str = "captely-results"

    class Config:
        env_file = Path(__file__).resolve().parents[2] / ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()
