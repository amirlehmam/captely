# services/common/config.py
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # Database & broker
    database_url:         str = Field(..., env="DATABASE_URL")
    redis_url:            str = Field(..., env="REDIS_URL")

    # Auth service
    jwt_secret:           str = Field(..., env="JWT_SECRET")

    # AWS S3
    aws_access_key_id:    str = Field(..., env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key:str = Field(..., env="AWS_SECRET_ACCESS_KEY")
    aws_default_region:   str = Field(..., env="AWS_DEFAULT_REGION")
    s3_bucket_raw:        str = Field(..., env="S3_BUCKET_RAW")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

def get_settings() -> Settings:
    return Settings()
