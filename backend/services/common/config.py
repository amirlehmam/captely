"""
Shared configuration for all services
"""
import os
from typing import Dict, Any

class Settings:
    """Configuration settings for Captely services."""
    
    def __init__(self):
        # Database configuration
        self.database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://postgres:postgrespw@db:5432/postgres')
        
        # Redis/Celery configuration
        self.redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
        
        # API Keys for enrichment services
        self.hunter_api = os.environ.get('HUNTER_API_KEY', '195519b1b540f1d005011ecd654a889390616b2b')
        self.dropcontact_api = os.environ.get('DROPCONTACT_API_KEY', 'zzqP8RNF6KXajJVgYaQiWeZW64J2mX')
        self.icypeas_api = os.environ.get('ICYPEAS_API_KEY', '4faf07894e7c40eaac9c608b7f0f5556c7a903707632458c8fc985cd3cc58b8b')
        self.icypeas_secret = os.environ.get('ICYPEAS_API_SECRET', 'e7a3e867b51d1e59518d50d592e1f7aa1a5eccf7c7c56377c9d8dbddc35b2289')
        self.apollo_api = os.environ.get('APOLLO_API_KEY', 'wLViVqsiBd3Cp56pFyc8nA')
        
        # Service costs (per search/credit) to make cost-based decisions
        self.service_costs = {
            'icypeas': 0.05,   # Lowest cost
            'dropcontact': 0.08,
            'hunter': 0.20,
            'apollo': 0.40,    # Highest cost
        }
        
        # Service ordering based on cost (cheapest first)
        self.service_order = ['icypeas', 'dropcontact', 'hunter', 'apollo']
        
        # Email verification confidence thresholds
        self.minimum_confidence = 0.70  # Minimum confidence to accept an email
        self.high_confidence = 0.90     # High confidence threshold to stop cascading
        
        # Task configuration
        self.retry_limit = 3
        self.retry_delay = 5
        
    def as_dict(self) -> Dict[str, Any]:
        """Get all settings as a dictionary."""
        return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}


# Global settings instance
settings = Settings()

def get_settings() -> Settings:
    """Get application settings."""
    return settings

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
