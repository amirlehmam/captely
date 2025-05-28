from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from common.celery_app import celery_app
from common.db import get_session
from common.auth import verify_api_token
from sqlalchemy import insert
import uuid
import os
from typing import Optional

from app.models import ImportJob

router = APIRouter(prefix="/api/v1/import")

class EnrichmentRequest(BaseModel):
    file_path: str
    user_id: str
    max_contacts: Optional[int] = None

@router.post("/enrich")
async def enrich_csv(
    request: EnrichmentRequest,
    session = Depends(get_session)
):
    """Start an enrichment job for a CSV file."""
    # Validate file exists
    if not os.path.exists(request.file_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File not found: {request.file_path}"
        )
        
    # Generate a unique job ID
    job_id = f"enrich_{uuid.uuid4()}"
    
    # Create job record
    session.execute(
        insert(ImportJob).values(
            id=job_id,
            user_id=request.user_id,
            status="pending",
            total=0,  # Will be updated by the worker
            completed=0,
            file_name=os.path.basename(request.file_path)
        )
    )
    session.commit()
    
    # Send task to Celery worker
    celery_app.send_task(
        "app.tasks.process_enrichment_batch",
        args=[request.file_path, job_id, request.user_id],
        kwargs={"max_contacts": request.max_contacts}
    )
    
    return {"job_id": job_id, "status": "pending"} 