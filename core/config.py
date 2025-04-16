# core/config.py
import os
from dotenv import load_dotenv

# Load environment variables from a .env file if present
load_dotenv()

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Captely")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    API_VERSION: str = os.getenv("API_VERSION", "v1")
    # In future steps, we'll add DB connection strings, API keys, etc.
    
    # New additions
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "YOUR_RANDOM_SECRET")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

settings = Settings()