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
from app.models import Contact, ImportJob  

settings = get_settings()

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

# 3) External enrichment calls

def call_hunter(lead: dict) -> str:
    """
    Calls Hunter.io to find an email.
    """
    params = {
        "first_name": lead.get("first_name"),
        "last_name":  lead.get("last_name"),
        "domain":     lead.get("company_domain", ""),  # tweak as needed
        "api_key":    settings.hunter_api,
    }
    resp = httpx.get("https://api.hunter.io/v2/email‐finder", params=params, timeout=10)
    data = resp.json().get("data", {})
    return data.get("email", "")

def call_dropcontact(lead: dict) -> str:
    """
    Calls Dropcontact to enrich phone/email.
    """
    headers = {"Authorization": settings.dropcontact_api}
    payload = {"email": lead.get("email", "")}
    resp = httpx.post(
        "https://api.dropcontact.io/batch",
        json=payload,
        headers=headers,
        timeout=10,
    )
    body = resp.json()
    return body.get("phone", "")

# 4) Orchestrator

async def _do_enrich(lead: dict, job_id: str, user_id: str):
    # reuse the AsyncSessionLocal from common.db
    async with AsyncSessionLocal() as session:
        # a) save raw contact row
        contact_id = await save_contact(session, job_id, lead)

        # b) call external enrichers
        email = call_hunter(lead)
        phone = call_dropcontact(lead)

        # c) write back enriched info
        await update_contact(session, contact_id, email, phone)

        # d) bump the job counter
        await increment_job_progress(session, job_id)

        return {
            "contact_id": contact_id,
            "email":      email,
            "phone":      phone,
        }

@celery_app.task(name="enrichment_worker.tasks.enrich_contact")
def enrich_contact(lead: dict, job_id: str, user_id: str):
    """
    Celery entrypoint: wrap the async workflow in asyncio.run
    """
    return asyncio.run(_do_enrich(lead, job_id, user_id))
