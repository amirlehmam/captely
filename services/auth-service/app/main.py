# services/auth-service/app/main.py

import os
import uuid
import secrets
from datetime import datetime
from typing import List

import jwt
from fastapi import (
    FastAPI, HTTPException, Depends, status
)
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession, create_async_engine
)
from sqlalchemy.orm import sessionmaker
from passlib.hash import bcrypt

from app.models import User, ApiKey  # make sure models.py is in this package

# --- CONFIG & DATABASE SETUP ---

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://captely:captely_pwd@db:5432/captely"
)
JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
ALGORITHM = "HS256"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


# --- Pydantic SCHEMAS ---

class SignupIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: EmailStr
    is_active: bool
    date_joined: datetime

    class Config:
        orm_mode = True


class ApiKeyOut(BaseModel):
    id: str
    key: str
    created_at: datetime
    revoked: bool

    class Config:
        orm_mode = True


# --- APP INIT ---

app = FastAPI(title="Captely Auth Service")


# --- UTILITIES ---

def create_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "iat": datetime.utcnow().timestamp()}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session)
) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# --- ROUTES ---

@app.post(
    "/auth/signup",
    response_model=TokenOut,
    status_code=status.HTTP_201_CREATED
)
async def signup(
    data: SignupIn,
    db: AsyncSession = Depends(get_session)
):
    # 1) Check email uniqueness
    result = await db.execute(
        select(User).where(User.email == data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # 2) Create user
    hashed = bcrypt.hash(data.password)
    new_user = User(
        email=data.email,
        password_hash=hashed
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 3) Return token
    token = create_jwt(new_user.id)
    return TokenOut(access_token=token)


@app.post("/auth/login", response_model=TokenOut)
async def login(
    data: SignupIn,
    db: AsyncSession = Depends(get_session)
):
    # 1) Lookup user
    result = await db.execute(
        select(User).where(User.email == data.email)
    )
    user = result.scalar_one_or_none()
    if not user or not bcrypt.verify(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2) Return token
    token = create_jwt(user.id)
    return TokenOut(access_token=token)


@app.get("/auth/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post(
    "/auth/apikey",
    response_model=ApiKeyOut,
    status_code=status.HTTP_201_CREATED
)
async def create_apikey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    # generate a secure random 64-char hex key
    key_value = secrets.token_hex(32)

    new_key = ApiKey(
        user_id=current_user.id,
        key=key_value,
        revoked=False
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)
    return new_key


@app.get("/auth/apikeys", response_model=List[ApiKeyOut])
async def list_apikeys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id)
        .order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()
