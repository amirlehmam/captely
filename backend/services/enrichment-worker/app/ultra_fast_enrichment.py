"""
ULTRA-FAST ENRICHMENT ENGINE
============================

This module provides blazing fast parallel enrichment processing while:
1. Maintaining cheapest-first provider strategy
2. Respecting API rate limits intelligently
3. Processing multiple contacts concurrently
4. Using async operations for maximum speed

Performance target: Process 100 contacts in under 5 minutes (vs current 2+ hours)
"""

import asyncio
import aiohttp
import time
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import concurrent.futures
from dataclasses import dataclass
from enum import Enum
import logging

# Celery and local imports
from celery import group
from app.config import get_settings
from app.common import logger

settings = get_settings()

class ProviderTier(Enum):
    """Provider cost tiers for optimized processing"""
    CHEAP = "cheap"      # $0.008-0.015
    MID = "mid"          # $0.016-0.030  
    EXPENSIVE = "expensive"  # $0.031+

@dataclass
class EnrichmentResult:
    """Structured enrichment result"""
    email: Optional[str] = None
    phone: Optional[str] = None
    confidence: float = 0.0
    provider: str = "none"
    cost: float = 0.0
    processing_time: float = 0.0
    verified: bool = False

@dataclass 
class ContactBatch:
    """Batch of contacts for parallel processing"""
    contacts: List[Dict[str, Any]]
    job_id: str
    user_id: str
    batch_id: str

class SmartRateLimiter:
    """Intelligent rate limiter that adapts to bulk operations"""
    
    def __init__(self, calls_per_minute: int):
        self.calls_per_minute = calls_per_minute
        self.calls_per_second = calls_per_minute / 60
        self.min_interval = 1.0 / self.calls_per_second
        self.last_call = 0.0
        self.call_times = []
    
    async def acquire(self):
        """Acquire rate limit permission with smart backoff"""
        now = time.time()
        
        # Clean old call times (older than 1 minute)
        self.call_times = [t for t in self.call_times if now - t < 60]
        
        # If we're at the limit, wait
        if len(self.call_times) >= self.calls_per_minute:
            sleep_time = 60 - (now - self.call_times[0])
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
        
        # Ensure minimum interval between calls
        time_since_last = now - self.last_call
        if time_since_last < self.min_interval:
            await asyncio.sleep(self.min_interval - time_since_last)
        
        self.last_call = time.time()
        self.call_times.append(self.last_call)

class UltraFastProvider:
    """Base class for ultra-fast async providers"""
    
    def __init__(self, name: str, api_key: str, base_url: str, cost: float, rate_limit: int):
        self.name = name
        self.api_key = api_key
        self.base_url = base_url
        self.cost = cost
        self.rate_limiter = SmartRateLimiter(rate_limit)
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session with optimized settings"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=15, connect=5)
            connector = aiohttp.TCPConnector(
                limit=100,  # Total connection pool size
                limit_per_host=30,  # Connections per host
                keepalive_timeout=30,
                enable_cleanup_closed=True
            )
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector
            )
        return self.session
    
    async def close(self):
        """Close the session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def enrich_async(self, lead: Dict[str, Any]) -> EnrichmentResult:
        """Async enrichment method - to be implemented by subclasses"""
        raise NotImplementedError

class EnrowProvider(UltraFastProvider):
    """Ultra-fast Enrow provider"""
    
    def __init__(self):
        super().__init__(
            name="enrow",
            api_key=settings.enrow_api,
            base_url=settings.api_urls["enrow"],
            cost=settings.service_costs["enrow"],
            rate_limit=settings.rate_limits["enrow"]
        )
    
    async def enrich_async(self, lead: Dict[str, Any]) -> EnrichmentResult:
        """Ultra-fast async Enrow enrichment with optimized polling"""
        start_time = time.time()
        
        await self.rate_limiter.acquire()
        session = await self.get_session()
        
        try:
            # Prepare payload
            payload = {
                'fullname': f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
                'company_name': lead.get('company', '')
            }
            
            headers = {"x-api-key": self.api_key, "Content-Type": "application/json"}
            
            # Start search
            async with session.post(
                f"{self.base_url}/email/find/single",
                json=payload,
                headers=headers
            ) as response:
                if response.status != 200:
                    logger.info(f"Enrow POST failed: {response.status}")
                    return EnrichmentResult(provider="enrow")
                
                data = await response.json()
                search_id = data.get("id")
                
                if not search_id:
                    logger.info(f"Enrow no search ID: {data}")
                    return EnrichmentResult(provider="enrow")
                
                logger.info(f"Enrow search started with ID: {search_id}")
            
            # Optimized polling with reduced delays
            poll_attempts = [0.5, 1.0, 1.5, 2.0, 3.0]  # Much faster polling!
            
            for attempt, delay in enumerate(poll_attempts):
                await asyncio.sleep(delay)
                
                async with session.get(
                    f"{self.base_url}/email/find/single",
                    params={"id": search_id},
                    headers=headers
                ) as poll_response:
                    if poll_response.status != 200:
                        continue
                    
                    poll_data = await poll_response.json()
                    qualification = poll_data.get("qualification", "")
                    
                    logger.info(f"Enrow GET attempt {attempt + 1}: {poll_response.status} - {poll_data}")
                    
                    if qualification == "ongoing":
                        logger.info(f"enrow polling {attempt + 1}: still processing")
                        continue
                    elif qualification == "valid":
                        email = poll_data.get("email")
                        if email:
                            logger.info(f"enrow SUCCESS: email={email}, status={qualification}, confidence=95")
                            return EnrichmentResult(
                                email=email,
                                confidence=95,
                                provider="enrow",
                                cost=self.cost,
                                processing_time=time.time() - start_time
                            )
                    else:
                        logger.info(f"enrow no email found. Response: {poll_data}")
                        break
            
            return EnrichmentResult(provider="enrow", processing_time=time.time() - start_time)
            
        except Exception as e:
            logger.error(f"Enrow error: {e}")
            return EnrichmentResult(provider="enrow", processing_time=time.time() - start_time)

class IcypeasProvider(UltraFastProvider):
    """Ultra-fast Icypeas provider"""
    
    def __init__(self):
        super().__init__(
            name="icypeas",
            api_key=settings.icypeas_api,
            base_url=settings.api_urls["icypeas"],
            cost=settings.service_costs["icypeas"],
            rate_limit=settings.rate_limits["icypeas"]
        )
    
    async def enrich_async(self, lead: Dict[str, Any]) -> EnrichmentResult:
        """Ultra-fast async Icypeas enrichment with optimized polling"""
        start_time = time.time()
        
        await self.rate_limiter.acquire()
        session = await self.get_session()
        
        try:
            # Prepare payload
            payload = {
                "firstname": lead.get("first_name", ""),
                "lastname": lead.get("last_name", ""),
                "company": lead.get("company", "")
            }
            
            headers = {"Authorization": self.api_key, "Content-Type": "application/json"}
            
            logger.info(f"Icypeas payload: firstname={payload['firstname']}, lastname={payload['lastname']}, company={payload['company']}")
            
            # Start search
            async with session.post(
                f"{self.base_url}/email-search",
                json=payload,
                headers=headers
            ) as response:
                if response.status != 200:
                    return EnrichmentResult(provider="icypeas")
                
                data = await response.json()
                request_id = data.get("item", {}).get("_id")
                
                if not request_id:
                    return EnrichmentResult(provider="icypeas")
                
                logger.info(f"Icypeas request started with ID: {request_id}")
            
            # Optimized polling - much faster!
            poll_attempts = [1.0, 1.5, 2.0]  # Reduced from [2, 3, 4, 6]
            
            for attempt, delay in enumerate(poll_attempts):
                await asyncio.sleep(delay)
                
                async with session.post(
                    f"{self.base_url}/bulk-single-searchs/read",
                    json={"id": request_id},
                    headers=headers
                ) as poll_response:
                    if poll_response.status != 200:
                        continue
                    
                    poll_data = await poll_response.json()
                    items = poll_data.get("items", [])
                    
                    if not items:
                        logger.info(f"Icypeas polling {attempt + 1}: no items yet")
                        continue
                    
                    item = items[0]
                    status = item.get("status")
                    
                    logger.info(f"Icypeas polling {attempt + 1}: status={status}")
                    
                    if status in ("DEBITED", "FREE"):
                        results = item.get("results", {})
                        emails = results.get("emails", [])
                        
                        if emails:
                            email_obj = emails[0]
                            email = email_obj.get("email") if isinstance(email_obj, dict) else email_obj
                            
                            if email:
                                logger.info(f"Icypeas found: email={email}")
                                return EnrichmentResult(
                                    email=email,
                                    confidence=85,
                                    provider="icypeas",
                                    cost=self.cost,
                                    processing_time=time.time() - start_time
                                )
                    elif status == "NOT_FOUND":
                        break
            
            logger.warning(f"Icypeas polling timeout for request ID {request_id}")
            return EnrichmentResult(provider="icypeas", processing_time=time.time() - start_time)
            
        except Exception as e:
            logger.error(f"Icypeas error: {e}")
            return EnrichmentResult(provider="icypeas", processing_time=time.time() - start_time)

class DatagmaProvider(UltraFastProvider):
    """Ultra-fast Datagma provider"""
    
    def __init__(self):
        super().__init__(
            name="datagma",
            api_key=settings.datagma_api,
            base_url=settings.api_urls["datagma"],
            cost=settings.service_costs["datagma"],
            rate_limit=settings.rate_limits["datagma"]
        )
    
    async def enrich_async(self, lead: Dict[str, Any]) -> EnrichmentResult:
        """Ultra-fast async Datagma enrichment - direct API call"""
        start_time = time.time()
        
        await self.rate_limiter.acquire()
        session = await self.get_session()
        
        try:
            # Prepare params
            params = {
                'apiId': self.api_key,
                'fullName': f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
                'company': lead.get('company', ''),
                'firstName': lead.get('first_name', ''),
                'lastName': lead.get('last_name', '')
            }
            
            logger.info(f"datagma params: {params}")
            
            # Make direct call (Datagma is synchronous)
            async with session.get(
                f"{self.base_url}/v8/findEmail",
                params=params
            ) as response:
                if response.status != 200:
                    return EnrichmentResult(provider="datagma")
                
                data = await response.json()
                email = data.get("email")
                
                logger.info(f"Datagma response: {response.status} - {data}")
                
                if email:
                    logger.info(f"datagma SUCCESS: email={email}")
                    return EnrichmentResult(
                        email=email,
                        confidence=80,
                        provider="datagma",
                        cost=self.cost,
                        processing_time=time.time() - start_time
                    )
                else:
                    logger.info(f"datagma no email found. Response: {data}")
                    return EnrichmentResult(provider="datagma", processing_time=time.time() - start_time)
            
        except Exception as e:
            logger.error(f"Datagma error: {e}")
            return EnrichmentResult(provider="datagma", processing_time=time.time() - start_time)

class UltraFastEnrichmentEngine:
    """Ultra-fast parallel enrichment engine"""
    
    def __init__(self):
        self.providers = self._initialize_providers()
        self.provider_tiers = self._categorize_providers()
        
    def _initialize_providers(self) -> Dict[str, UltraFastProvider]:
        """Initialize all ultra-fast providers"""
        return {
            "enrow": EnrowProvider(),
            "icypeas": IcypeasProvider(),
            "datagma": DatagmaProvider(),
            # Add more providers as needed
        }
    
    def _categorize_providers(self) -> Dict[ProviderTier, List[str]]:
        """Categorize providers by cost tiers for smart cascading"""
        return {
            ProviderTier.CHEAP: ["enrow", "icypeas"],  # $0.008-0.009
            ProviderTier.MID: ["datagma"],              # $0.016
            ProviderTier.EXPENSIVE: []                  # $0.031+
        }
    
    async def enrich_single_contact_ultra_fast(
        self, 
        lead: Dict[str, Any], 
        max_providers: int = 3
    ) -> EnrichmentResult:
        """
        Ultra-fast single contact enrichment using cheapest-first strategy
        with concurrent provider calls within each tier
        """
        logger.warning(f"🚀 ULTRA-FAST enrichment for {lead.get('first_name', '')} {lead.get('last_name', '')} at {lead.get('company', '')}")
        
        start_time = time.time()
        
        # Try each tier in order (cheapest first)
        for tier in [ProviderTier.CHEAP, ProviderTier.MID, ProviderTier.EXPENSIVE]:
            provider_names = self.provider_tiers.get(tier, [])
            if not provider_names:
                continue
                
            logger.warning(f"🔍 Trying {tier.value.upper()} providers: {provider_names}")
            
            # Run providers in this tier CONCURRENTLY (but still respect tier order)
            tasks = []
            for provider_name in provider_names[:max_providers]:
                if provider_name in self.providers:
                    provider = self.providers[provider_name]
                    task = asyncio.create_task(provider.enrich_async(lead))
                    tasks.append((provider_name, task))
            
            if not tasks:
                continue
            
            # Wait for first successful result from this tier
            try:
                # Use as_completed to get first successful result
                for coro in asyncio.as_completed([task for _, task in tasks], timeout=20):
                    try:
                        result = await coro
                        if result.email:  # Found email!
                            # Cancel remaining tasks in this tier
                            for _, task in tasks:
                                if not task.done():
                                    task.cancel()
                            
                            processing_time = time.time() - start_time
                            logger.warning(f"✅ ULTRA-FAST SUCCESS with {result.provider} in {processing_time:.2f}s!")
                            logger.warning(f"💰 Cost: ${result.cost:.3f} (tier: {tier.value})")
                            
                            result.processing_time = processing_time
                            return result
                    except Exception as e:
                        logger.error(f"Provider task failed: {e}")
                        continue
                
                # If we get here, no providers in this tier found results
                logger.warning(f"❌ No results from {tier.value} tier")
                
            except asyncio.TimeoutError:
                logger.warning(f"⏰ Timeout for {tier.value} tier")
                # Cancel all tasks
                for _, task in tasks:
                    if not task.done():
                        task.cancel()
        
        # No results from any tier
        processing_time = time.time() - start_time
        logger.warning(f"❌ ULTRA-FAST: No results found in {processing_time:.2f}s")
        return EnrichmentResult(processing_time=processing_time)
    
    async def enrich_batch_ultra_fast(
        self,
        contacts: List[Dict[str, Any]],
        batch_size: int = 20,  # Process 20 contacts in parallel!
        max_providers_per_contact: int = 3
    ) -> List[EnrichmentResult]:
        """
        Ultra-fast batch enrichment processing multiple contacts in parallel
        """
        logger.warning(f"🚀 ULTRA-FAST BATCH processing {len(contacts)} contacts with batch_size={batch_size}")
        
        start_time = time.time()
        results = []
        
        # Process contacts in batches for optimal performance
        for i in range(0, len(contacts), batch_size):
            batch = contacts[i:i + batch_size]
            logger.warning(f"📦 Processing batch {i // batch_size + 1}: contacts {i+1}-{min(i+batch_size, len(contacts))}")
            
            # Create tasks for all contacts in this batch
            tasks = []
            for contact in batch:
                task = asyncio.create_task(
                    self.enrich_single_contact_ultra_fast(contact, max_providers_per_contact)
                )
                tasks.append(task)
            
            # Wait for all contacts in this batch to complete
            try:
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for j, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        logger.error(f"Contact {i+j+1} failed: {result}")
                        results.append(EnrichmentResult(processing_time=0))
                    else:
                        results.append(result)
                        if result.email:
                            logger.warning(f"✅ Contact {i+j+1}: Found email via {result.provider}")
                        else:
                            logger.warning(f"❌ Contact {i+j+1}: No email found")
                
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
                # Add empty results for failed batch
                results.extend([EnrichmentResult(processing_time=0)] * len(batch))
        
        total_time = time.time() - start_time
        successful = sum(1 for r in results if r.email)
        
        logger.warning(f"🎯 ULTRA-FAST BATCH COMPLETE:")
        logger.warning(f"   📊 Processed: {len(contacts)} contacts in {total_time:.2f}s")
        logger.warning(f"   ✅ Successful: {successful}/{len(contacts)} ({successful/len(contacts)*100:.1f}%)")
        logger.warning(f"   ⚡ Speed: {len(contacts)/total_time:.1f} contacts/second")
        logger.warning(f"   💰 Avg time per contact: {total_time/len(contacts):.2f}s")
        
        return results
    
    async def close_all_sessions(self):
        """Close all provider sessions"""
        for provider in self.providers.values():
            await provider.close()

# Global engine instance
ultra_fast_engine = UltraFastEnrichmentEngine()

async def cleanup_ultra_fast_engine():
    """Cleanup function for engine sessions"""
    await ultra_fast_engine.close_all_sessions() 