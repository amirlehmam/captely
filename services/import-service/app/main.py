# import-service/main.py

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import insert

import pandas as pd
import uuid
import io
import boto3
from jose import jwt, JWTError

from common import get_settings, celery_app
from common.db import get_session
from .models import ImportJob, Contact

app = FastAPI(
    title="Captely Import Service",
    description="Upload CSV/Excel or push JSON batches of leads for enrichment",
    version="1.0.0",
)

# Load shared settings and initialize S3 client
settings = get_settings()
s3 = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    region_name=settings.aws_default_region,
)

# JWT via HTTP Bearer
security = HTTPBearer()

def verify_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@app.post("/api/imports/file", status_code=status.HTTP_201_CREATED)
async def import_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_jwt),
    session=Depends(get_session),
):
    """
    Upload a CSV or Excel file, create an ImportJob,
    enqueue enrichment tasks, and store the raw file in S3.
    """
    data = await file.read()
    # parse file
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(data))
    else:
        df = pd.read_excel(io.BytesIO(data))

    # validate required columns
    missing = [c for c in ("first_name", "company") if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing columns: {', '.join(missing)}"
        )

    # create job
    job_id = uuid.uuid4()
    await session.execute(
        insert(ImportJob).values(
            id=job_id,
            user_id=user_id,
            total=df.shape[0]
        )
    )
    await session.commit()

    # enqueue enrichment tasks
    for _, row in df.iterrows():
        celery_app.send_task(
            "services.enrichment-service.tasks.enrich_contact",
            args=[row.to_dict(), str(job_id), user_id],
        )

    # upload raw file to S3
    key = f"{user_id}/{job_id}/{file.filename}"
    s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)

    return JSONResponse({"job_id": str(job_id)})

class LeadsBatch(BaseModel):
    leads: list[dict]

@app.post("/api/imports/leads", status_code=status.HTTP_201_CREATED)
async def import_leads(
    batch: LeadsBatch,
    user_id: str = Depends(verify_jwt),
    session=Depends(get_session),
):
    """
    Receive a batch of leads (from the Chrome extension),
    create an ImportJob, and enqueue enrichment tasks.
    """
    job_id = uuid.uuid4()
    total = len(batch.leads)

    await session.execute(
        insert(ImportJob).values(
            id=job_id,
            user_id=user_id,
            total=total
        )
    )
    await session.commit()

    for lead in batch.leads:
        celery_app.send_task(
            "services.enrichment-service.tasks.enrich_contact",
            args=[lead, str(job_id), user_id],
        )

    return {"job_id": str(job_id)}
