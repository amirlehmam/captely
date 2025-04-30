import secrets
from datetime import datetime, timedelta
from typing import List

import jwt
from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from pydantic_settings import BaseSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine
)
from sqlalchemy.orm import sessionmaker
from passlib.hash import bcrypt
from jwt import ExpiredSignatureError, PyJWTError

from app.models import User, ApiKey, Base  # Base = declarative_base()

# 1. CONFIGURATION
class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://captely:captely_pwd@db:5432/captely"
    jwt_secret: str = "devsecret"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60
    cors_origins: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()


# 2. DATABASE SETUP
engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


# 3. SECURITY UTILITIES
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_password_hash(password: str) -> str:
    return bcrypt.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.verify(plain, hashed)

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_exp_minutes)
    payload = {
        "sub": str(user_id),
        "iat": datetime.utcnow().timestamp(),
        "exp": expire.timestamp(),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session)
) -> User:
    # 1) Decode & validate JWT
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = int(sub)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2) Fetch the User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# 4. Pydantic SCHEMAS
class SignupIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True

class ApiKeyOut(BaseModel):
    id: int
    key: str
    created_at: datetime
    revoked: bool

    class Config:
        orm_mode = True


# 5. APP INITIALIZATION & CORS
app = FastAPI(title="Captely Auth Service")

# Use the origins from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup (async)
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# 6. ROUTES
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
    # Ensure email is unique
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create & persist the user
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate token
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
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, getattr(user, "password_hash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
    key_value = secrets.token_hex(32)
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
