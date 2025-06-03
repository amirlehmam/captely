# config.py
import os
from typing import Dict, Any

class Settings:
    """Configuration settings for the enrichment worker."""
    
    def __init__(self):
        # Database configuration
        self.database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://user:password@db/captely')
        
        # Redis/Celery configuration
        self.redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
        self.celery_broker_url = self.redis_url
        self.celery_result_backend = self.redis_url
        
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
        self.service_order = ['dropcontact', 'icypeas', 'hunter', 'apollo']
        
        # Email verification confidence thresholds
        self.minimum_confidence = 0.30  # Lower minimum confidence to accept more results
        self.high_confidence = 0.80     # High confidence threshold to stop cascading
        
        # Task configuration
        self.retry_limit = 3
        self.retry_delay = 5
        self.task_soft_time_limit = 180  # 3 minutes
        self.task_hard_time_limit = 300  # 5 minutes
    
    def get_all(self) -> Dict[str, Any]:
        """Get all settings as a dictionary."""
        return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()