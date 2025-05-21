"""
Shared utility functions for all services
"""
import logging
import time
import random
import json
from functools import wraps
from typing import Dict, Any, Callable, Optional, Tuple

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

logger = logging.getLogger('captely')

# API request rate limiting
class RateLimiter:
    """Simple rate limiter to ensure we don't exceed API rate limits."""
    
    def __init__(self, calls_per_minute: int = 60):
        self.calls_per_minute = calls_per_minute
        self.interval = 60.0 / calls_per_minute
        self.last_call_time = 0
    
    def wait(self):
        """Wait if necessary to respect the rate limit."""
        current_time = time.time()
        elapsed = current_time - self.last_call_time
        
        if elapsed < self.interval:
            sleep_time = self.interval - elapsed
            logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f} seconds")
            time.sleep(sleep_time)
        
        self.last_call_time = time.time()

# Retry decorator with exponential backoff
def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0):
    """Retry decorator with exponential backoff for API calls."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            retry = 0
            while retry <= max_retries:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    retry += 1
                    if retry > max_retries:
                        logger.error(f"Max retries ({max_retries}) exceeded for {func.__name__}. Error: {str(e)}")
                        raise
                    
                    # Calculate backoff with jitter
                    delay = base_delay * (2 ** (retry - 1)) + random.uniform(0, 1)
                    logger.warning(f"Retry {retry}/{max_retries} for {func.__name__} in {delay:.2f}s. Error: {str(e)}")
                    time.sleep(delay)
            return None  # Should never reach here
        return wrapper
    return decorator

# Result confidence scoring
def calculate_confidence(result: Dict[str, Any], provider: str) -> float:
    """Calculate a normalized confidence score for a result from any provider."""
    # Default confidence
    confidence = 0.0
    
    # Provider-specific confidence calculation
    if provider == 'icypeas':
        # Icypeas returns a score from 0-100
        score = result.get('confidence', 0)
        confidence = float(score) / 100.0
    elif provider == 'dropcontact':
        # Dropcontact uses string values for quality
        quality = result.get('confidence', '')
        if quality == 'high':
            confidence = 0.9
        elif quality == 'medium':
            confidence = 0.7
        elif quality == 'low':
            confidence = 0.4
        else:
            confidence = 0.3
    elif provider == 'hunter':
        # Hunter returns a score from 0-100
        score = result.get('confidence', 0)
        confidence = float(score) / 100.0
    elif provider == 'apollo':
        # Apollo scoring (adjust based on actual API)
        if result.get('email'):
            confidence = 0.85  # Default high confidence for Apollo
    
    return min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1

# Service availability tracking
class ServiceStatus:
    """Track the availability and usage of enrichment services."""
    
    def __init__(self):
        self._status = {}
    
    def mark_available(self, service: str):
        """Mark a service as available."""
        self._status[service] = True
    
    def mark_unavailable(self, service: str):
        """Mark a service as unavailable."""
        self._status[service] = False
    
    def is_available(self, service: str) -> bool:
        """Check if a service is available."""
        return self._status.get(service, True)
    
    def reset(self):
        """Reset all service statuses."""
        self._status = {}

# Global service status tracker
service_status = ServiceStatus()

# CSV column normalization
def normalize_csv_columns(row: Dict[str, str]) -> Dict[str, str]:
    """Normalize CSV column names to a standard format."""
    normalized = {}
    for key, value in row.items():
        if not key or not isinstance(key, str):
            continue
            
        # Convert to lowercase and replace spaces with underscores
        normalized_key = key.lower().replace(' ', '_')
        
        # Map common variant column names
        if normalized_key in ('firstname', 'first'):
            normalized_key = 'first_name'
        elif normalized_key in ('lastname', 'last'):
            normalized_key = 'last_name'
        elif normalized_key in ('company_name', 'organization'):
            normalized_key = 'company'
        elif normalized_key in ('title', 'job_title', 'role'):
            normalized_key = 'position'
        elif normalized_key in ('linkedin', 'linkedin_profile', 'linkedin_url'):
            normalized_key = 'profile_url'
        elif normalized_key in ('domain', 'website'):
            normalized_key = 'company_domain'
            
        normalized[normalized_key] = value
    
    return normalized 