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

# common/config.py (or wherever you build your engine)
import ssl
from sqlalchemy.ext.asyncio import create_async_engine

def get_engine(db_url: str):
    # remove the unsupported query param
    url = db_url.split("?")[0]

    # build a minimal SSL context (you can tighten this up)
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = True
    ssl_ctx.verify_mode = ssl.CERT_REQUIRED

    return create_async_engine(
      url,
      connect_args={"ssl": ssl_ctx}
    )
