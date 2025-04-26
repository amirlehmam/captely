from fastapi import APIRouter, Depends
from sqlalchemy.future import select
from common.db import get_session

from app.models import ImportJob

router = APIRouter(prefix="/api")

@router.get("/jobs")
async def list_jobs(user_id: str = Depends(), session=Depends(get_session)):
    q = await session.execute(select(ImportJob).where(ImportJob.user_id == user_id))
    jobs = q.scalars().all()
    return [{"id": j.id, "total": j.total, "completed": j.completed, "status": j.status} for j in jobs]
