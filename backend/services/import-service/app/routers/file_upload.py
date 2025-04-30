from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import insert
import pandas as pd, uuid, io, boto3

from common.config import get_settings
from common.db import get_session
from common.celery_app import celery_app
from app.models import ImportJob

router = APIRouter(prefix="/api/imports")

settings = get_settings()
s3 = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    region_name=settings.aws_default_region,
)

@router.post("/file", status_code=status.HTTP_201_CREATED)
async def import_file(
    file: UploadFile = File(...),
    user_id: str = Depends(),
    session=Depends(get_session),
):
    data = await file.read()
    df = pd.read_csv(io.BytesIO(data)) if file.filename.endswith(".csv") else pd.read_excel(io.BytesIO(data))
    for col in ("first_name","company"):
        if col not in df.columns:
            raise HTTPException(400, f"Missing column: {col}")

    job_id = str(uuid.uuid4())
    await session.execute(insert(ImportJob).values(id=job_id, user_id=user_id, total=df.shape[0]))
    await session.commit()

    for _, row in df.iterrows():
        celery_app.send_task("enrichment_worker.tasks.enrich_contact", args=[row.to_dict(), job_id, user_id])

    key = f"{user_id}/{job_id}/{file.filename}"
    s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)
    return JSONResponse({"job_id": job_id})
