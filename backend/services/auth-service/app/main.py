import asyncio
import secrets
from datetime import datetime, timedelta
from typing import List

import jwt
from jwt import ExpiredSignatureError, PyJWTError
from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    status,
    Request
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr
from pydantic_settings import BaseSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine
)
from sqlalchemy.orm import sessionmaker
from passlib.hash import bcrypt
from fastapi.responses import HTMLResponse

from app.models import User, ApiKey, Base  # Your SQLAlchemy Base/metadata
from common.db import async_engine, get_async_session

# 1. SETTINGS
class Settings(BaseSettings):
    database_url: str
    jwt_secret: str = "devsecret"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60
    cors_origins: List[str] = ["http://localhost:5173",
                               "http://localhost:3000",
                               "http://localhost:8000",
                               "http://localhost:8001",
                               "http://localhost:8002",
                               "http://localhost:8003",
                               "chrome-extension://*",
                               "*"]  # Allow all origins

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# 2. DATABASE
# Use common module's database engine instead of creating a new one here
from common.db import async_engine, get_async_session

# For backward compatibility
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

# 3. AUTH HELPERS
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_password_hash(password: str) -> str:
    return bcrypt.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.verify(plain, hashed)

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_exp_minutes)
    payload = {
        "sub": str(user_id),
        "exp": expire
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except PyJWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

# 4. SCHEMAS
class SignupIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True

class ApiKeyOut(BaseModel):
    id: int
    key: str
    created_at: datetime
    revoked: bool

    class Config:
        from_attributes = True

# 5. APP & CORS
app = FastAPI(title="Captely Auth Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize templates
templates = Jinja2Templates(directory="app/templates")

# 6. STARTUP: retry until Postgres is ready
@app.on_event("startup")
async def on_startup():
    for attempt in range(10):
        try:
            async with async_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("✅ Database ready, tables created")
            break
        except Exception as e:
            print(f"⏳ Waiting for DB ({attempt+1}/10): {e}")
            await asyncio.sleep(1)
    else:
        raise RuntimeError("Could not connect to the database after 10 attempts")

# 7. ROUTES

# New API token validation endpoint
class TokenValidateIn(BaseModel):
    token: str

@app.post("/auth/validate-token")
async def validate_token(data: TokenValidateIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.key == data.token, ApiKey.revoked == False))
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API token",
        )
    
    return {"user_id": api_key.user_id}

@app.post("/auth/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def signup(data: SignupIn, db: AsyncSession = Depends(get_db)):
    # unique email
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return TokenOut(access_token=token)

@app.post("/auth/login", response_model=TokenOut)
async def login(data: SignupIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user.id)
    return TokenOut(access_token=token)

@app.get("/auth/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/auth/apikey", response_model=ApiKeyOut, status_code=status.HTTP_201_CREATED)
async def create_apikey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import uuid
    import secrets
    
    key_id = str(uuid.uuid4())
    key_value = secrets.token_hex(32)
    
    # Use direct SQL to avoid type conversion issues
    query = """
    INSERT INTO api_keys (id, user_id, key, revoked) 
    VALUES (:id, :user_id, :key, :revoked)
    RETURNING id, user_id, key, created_at, revoked
    """
    
    params = {
        "id": key_id,
        "user_id": str(current_user.id),  # Explicitly convert to string
        "key": key_value,
        "revoked": False
    }
    
    result = await db.execute(query, params)
    row = result.fetchone()
    await db.commit()
    
    return {
        "id": row[0],
        "key": row[2],
        "created_at": row[3],
        "revoked": row[4]
    }

@app.get("/auth/apikeys", response_model=List[ApiKeyOut])
async def list_apikeys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Use direct SQL query to avoid model conversion issues
    query = """
    SELECT id, user_id, key, created_at, revoked
    FROM api_keys
    WHERE user_id = :user_id
    ORDER BY created_at DESC
    """
    
    result = await db.execute(query, {"user_id": str(current_user.id)})
    rows = result.fetchall()
    
    return [
        {
            "id": row[0],
            "key": row[2],
            "created_at": row[3],
            "revoked": row[4]
        }
        for row in rows
    ]

@app.delete("/auth/apikeys/{key_id}")
async def revoke_apikey(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Use raw SQL to avoid model conversion issues
    query = """
    UPDATE api_keys 
    SET revoked = TRUE
    WHERE id = :key_id AND user_id = :user_id
    RETURNING id
    """
    
    result = await db.execute(
        query, 
        {
            "key_id": key_id,
            "user_id": str(current_user.id)
        }
    )
    
    row = result.fetchone()
    await db.commit()
    
    if not row:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"status": "success"}

@app.get("/dashboard/api-tokens", response_class=HTMLResponse)
async def api_tokens_page(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id, ApiKey.revoked == False)
        .order_by(ApiKey.created_at.desc())
    )
    api_keys = result.scalars().all()
    
    return templates.TemplateResponse(
        "api_tokens.html",
        {
            "request": request,
            "user": current_user,
            "api_keys": api_keys
        }
    )

@app.get("/health", summary="Health check")
async def health():
    return {"status": "ok"}
