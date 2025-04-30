from fastapi import APIRouter, Depends
from pydantic import BaseModel
from common.celery_app import celery_app
from common.db import get_session
from sqlalchemy import insert
import uuid

from app.models import ImportJob

router = APIRouter(prefix="/api/scraper")

class LeadIn(BaseModel):
    first_name: str
    last_name: str | None
    position: str | None
    company: str
    profile_url: str | None
    location: str | None
    industry: str | None

@router.post("/leads", status_code=201)
async def import_salesnav(leads: list[LeadIn], user_id: str = Depends(), session=Depends(get_session)):
    job_id = str(uuid.uuid4())
    await session.execute(insert(ImportJob).values(id=job_id, user_id=user_id, total=len(leads)))
    await session.commit()
    for lead in leads:
        celery_app.send_task("enrichment_worker.tasks.enrich_contact", args=[lead.dict(), job_id, user_id])
    return {"job_id": job_id}
