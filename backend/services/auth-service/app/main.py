# services/auth-service/app/main.py

import secrets
from datetime import datetime, timedelta
from typing import List

import jwt
from fastapi import (
    FastAPI, HTTPException, Depends, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from pydantic_settings import BaseSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession, create_async_engine
)
from sqlalchemy.orm import sessionmaker
from passlib.hash import bcrypt

from app.models import User, ApiKey  # your SQLAlchemy ORM models


# --- 1. CONFIGURATION VIA Pydantic BaseSettings --------------------------

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://captely:captely_pwd@db:5432/captely"
    jwt_secret: str = "devsecret"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60  # token lifetime
    cors_origins: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()


# --- 2. DATABASE SETUP ----------------------------------------------------

# async engine & session factory
engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

async def get_session() -> AsyncSession:
    """Dependency: yields an async DB session and closes it after use."""
    async with AsyncSessionLocal() as session:
        yield session


# --- 3. SECURITY UTILITIES ------------------------------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_password_hash(password: str) -> str:
    return bcrypt.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_exp_minutes)
    payload = {
        "sub": user_id,
        "exp": expire.timestamp(),
        "iat": datetime.utcnow().timestamp()
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session)
) -> User:
    """Dependency to fetch & verify the current user from a JWT."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# --- 4. Pydantic SCHEMAS --------------------------------------------------

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


# --- 5. APP INITIALIZATION & CORS -----------------------------------------

app = FastAPI(title="Captely Auth Service")

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

# --- 6. ROUTES -------------------------------------------------------------

@app.post(
    "/auth/signup",
    response_model=TokenOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user and return a JWT",
)
async def signup(
    data: SignupIn,
    db: AsyncSession = Depends(get_session)
):
    # 1) Ensure email is unique
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # 2) Create the user
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 3) Return an access token
    token = create_access_token(user.id)
    return TokenOut(access_token=token)


@app.post(
    "/auth/login",
    response_model=TokenOut,
    summary="Authenticate existing user and return a JWT",
)
async def login(
    data: SignupIn,
    db: AsyncSession = Depends(get_session)
):
    # 1) Lookup user & verify password
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2) Return an access token
    token = create_access_token(user.id)
    return TokenOut(access_token=token)


@app.get(
    "/auth/me",
    response_model=UserOut,
    summary="Get current user's profile",
)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post(
    "/auth/apikey",
    response_model=ApiKeyOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new API key for the current user",
)
async def create_apikey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    # 1) Generate a secure 64-hex string
    key_value = secrets.token_hex(32)

    # 2) Persist the ApiKey
    api_key = ApiKey(
        user_id=current_user.id,
        key=key_value,
        revoked=False
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return api_key


@app.get(
    "/auth/apikeys",
    response_model=List[ApiKeyOut],
    summary="List all API keys for the current user",
)
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
