from fastapi import FastAPI, Depends, HTTPException
from common import db, get_settings
from sqlalchemy import select, update
from jose import jwt
from credit_service.app.main import app


app = FastAPI(title="Captely Credit Service")
settings = get_settings()

def verify_jwt(token: str = Depends(lambda auth=Depends(...): auth)):
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])["sub"]
    except Exception:
        raise HTTPException(401)

@app.get("/api/credits")
async def credits_me(uid=Depends(verify_jwt), session=Depends(db.get_session)):
    cur = await session.execute(select(text("credits")).select_from(text("users")).where(text("id=:uid")), {"uid": uid})
    return {"credits": cur.scalar_one()}

@app.post("/api/credits/debit")
async def debit(uid: str, amount: int):
    async with db.async_session() as s:
        await s.execute(update(text("users")).where(text("id=:uid")).values(credits=text("credits-:amt")), {"uid": uid, "amt": amount})
        await s.commit()
