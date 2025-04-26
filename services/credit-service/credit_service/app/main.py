from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse
import pandas as pd
import uuid
import io
import boto3
from jose import jwt
from sqlalchemy import insert

# Shared common utilities
from common import get_settings, celery_app
from common.db import get_session

# Import your SQLAlchemy models
from .models import ImportJob, Contact

# If you need to call your credit service:
# from credit_service.app.credit_service import CreditService

# Initialize FastAPI app
app = FastAPI(title="Captely Import Service")

# Load application settings
settings = get_settings()

# Configure S3 client
s3 = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)

# ---------- JWT verification helper ----------
def verify_jwt(token: str = Depends(...)) -> str:
    """
    Validate JWT and return the subject (user ID).
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except jwt.JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
# ---------------------------------------------

@app.post("/api/imports/file", status_code=status.HTTP_201_CREATED)
async def import_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_jwt),
    session=Depends(get_session)
):
    """
    Accept a CSV or Excel file of leads, enqueue enrichment tasks, and store the job.
    """
    # Read file into DataFrame
    content = await file.read()
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    else:
        df = pd.read_excel(io.BytesIO(content))

    # Validate required columns
    missing = [c for c in ("first_name", "company") if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}"
        )

    # Create an import job record
    job_id = uuid.uuid4()
    await session.execute(
        insert(ImportJob).values(
            id=str(job_id), user_id=user_id, total=df.shape[0], completed=0, status="processing"
        )
    )
    await session.commit()

    # Enqueue enrichment tasks
    for _, row in df.iterrows():
        celery_app.send_task(
            "services.enrichment-service.tasks.enrich_contact",
            args=[row.to_dict(), str(job_id), user_id],
        )

    # Upload raw file to S3
    key = f"{user_id}/{job_id}/{file.filename}"
    s3.upload_fileobj(io.BytesIO(content), settings.s3_bucket_raw, key)

    return JSONResponse({"job_id": str(job_id)})
