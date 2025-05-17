from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from common.db import get_session
from common.auth import verify_api_token
from fastapi.responses import StreamingResponse
import pandas as pd
import io

from app.models import ImportJob, Contact

router = APIRouter(prefix="/api")

@router.get("/jobs")
async def list_jobs(user_id: str = Depends(verify_api_token), session=Depends(get_session)):
    q = await session.execute(select(ImportJob).where(ImportJob.user_id == user_id))
    jobs = q.scalars().all()
    return [{"id": j.id, "total": j.total, "completed": j.completed, "status": j.status} for j in jobs]

@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user_id: str = Depends(verify_api_token), session=Depends(get_session)):
    job = await session.get(ImportJob, job_id)
    if not job or job.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    contacts = (await session.execute(select(Contact).where(Contact.job_id == job_id))).scalars().all()
    return {
        "id": job.id,
        "status": job.status,
        "total": job.total,
        "completed": job.completed,
        "file_name": job.file_name,
        "contacts": [
            {
                "id": c.id,
                "first_name": c.first_name,
                "last_name": c.last_name,
                "company": c.company,
                "email": c.email,
                "phone": c.phone,
                "enriched": c.enriched,
                "enrichment_status": c.enrichment_status,
                "enrichment_score": c.enrichment_score,
                "enrichment_provider": c.enrichment_provider,
                "email_verified": c.email_verified,
                "phone_verified": c.phone_verified
            } for c in contacts
        ]
    }

@router.get("/jobs/{job_id}/export")
async def export_job(job_id: str, user_id: str = Depends(verify_api_token), session=Depends(get_session)):
    job = await session.get(ImportJob, job_id)
    if not job or job.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    contacts = (await session.execute(select(Contact).where(Contact.job_id == job_id))).scalars().all()
    df = pd.DataFrame([
        {
            "first_name": c.first_name,
            "last_name": c.last_name,
            "company": c.company,
            "email": c.email,
            "phone": c.phone,
            "enriched": c.enriched,
            "enrichment_status": c.enrichment_status,
            "enrichment_score": c.enrichment_score,
            "enrichment_provider": c.enrichment_provider,
            "email_verified": c.email_verified,
            "phone_verified": c.phone_verified
        } for c in contacts
    ])
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)
    return StreamingResponse(stream, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={job.file_name or job.id}.csv"})
