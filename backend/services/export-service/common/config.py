# shared settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    jwt_secret: str = "devsecret"

    class Config:
        env_file = "../../.env"  # relative to use in each service

def get_settings() -> Settings:
    return Settings() 