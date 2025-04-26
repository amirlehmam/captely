from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import pandas as pd
import uuid
import io
import boto3

from common import get_settings, celery_app
from common.db import get_session
from sqlalchemy import insert
from .models import ImportJob, Contact

from credit_service.app.credit_service import CreditService

from jose import jwt, JWTError

app = FastAPI(
    title="Captely Import & Credit Service",
    description="Handles CSV/Excel imports, enqueues enrichment tasks, and provides credit info.",
    version="1.0.0",
)

# Load settings and initialize clients
settings = get_settings()
s3 = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    region_name=settings.aws_default_region,
)

# JWT auth via HTTP Bearer
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
    session = Depends(get_session),
):
    """Read uploaded file, record job, enqueue tasks, upload raw to S3."""
    data = await file.read()
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(data))
    else:
        df = pd.read_excel(io.BytesIO(data))

    missing = [col for col in ("first_name", "company") if col not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing columns: {', '.join(missing)}"
        )

    job_id = uuid.uuid4()
    await session.execute(
        insert(ImportJob).values(id=job_id, user_id=user_id, total=df.shape[0])
    )
    await session.commit()

    for _, row in df.iterrows():
        celery_app.send_task(
            "services.enrichment-service.tasks.enrich_contact",
            args=[row.to_dict(), str(job_id), user_id],
        )

    key = f"{user_id}/{job_id}/{file.filename}"
    s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)

    return JSONResponse({"job_id": str(job_id)})

# Instantiate your CreditService
credit_service = CreditService(name="Captely Credit Service")

@app.get("/api/credits/{user_id}", status_code=status.HTTP_200_OK)
async def get_credit_info(user_id: str):
    """Retrieve credit information for a user."""
    return credit_service.get_credit_info(user_id)
