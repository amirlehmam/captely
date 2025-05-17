# services/enrichment-worker/app/tasks.py

import asyncio
import httpx
from celery import Celery
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import insert, update, select
from sqlalchemy.orm import sessionmaker

# shared config / settings
from common.config import get_settings
from common.db import AsyncSessionLocal  # if you have that
# or define here:
# engine = create_async_engine(get_settings().database_url, future=True)
# AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# your import-service models (make sure these are available in this container)
from app.models import Contact, ImportJob, EnrichmentResult  

settings = get_settings()
settings.hunter_api = "195519b1b540f1d005011ecd654a889390616b2b"
settings.dropcontact_api = "zzqP8RNF6KXajJVgYaQiWeZW64J2mX"
settings.icypeas_api = "4faf07894e7c40eaac9c608b7f0f5556c7a903707632458c8fc985cd3cc58b8b"
settings.icypeas_secret = "e7a3e867b51d1e59518d50d592e1f7aa1a5eccf7c7c56377c9d8dbddc35b2289"
settings.apollo_api = "wLViVqsiBd3Cp56pFyc8nA"

# 1) Celery setup
celery_app = Celery(
    "enrichment_worker",
    broker=settings.redis_url,
)
celery_app.conf.task_routes = {
    "enrichment_worker.tasks.enrich_contact": {"queue": "enrichment"},
}

# 2) Helpers to talk to the database

async def save_contact(session: AsyncSession, job_id: str, lead: dict) -> int:
    stmt = insert(Contact).values(
        job_id=job_id,
        first_name=lead.get("first_name"),
        last_name=lead.get("last_name"),
        position=lead.get("position"),
        company=lead.get("company"),
        profile_url=lead.get("profile_url"),
        location=lead.get("location"),
        industry=lead.get("industry"),
        enriched=False,
    ).returning(Contact.id)
    result = await session.execute(stmt)
    contact_id = result.scalar_one()
    await session.commit()
    return contact_id

async def update_contact(session: AsyncSession, contact_id: int, email: str, phone: str):
    stmt = (
        update(Contact)
        .where(Contact.id == contact_id)
        .values(email=email, phone=phone, enriched=True)
    )
    await session.execute(stmt)
    await session.commit()

async def increment_job_progress(session: AsyncSession, job_id: str):
    stmt = (
        update(ImportJob)
        .where(ImportJob.id == job_id)
        .values(completed=ImportJob.completed + 1)
    )
    await session.execute(stmt)
    await session.commit()

async def save_enrichment_result(session: AsyncSession, contact_id: int, provider: str, email: str, phone: str, score: int, verified: bool):
    stmt = insert(EnrichmentResult).values(
        contact_id=contact_id,
        provider=provider,
        email=email,
        phone=phone,
        score=score,
        verified=verified
    )
    await session.execute(stmt)
    await session.commit()

async def verify_email(email: str) -> bool:
    # Dummy verification logic; replace with real API call
    return email and "@" in email and not email.endswith("catchall.com")

async def verify_phone(phone: str) -> bool:
    # Dummy verification logic; replace with real API call
    return phone and phone.isdigit() and len(phone) >= 8

async def score_result(email: str, provider: str) -> int:
    # Dummy scoring logic; replace with real scoring
    if not email:
        return 0
    if provider == "dropcontact":
        return 90
    if provider == "hunter":
        return 80
    return 50

# 3) External enrichment calls

def call_hunter(lead: dict) -> str:
    params = {
        "domain": lead.get("company_domain", ""),
        "first_name": lead.get("first_name"),
        "last_name": lead.get("last_name"),
        "api_key": settings.hunter_api,
    }
    resp = httpx.get("https://api.hunter.io/v2/email-finder", params=params, timeout=10)
    data = resp.json().get("data", {})
    return data.get("email", "")

def call_dropcontact(lead: dict) -> str:
    headers = {"Authorization": settings.dropcontact_api}
    payload = {
        "data": [{
            "first_name": lead.get("first_name", ""),
            "last_name": lead.get("last_name", ""),
            "company": lead.get("company", ""),
            "email": lead.get("email", ""),
        }],
        "siren": "",
        "language": "en"
    }
    resp = httpx.post(
        "https://api.dropcontact.io/batch",
        json=payload,
        headers=headers,
        timeout=20,
    )
    body = resp.json()
    try:
        result = body["data"][0]
        return result.get("email", "") or result.get("email_dc", "")
    except Exception:
        return ""

def call_icypeas(lead: dict) -> str:
    headers = {
        "X-API-KEY": settings.icypeas_api,
        "X-API-SECRET": settings.icypeas_secret,
    }
    payload = {
        "first_name": lead.get("first_name", ""),
        "last_name": lead.get("last_name", ""),
        "company": lead.get("company", ""),
        "email": lead.get("email", ""),
    }
    resp = httpx.post(
        "https://api.icypeas.com/v1/enrich",
        json=payload,
        headers=headers,
        timeout=20,
    )
    try:
        data = resp.json()
        return data.get("email", "")
    except Exception:
        return ""

def call_apollo(lead: dict) -> str:
    headers = {"Api-Key": settings.apollo_api}
    params = {
        "first_name": lead.get("first_name", ""),
        "last_name": lead.get("last_name", ""),
        "organization_name": lead.get("company", ""),
        "email": lead.get("email", ""),
    }
    resp = httpx.get(
        "https://api.apollo.io/v1/people/match",
        params=params,
        headers=headers,
        timeout=20,
    )
    try:
        data = resp.json()
        return data.get("person", {}).get("email", "")
    except Exception:
        return ""

# 4) Orchestrator

async def _do_enrich(lead: dict, job_id: str, user_id: str):
    async with AsyncSessionLocal() as session:
        contact_id = await save_contact(session, job_id, lead)
        providers = [
            ("dropcontact", call_dropcontact),
            ("hunter", call_hunter),
            ("icypeas", call_icypeas),
            ("apollo", call_apollo),
        ]
        best_email = None
        best_phone = None
        best_score = 0
        best_provider = None
        email_verified = False
        phone_verified = False
        for provider, func in providers:
            try:
                email = func(lead)
                phone = None  # Only Dropcontact may return phone, extend as needed
                if provider == "dropcontact":
                    phone = func(lead)  # You may want to split phone/email logic for Dropcontact
                score = await score_result(email, provider)
                verified = await verify_email(email)
                await save_enrichment_result(session, contact_id, provider, email, phone, score, verified)
                if score > best_score and email:
                    best_email = email
                    best_phone = phone
                    best_score = score
                    best_provider = provider
                    email_verified = verified
                    phone_verified = await verify_phone(phone) if phone else False
                if best_score >= 90:
                    break
            except Exception:
                continue
        await update_contact(
            session,
            contact_id,
            best_email,
            best_phone,
        )
        stmt = (
            update(Contact)
            .where(Contact.id == contact_id)
            .values(
                enrichment_status="done",
                enrichment_score=best_score,
                enrichment_provider=best_provider,
                email_verified=email_verified,
                phone_verified=phone_verified,
                enriched=True if best_email or best_phone else False,
            )
        )
        await session.execute(stmt)
        await increment_job_progress(session, job_id)
        await session.commit()
        return {
            "contact_id": contact_id,
            "email": best_email,
            "phone": best_phone,
            "score": best_score,
            "provider": best_provider,
            "email_verified": email_verified,
            "phone_verified": phone_verified,
        }

@celery_app.task(name="enrichment_worker.tasks.enrich_contact")
def enrich_contact(lead: dict, job_id: str, user_id: str):
    """
    Celery entrypoint: wrap the async workflow in asyncio.run
    """
    return asyncio.run(_do_enrich(lead, job_id, user_id))
