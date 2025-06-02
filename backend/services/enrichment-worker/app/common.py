# services/enrichment-worker/app/common.py
import logging
import time
import random
import json
from functools import wraps
from typing import Dict, Any, Callable, Optional, Tuple

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/enrichment.log")
    ]
)

logger = logging.getLogger('enrichment_worker')

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
        # Dropcontact returns numeric confidence (0-100)
        score = result.get('confidence', 0)
        confidence = float(score) / 100.0
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
    
    def __init__(self, unavailable_duration: int = 300):  # 5 minutes default
        self._status = {}
        self._unavailable_until = {}
        self.unavailable_duration = unavailable_duration
    
    def mark_available(self, service: str):
        """Mark a service as available."""
        self._status[service] = True
        if service in self._unavailable_until:
            del self._unavailable_until[service]
    
    def mark_unavailable(self, service: str, duration: Optional[int] = None):
        """Mark a service as unavailable for a certain duration."""
        self._status[service] = False
        duration = duration or self.unavailable_duration
        self._unavailable_until[service] = time.time() + duration
        logger.warning(f"Service {service} marked unavailable for {duration} seconds")
    
    def is_available(self, service: str) -> bool:
        """Check if a service is available."""
        # If service is marked unavailable, check if timeout has passed
        if service in self._unavailable_until:
            if time.time() > self._unavailable_until[service]:
                # Timeout passed, mark as available again
                self.mark_available(service)
                logger.info(f"Service {service} is available again after timeout")
                return True
            return False
        
        # Default to available if not tracked
        return self._status.get(service, True)
    
    def reset(self):
        """Reset all service statuses."""
        self._status = {}
        self._unavailable_until = {}

# Global service status tracker
service_status = ServiceStatus(unavailable_duration=60)  # 60 seconds timeout for faster recovery
