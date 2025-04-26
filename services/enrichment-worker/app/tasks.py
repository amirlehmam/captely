import httpx, asyncio, os
from sqlalchemy import update, text
from common import get_settings
settings = get_settings()
from celery import Celery

# Configure Celery app
celery_app = Celery('enrichment_worker', broker='redis://redis:6379/0')

# Define tasks here
@celery_app.task
def sample_task():
    return "Task Complete"


# If you use get_settings for more advanced configurations, ensure it's working as expected.


settings = get_settings()

HUNTER_API = os.getenv("HUNTER_API")
CLEARBIT_API = os.getenv("CLEARBIT_API")

async def call_hunter(first, last, domain):
    async with httpx.AsyncClient() as client:
        q = f"{first}.{last}@{domain}"
        r = await client.get(
            f"https://api.hunter.io/v2/email-verifier?email={q}&api_key={HUNTER_API}"
        )
        if r.status_code == 200 and r.json()["data"]["result"] == "deliverable":
            return q
    return None

async def call_clearbit(email):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://person.clearbit.com/v2/people/find?email={email}",
            headers={"Authorization": f"Bearer {CLEARBIT_API}"},
        )
        return r.json() if r.status_code == 200 else None

@celery_app.task(name="services.enrichment-service.tasks.enrich_contact")
def enrich_contact(lead: dict, job_id: str, user_id: str):
    """
    lead = {"first_name": "...", "last_name": "...", "company": "..."}
    """
    import anyio
    anyio.run(_enrich_async, lead, job_id, user_id)

async def _enrich_async(lead, job_id, user_id):
    domain = f"{lead['company'].split()[0].lower()}.com"
    email = await call_hunter(lead["first_name"], lead.get("last_name", ""), domain)
    phone = None  # placeholder

    async with db.async_session() as s:
        await s.execute(
            text(
                "INSERT INTO contacts (job_id, first_name, last_name, company, email, enriched) "
                "VALUES (:job, :fn, :ln, :co, :em, true)"
            ),
            {"job": job_id, "fn": lead["first_name"], "ln": lead.get("last_name"), "co": lead["company"], "em": email},
        )
        # incr completed
        await s.execute(
            text("UPDATE import_jobs SET completed = completed + 1 WHERE id = :jid"),
            {"jid": job_id},
        )
        await s.commit()
