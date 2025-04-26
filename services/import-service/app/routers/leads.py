from fastapi import APIRouter, Depends
from pydantic import BaseModel
import uuid

from common.config import get_settings
from common.celery_app import celery_app
from app.models import ImportJob
from sqlalchemy import insert
from common.db import get_session

router = APIRouter(prefix="/api/imports")

settings = get_settings()

class LeadIn(BaseModel):
    first_name: str
    last_name: str | None
    position: str | None
    company: str
    profile_url: str | None
    location: str | None
    industry: str | None

@router.post("/leads", status_code=201)
async def import_leads(leads: list[LeadIn], user_id: str = Depends(), session=Depends(get_session)):
    job_id = str(uuid.uuid4())
    total = len(leads)
    await session.execute(insert(ImportJob).values(id=job_id, user_id=user_id, total=total))
    await session.commit()
    for lead in leads:
        celery_app.send_task("enrichment_worker.tasks.enrich_contact", args=[lead.dict(), job_id, user_id])
    return {"job_id": job_id}
