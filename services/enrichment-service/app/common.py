# common.py
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from pydantic import BaseSettings

class Settings(BaseSettings):
    db_url: str
    jwt_secret: str

    class Config:
        env_file = ".env"

settings = Settings()

engine = create_engine(settings.db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_settings():
    return settings
