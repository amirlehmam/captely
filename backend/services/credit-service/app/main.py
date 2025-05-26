# services/credit-service/app/main.py

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, APIRouter
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import uuid, io, boto3
from jose import jwt, JWTError
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from common.config import get_settings
from common.db import get_session
from common.celery_app import celery_app

from app.models import ImportJob, User, CreditLog  # your SQLAlchemy models
from app.credit_service import CreditService

# ---- app setup ----

app = FastAPI(
    title="Captely Import & Credit Service",
    description="Handles CSV/Excel imports, enqueues enrichment tasks, and provides credit info.",
    version="1.0.0",
)

settings = get_settings()

origins = [
    "http://localhost:3000",
    # add any other origins (e.g. production hostname) here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,           # allow cookies/auth headers
    allow_methods=["*"],              # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],              # allow any request headers
)

# S3 client (if AWS credentials are available)
s3 = None
try:
    if hasattr(settings, 'aws_access_key_id') and settings.aws_access_key_id:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_default_region,
        )
except Exception as e:
    print(f"Warning: AWS S3 client initialization failed: {e}")

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

    # upload raw file if S3 is available
    if s3 and hasattr(settings, 's3_bucket_raw'):
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

@app.get("/api/credits/{user_id}/balance", status_code=status.HTTP_200_OK)
async def get_credit_balance(user_id: str, auth=Depends(verify_jwt)):
    """
    Return credit balance for a given user_id (frontend expects this endpoint).
    """
    credit_info = credit_service.get_credit_info(user_id)
    return {
        "balance": credit_info.get("balance", 0),
        "used_today": credit_info.get("used_today", 0),
        "limit_daily": credit_info.get("limit_daily", 1000),
        "limit_monthly": credit_info.get("limit_monthly", 30000)
    }

router = APIRouter(prefix="/api/credits")

@router.post("/check_and_decrement")
async def check_and_decrement(data: dict, session: AsyncSession = Depends(get_session)):
    user_id = data.get("user_id")
    count = int(data.get("count", 0))
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.credits < count:
        raise HTTPException(402, "Not enough credits")
    user.credits -= count
    session.add(CreditLog(user_id=user_id, change=-count, reason="enrichment"))
    await session.commit()
    return {"ok": True, "remaining": user.credits}

app.include_router(router)
