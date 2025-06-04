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
        
        # API Keys for enrichment services (ordered by price - cheapest first)
        # 1. Enrow - cheapest (0.008/mail)
        self.enrow_api = os.environ.get('ENROW_API_KEY', '3e472fa3-db4e-4d98-9075-6f75fac4d9b6')
        
        # 2. Icypeas - second cheapest (0.009/mail)
        self.icypeas_api = os.environ.get('ICYPEAS_API_KEY', '4faf07894e7c40eaac9c608b7f0f5556c7a903707632458c8fc985cd3cc58b8b')
        self.icypeas_secret = os.environ.get('ICYPEAS_API_SECRET', 'e7a3e867b51d1e59518d50d592e1f7aa1a5eccf7c7c56377c9d8dbddc35b2289')
        
        # 3. Apollo (0.012/mail)
        self.apollo_api = os.environ.get('APOLLO_API_KEY', 'wLViVqsiBd3Cp56pFyc8nA')
        
        # 4. Datagma (0.016/mail)
        self.datagma_api = os.environ.get('DATAGMA_API_KEY', 'v1aMzM7T')
        
        # 5. Anymailfinder (0.021/mail)
        self.anymailfinder_api = os.environ.get('ANYMAILFINDER_API_KEY', 'q3Bieg36rItIk4SgfCjai5D5')
        
        # 6. Snov.io (0.024/mail)
        self.snov_api_id = os.environ.get('SNOV_API_ID', '5ff5f14d00590735ac54cc464af065aa')
        self.snov_api_secret = os.environ.get('SNOV_API_SECRET', '38f1e154a16ad161aa8af02265ad56be')
        
        # 7. Findymail (0.024/mail)
        self.findymail_api = os.environ.get('FINDYMAIL_API_KEY', 'U7elGjh9pJ02kWl01cWXX1VJQ821HtZ4hhIYaXlq1739192e')
        
        # 8. Dropcontact (0.034/mail)
        self.dropcontact_api = os.environ.get('DROPCONTACT_API_KEY', 'zzqP8RNF6KXajJVgYaQiWeZW64J2mX')
        
        # 9. Hunter (0.036/mail)
        self.hunter_api = os.environ.get('HUNTER_API_KEY', '1b8302af512410b685217b7fcf00be362e094f0e')
        
        # 10. Kaspr - most expensive (0.071/mail)
        self.kaspr_api = os.environ.get('KASPR_API_KEY', 'cdb18bdd60bd472eb249be8bbfdd1879')
        
        # Additional APIs mentioned
        self.kendo_api = os.environ.get('KENDO_API_KEY', '6837377e7a4eb1abdb954ee0')
        self.contactout_api = os.environ.get('CONTACTOUT_API_KEY', 'at5UFu8cWnen6Nr3Q6zCLcBz')
        self.prospeo_api = os.environ.get('PROSPEO_API_KEY', 'b64e92cd66725c2f7019a0e0c04411af')
        self.enrich_so_api = os.environ.get('ENRICH_SO_API_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4Mzg0MDNiMzljYmJlODIyMDU1YTQ3NiIsInR5cGUiOiJhcGkiLCJyb3RhdGlvbiI6IjNkZmNiOGQ0LTE1NWQtNDQyZS1iM2IyLTc0M2U4NzNmYWZlMyIsImlhdCI6MTc0ODUxNjkyOH0.miPUx568OiSFwqukVFMah8q3U9a-BL1KWD60ZzPeWc8')
        
        # API base URLs
        self.api_urls = {
            'enrow': 'https://enrow.io/api',
            'icypeas': 'https://icypeas.com/api',
            'apollo': 'https://api.apollo.io/v1',
            'datagma': 'https://api.datagma.com',
            'anymailfinder': 'https://api.anymailfinder.com/v1',
            'snov': 'https://app.snov.io/restapi',
            'findymail': 'https://app.findymail.com/api',
            'dropcontact': 'https://api.dropcontact.com',
            'hunter': 'https://api.hunter.io/v2',
            'kaspr': 'https://api.kaspr.io/v1',
            'kendo': 'https://kendoemailapp.com/api',
            'contactout': 'https://api.contactout.com',
            'prospeo': 'https://api.prospeo.io/v1',
            'enrich_so': 'https://enrich.so/api'
        }
        
        # Service costs (per search/credit) in correct order - cheapest first
        self.service_costs = {
            'enrow': 0.008,        # Cheapest
            'icypeas': 0.009,
            'apollo': 0.012,
            'datagma': 0.016,
            'anymailfinder': 0.021,
            'snov': 0.024,
            'findymail': 0.024,
            'dropcontact': 0.034,
            'hunter': 0.036,
            'kaspr': 0.071,        # Most expensive
        }
        
        # Service ordering based on cost (cheapest first) - this is the cascade order
        self.service_order = [
            'enrow',         # 1st - cheapest
            'icypeas',       # 2nd
            'apollo',        # 3rd
            'datagma',       # 4th
            'anymailfinder', # 5th
            'snov',          # 6th
            'findymail',     # 7th
            'dropcontact',   # 8th
            'hunter',        # 9th
            'kaspr'          # 10th - most expensive
        ]
        
        # Rate limits (requests per minute) for each service
        self.rate_limits = {
            'enrow': 120,        # Generous limit
            'icypeas': 60,
            'apollo': 30,
            'datagma': 60,
            'anymailfinder': 60,
            'snov': 30,
            'findymail': 60,
            'dropcontact': 10,
            'hunter': 20,
            'kaspr': 30,
            'kendo': 60,
            'contactout': 60,
            'prospeo': 60,
            'enrich_so': 60
        }
        
        # Email verification confidence thresholds
        self.minimum_confidence = 0.30  # Lower minimum confidence to accept more results
        self.high_confidence = 0.80     # High confidence threshold to stop cascading
        self.excellent_confidence = 0.90 # Excellent confidence - definitely stop cascading
        
        # Phone verification confidence thresholds
        self.phone_minimum_confidence = 0.40
        self.phone_high_confidence = 0.85
        
        # Task configuration
        self.retry_limit = 3
        self.retry_delay = 5
        self.task_soft_time_limit = 180  # 3 minutes
        self.task_hard_time_limit = 300  # 5 minutes
        
        # Enrichment strategy settings
        self.max_providers_per_contact = 5  # Don't hit more than 5 providers per contact
        self.enable_phone_verification = True
        self.enable_email_verification = True
        self.cascade_stop_on_high_confidence = True  # Stop cascade when high confidence is reached
    
    def get_all(self) -> Dict[str, Any]:
        """Get all settings as a dictionary."""
        return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()