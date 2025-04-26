# services/credit-service/app/main.py

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import pandas as pd
import uuid, io, boto3
from jose import jwt, JWTError
from sqlalchemy import insert

from common.config import get_settings
from common.db import get_session
from common.celery_app import celery_app

from app.models import ImportJob  # your SQLAlchemy models
from app.credit_service import CreditService

# ---- app setup ----

app = FastAPI(
    title="Captely Import & Credit Service",
    description="Handles CSV/Excel imports, enqueues enrichment tasks, and provides credit info.",
    version="1.0.0",
)

settings = get_settings()

# S3 client
s3 = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    region_name=settings.aws_default_region,
)

# JWT auth via HTTPBearer
security = HTTPBearer()

def verify_jwt(
    creds: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    token = creds.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# ---- import endpoint ----

@app.post("/api/imports/file", status_code=status.HTTP_201_CREATED)
async def import_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_jwt),
    session = Depends(get_session),
):
    """
    1) Read CSV or Excel; 
    2) record job in ImportJob; 
    3) enqueue a Celery task per row; 
    4) upload raw file to S3.
    """
    data = await file.read()
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(data))
    else:
        df = pd.read_excel(io.BytesIO(data))

    missing = [c for c in ("first_name","company") if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing columns: {', '.join(missing)}"
        )

    job_id = str(uuid.uuid4())
    await session.execute(
        insert(ImportJob).values(id=job_id, user_id=user_id, total=df.shape[0])
    )
    await session.commit()

    # enqueue each row
    for _, row in df.iterrows():
        celery_app.send_task(
            # match the name you gave in enrichment-worker/tasks.py
            "enrichment_worker.tasks.enrich_contact",
            args=[row.to_dict(), job_id, user_id],
        )

    # upload raw file
    key = f"{user_id}/{job_id}/{file.filename}"
    s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)

    return JSONResponse({"job_id": job_id})

# ---- credit endpoint ----

credit_service = CreditService(name="Captely Credit Service")

@app.get("/api/credits/{user_id}", status_code=status.HTTP_200_OK)
async def get_credit_info(user_id: str, auth=Depends(verify_jwt)):
    """
    Return credit info for a given user_id.
    Note: we depend on verify_jwt above so only valid tokens can query.
    """
    return credit_service.get_credit_info(user_id)
