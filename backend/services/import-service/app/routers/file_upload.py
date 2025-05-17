from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import insert
import pandas as pd, uuid, io, boto3, httpx

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
    mapping: dict = None,  # Optional: column mapping from frontend
):
    data = await file.read()
    df = pd.read_csv(io.BytesIO(data)) if file.filename.endswith(".csv") else pd.read_excel(io.BytesIO(data))

    # Deduplication: drop duplicates by email or phone
    if "email" in df.columns:
        df = df.drop_duplicates(subset=["email"])
    elif "phone" in df.columns:
        df = df.drop_duplicates(subset=["phone"])
    else:
        df = df.drop_duplicates()

    # Cleaning: trim whitespace, fill NaN with None
    df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x)
    df = df.where(pd.notnull(df), None)

    # Column mapping (if provided)
    if mapping:
        df = df.rename(columns=mapping)
        mapping_str = str(mapping)
    else:
        mapping_str = None

    for col in ("first_name","company"):
        if col not in df.columns:
            raise HTTPException(400, f"Missing column: {col}")

    # Credit check
    try:
        resp = httpx.post(
            "http://credit-service:8000/api/credits/check_and_decrement",
            json={"user_id": user_id, "count": int(df.shape[0])},
            timeout=5.0,
        )
        if resp.status_code != 200:
            raise HTTPException(402, "Not enough credits")
    except Exception as e:
        raise HTTPException(500, f"Credit service error: {e}")

    job_id = str(uuid.uuid4())
    await session.execute(insert(ImportJob).values(
        id=job_id,
        user_id=user_id,
        total=df.shape[0],
        file_name=file.filename,
        mapping=mapping_str,
        type="csv" if file.filename.endswith(".csv") else "xlsx"
    ))
    await session.commit()

    for _, row in df.iterrows():
        celery_app.send_task("enrichment_worker.tasks.enrich_contact", args=[row.to_dict(), job_id, user_id])

    key = f"{user_id}/{job_id}/{file.filename}"
    s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)
    return JSONResponse({"job_id": job_id, "mapping": mapping, "total": df.shape[0], "status": "processing"})
