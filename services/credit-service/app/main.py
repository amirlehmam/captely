from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse
import pandas as pd, uuid, io, boto3, asyncio
from common import get_settings, celery_app, db
from sqlalchemy import insert
from .models import ImportJob, Contact
from credit_service import CreditService

# Now you can use the CreditService class
credit_service = CreditService(name="Captely Credit Service")
credit_info = credit_service.get_credit_info(user_id=12345)
print(credit_info)

app = FastAPI(title="Captely Import Service")

settings = get_settings()
s3 = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)

# -------- auth helper (JWT from auth‑service) ----------
from jose import jwt

def verify_jwt(token: str = Depends(lambda auth=Depends(...): auth)):
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# -------------------------------------------------------

@app.post("/api/imports/file", status_code=201)
async def import_file(
    file: UploadFile = File(...), user_id: str = Depends(verify_jwt), session=Depends(db.get_session)
):
    bytes_ = await file.read()
    df = pd.read_csv(io.BytesIO(bytes_)) if file.filename.endswith(".csv") else pd.read_excel(bytes_)
    if "first_name" not in df.columns or "company" not in df.columns:
        raise HTTPException(400, "Colonnes manquantes (first_name, company)")
    job_id = uuid.uuid4()
    await session.execute(
        insert(ImportJob).values(id=job_id, user_id=user_id, total=df.shape[0])
    )
    await session.commit()

    # push tasks
    for _, row in df.iterrows():
        celery_app.send_task(
            "services.enrichment-service.tasks.enrich_contact",
            args=[row.to_dict(), str(job_id), user_id],
        )
    # upload brut sur S3
    key = f"{user_id}/{job_id}/{file.filename}"
    s3.upload_fileobj(io.BytesIO(bytes_), settings.s3_bucket_raw, key)

    return JSONResponse({"job_id": str(job_id)})
