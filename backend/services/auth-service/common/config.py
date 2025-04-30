# shared settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    jwt_secret: str

    aws_access_key_id: str
    aws_secret_access_key: str
    aws_default_region: str
    s3_bucket_raw: str
    s3_bucket_results: str

    hunter_api: str
    dropcontact_api: str

    class Config:
        env_file = "../../.env"  # relative to use in each service

def get_settings() -> Settings:
    return Settings()
