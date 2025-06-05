import asyncio
import secrets
import httpx
import json
import random
import os
from datetime import datetime, timedelta
from typing import List, Optional

import jwt
from jwt import ExpiredSignatureError, PyJWTError
from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    status,
    Request,
    Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr, field_validator
from pydantic_settings import BaseSettings
from sqlalchemy import select, text, delete
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine
)
from sqlalchemy.orm import sessionmaker
from passlib.hash import bcrypt
from fastapi.responses import HTMLResponse
from uuid import UUID
import uvicorn
import resend

from app.models import User, ApiKey, EmailVerification, Base  # Your SQLAlchemy Base/metadata
from common.db import async_engine, AsyncSessionLocal

# 1. SETTINGS
class Settings(BaseSettings):
    database_url: str
    jwt_secret: str = "devsecret"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60
    # OAuth settings - these will read from VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars
    vite_google_client_id: str = "placeholder-google-client-id"
    google_client_secret: str = "placeholder-google-client-secret"
    # Email settings
    resend_api_key: str = "re_123456789"  # Will be overridden by env var
    cors_origins: List[str] = ["http://localhost:5173",
                               "http://localhost:3000",
                               "http://localhost:8000",
                               "http://localhost:8001",
                               "http://localhost:8002",
                               "http://localhost:8003",
                               "chrome-extension://*"]  # Remove wildcard when using credentials

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        
    @property
    def google_client_id(self) -> str:
        """Get Google Client ID from VITE_GOOGLE_CLIENT_ID env var"""
        return self.vite_google_client_id

settings = Settings()

# Initialize Resend
resend.api_key = settings.resend_api_key

# Professional email domains validation - Enhanced with more domains
GENERIC_EMAIL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'live.com', 'msn.com', 'ymail.com', 'protonmail.com',
    'mail.com', 'gmx.com', 'tutanota.com', 'zoho.com', 'fastmail.com',
    'me.com', 'mac.com', 'yandex.com', 'rediffmail.com', 'inbox.com',
    'mail.ru', 'rambler.ru', 'qq.com', '163.com', 'sina.com',
    'web.de', 't-online.de', 'freenet.de', 'orange.fr', 'laposte.net',
    'free.fr', 'wanadoo.fr', 'hotmail.fr', 'yahoo.fr', 'sfr.fr'
]

def validate_professional_email(email: str) -> bool:
    """Validate that email is from a professional domain"""
    domain = email.split('@')[1].lower() if '@' in email else ''
    return domain not in GENERIC_EMAIL_DOMAINS

# 2. DATABASE
# Use common module's database engine instead of creating a new one here
from common.db import async_engine, AsyncSessionLocal

# Updated get_db function to properly manage sessions
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# 3. AUTH HELPERS
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_password_hash(password: str) -> str:
    return bcrypt.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_exp_minutes)
    payload = {
        "sub": str(user_id),  # Ensure it's a string
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
        user_id = sub
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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    credits: int
    created_at: datetime
    is_active: bool = True

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True

class ApiKeyOut(BaseModel):
    id: str
    key: str
    created_at: datetime
    revoked: bool

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True

# Add OAuth models after existing Pydantic models
class OAuthSignupIn(BaseModel):
    provider: str  # 'google' or 'apple'
    credential: Optional[str] = None  # Google ID token
    authorization: Optional[dict] = None  # Apple authorization
    user: Optional[dict] = None  # Apple user info

class OAuthCompleteIn(BaseModel):
    first_name: str
    last_name: str
    company: str
    phone: str
    auth_method: str

# Email verification models
class EmailVerificationRequest(BaseModel):
    email: EmailStr

class EmailVerificationCode(BaseModel):
    email: EmailStr
    code: str

class VerificationResponse(BaseModel):
    message: str
    success: bool

# Google OAuth verification function
async def verify_google_token(credential: str) -> dict:
    """Verify Google ID token and extract user info"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid Google token")
            
            user_info = response.json()
            
            # Verify the token is for our app
            expected_client_id = settings.google_client_id
            if user_info.get('aud') != expected_client_id:
                raise HTTPException(status_code=400, detail="Invalid token audience")
            
            return {
                'email': user_info.get('email'),
                'first_name': user_info.get('given_name'),
                'last_name': user_info.get('family_name'),
                'verified': user_info.get('email_verified', False)
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google token verification failed: {str(e)}")

async def verify_apple_token(authorization: dict, user_info: dict) -> dict:
    """Verify Apple ID token and extract user info"""
    try:
        # In production, you would verify the Apple JWT token
        # For now, we'll trust the provided information
        return {
            'email': user_info.get('email'),
            'first_name': user_info.get('name', {}).get('firstName'),
            'last_name': user_info.get('name', {}).get('lastName'),
            'verified': True  # Apple emails are always verified
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Apple token verification failed: {str(e)}")

# Email service functions
async def send_verification_email(email: str, code: str) -> bool:
    """Send verification email using Resend"""
    try:
        params = {
            "from": "Captely <onboarding@resend.dev>",  # Using Resend test domain
            "to": [email],
            "subject": "🔐 Verify your Captely account",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #059669; margin: 0;">Captely</h1>
                    <p style="color: #6b7280; margin: 5px 0;">Professional Contact Enrichment</p>
                </div>
                
                <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0;">
                    <h2 style="color: #111827; margin: 0 0 20px 0;">Verify your email address</h2>
                    <p style="color: #4b5563; margin: 0 0 20px 0;">
                        Welcome to Captely! Please use the verification code below to complete your account setup:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background: #059669; color: white; display: inline-block; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                            {code}
                        </div>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                        This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.
                    </p>
                </div>
                
                <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
                    <p>© 2025 Captely. All rights reserved.</p>
                </div>
            </div>
            """
        }
        
        response = resend.Emails.send(params)
        print(f"Email sent successfully to {email}: {response}")
        return True
        
    except Exception as e:
        print(f"Failed to send email to {email}: {str(e)}")
        return False

async def cleanup_expired_codes(db: AsyncSession):
    """Clean up expired verification codes"""
    try:
        await db.execute(
            delete(EmailVerification).where(
                EmailVerification.expires_at < datetime.utcnow()
            )
        )
        await db.commit()
    except Exception as e:
        print(f"Error cleaning up expired codes: {e}")

async def create_verification_code(email: str, db: AsyncSession) -> str:
    """Create and store a new verification code"""
    # Clean up any existing codes for this email
    await db.execute(
        delete(EmailVerification).where(EmailVerification.email == email)
    )
    
    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    
    # Store new verification code
    verification = EmailVerification(
        email=email,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=10)  # 10 minutes expiry
    )
    
    db.add(verification)
    await db.commit()
    
    return code

# 5. APP & CORS
app = FastAPI(title="Captely Auth Service")

# Define CORS origins explicitly without wildcards
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000", 
    "http://localhost:8001",
    "http://localhost:8002",
    "http://localhost:8003",
    # Production domains
    "https://captely.com",
    "https://www.captely.com",
    "http://captely.com",
    "http://www.captely.com",
    # Add server IP addresses for DigitalOcean deployment
    "http://164.90.232.146:3000",
    "http://164.90.232.146:8001",
    "http://164.90.232.146:8002",
    "http://164.90.232.146:8003",
    "http://164.90.232.146:8004",
    "http://164.90.232.146:8005",
    "http://164.90.232.146:8006",
    "http://164.90.232.146:8007",
    "http://164.90.232.146:8008",
    # Add any chrome extension origins if needed
    # "chrome-extension://your-extension-id"
]

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
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

@app.options("/auth/validate-token", include_in_schema=False)
async def options_validate_token():
    """
    Handle preflight CORS for token validation
    """
    return {}  # Return empty response with CORS headers from middleware

@app.post("/auth/validate-token")
async def validate_token(data: TokenValidateIn, db: AsyncSession = Depends(get_db)):
    try:
        # Log the incoming token for debugging
        print(f"Validating token: {data.token[:10]}...")
        
        # First try to validate as JWT token
        try:
            payload = jwt.decode(
                data.token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm]
            )
            user_id = payload.get("sub")
            if user_id:
                print(f"JWT token validation successful for user_id: {user_id}")
                return {"user_id": user_id, "valid": True}
        except (ExpiredSignatureError, PyJWTError) as jwt_error:
            print(f"JWT validation failed: {jwt_error}")
            # Continue to try API key validation
        
        # If JWT fails, try API key validation
        query = text("""
        SELECT user_id 
        FROM api_keys 
        WHERE key = :token AND revoked = FALSE
        """)
        
        result = await db.execute(query, {"token": data.token})
        row = result.fetchone()
        
        if row:
            user_id = row[0]
            print(f"API key validation successful for user_id: {user_id}")
            return {"user_id": user_id, "valid": True}
        
        print(f"Token validation failed: No matching token found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error validating token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating token: {str(e)}"
        )

@app.post("/auth/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def signup(data: SignupIn, db: AsyncSession = Depends(get_db)):
    try:
        print(f"Signup attempt for email: {data.email}")
        
        # Validate professional email for regular signups
        if not validate_professional_email(data.email):
            raise HTTPException(
                status_code=400, 
                detail="Please use your professional email address (not Gmail, Yahoo, etc.)"
            )
        
        # Check email verification status
        verification_result = await db.execute(
            select(EmailVerification).where(
                EmailVerification.email == data.email,
                EmailVerification.verified == True
            ).order_by(EmailVerification.created_at.desc())
        )
        
        verification = verification_result.scalar_one_or_none()
        if not verification:
            raise HTTPException(
                status_code=400, 
                detail="Email not verified. Please verify your email first."
            )
        
        # unique email
        existing = await db.execute(select(User).where(User.email == data.email))
        existing_user = existing.scalar_one_or_none()
        
        if existing_user:
            print(f"User already exists: {data.email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        print(f"Creating new user for: {data.email}")
        user = User(
            email=data.email,
            password_hash=get_password_hash(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            company=data.company,
            phone=data.phone,
            credits=5000,  # Professional plan: 5000 credits for new users
            total_spent=0,
            email_verified=True,  # Email is verified
            auth_provider='email'
        )
        db.add(user)
        
        # Clean up the verification record
        await db.delete(verification)
        
        await db.commit()
        await db.refresh(user)

        print(f"User created successfully: {user.id}")
        token = create_access_token(str(user.id))
        return TokenOut(access_token=token)
    except HTTPException as e:
        print(f"HTTPException in signup: {e.detail}")
        raise
    except Exception as e:
        print(f"Unexpected error in signup: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Add the missing /api/auth/register/ endpoint as an alias
@app.options("/api/auth/register/", include_in_schema=False)
async def options_register():
    """Handle preflight CORS for registration"""
    return {}

@app.post("/api/auth/register/", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(data: SignupIn, db: AsyncSession = Depends(get_db)):
    """Registration endpoint alias for /auth/signup"""
    return await signup(data, db)

@app.post("/auth/login", response_model=TokenOut)
async def login(data: SignupIn, db: AsyncSession = Depends(get_db)):
    try:
        print(f"Login attempt for email: {data.email}")
        
        result = await db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"User not found: {data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print(f"User found: {user.email}, verifying password...")
        if not verify_password(data.password, user.password_hash):
            print(f"Password verification failed for: {data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print(f"Login successful for: {data.email}")
        token = create_access_token(str(user.id))
        return TokenOut(access_token=token)
    except HTTPException as e:
        print(f"HTTPException in login: {e.detail}")
        raise
    except Exception as e:
        print(f"Unexpected error in login: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/auth/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

# Add missing profile endpoint that frontend expects
@app.get("/api/auth/profile/", response_model=UserOut)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/auth/apikey", response_model=ApiKeyOut, status_code=status.HTTP_201_CREATED)
async def create_apikey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        import uuid
        import secrets
        
        key_id = str(uuid.uuid4())
        key_value = secrets.token_hex(32)
        
        # Use direct SQL with text() to avoid type conversion issues
        query = text("""
        INSERT INTO api_keys (id, user_id, key, revoked) 
        VALUES (:id, :user_id, :key, :revoked)
        RETURNING id, user_id, key, created_at, revoked
        """)
        
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
    except Exception as e:
        print(f"Error creating API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating API key: {str(e)}"
        )

@app.get("/auth/apikeys", response_model=List[ApiKeyOut])
async def list_apikeys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Use direct SQL query with text() to avoid model conversion issues
        query = text("""
        SELECT id, user_id, key, created_at, revoked
        FROM api_keys
        WHERE user_id = :user_id
        ORDER BY created_at DESC
        """)
        
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
    except Exception as e:
        print(f"Error in list_apikeys: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching API keys: {str(e)}"
        )

@app.delete("/auth/apikeys/{key_id}")
async def revoke_apikey(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Use raw SQL with text() to avoid model conversion issues
        query = text("""
        UPDATE api_keys 
        SET revoked = TRUE
        WHERE id = :key_id AND user_id = :user_id
        RETURNING id
        """)
        
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
    except Exception as e:
        print(f"Error revoking API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error revoking API key: {str(e)}"
        )

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

@app.get("/extension/get-token", response_model=ApiKeyOut)
async def generate_extension_token():
    """
    Creates a token specifically for the extension to use
    """
    try:
        import uuid
        import secrets
        
        # First find the test user
        db = AsyncSessionLocal()
        result = await db.execute(select(User).where(User.email == 'test@captely.com'))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test user not found"
            )
        
        # Generate token
        key_id = str(uuid.uuid4())
        key_value = secrets.token_hex(32)
        
        # Use direct SQL with text() to avoid type conversion issues
        query = text("""
        INSERT INTO api_keys (id, user_id, key, revoked) 
        VALUES (:id, :user_id, :key, :revoked)
        RETURNING id, user_id, key, created_at, revoked
        """)
        
        params = {
            "id": key_id,
            "user_id": str(user.id),  # Explicitly convert to string
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
    except Exception as e:
        print(f"Error creating extension token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating extension token: {str(e)}"
        )
    finally:
        await db.close()

# User profile endpoints
@app.get("/api/users/profile")
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get current user's profile"""
    try:
        # current_user is already a User object from get_current_user
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "phone": current_user.phone,
            "company": current_user.company,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "is_active": current_user.is_active
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/users/profile")
async def update_user_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Update user profile"""
    try:
        # Update allowed fields directly on the current_user object
        if "first_name" in profile_data:
            current_user.first_name = profile_data["first_name"]
        if "last_name" in profile_data:
            current_user.last_name = profile_data["last_name"]
        if "phone" in profile_data:
            current_user.phone = profile_data["phone"]
        if "company" in profile_data:
            current_user.company = profile_data["company"]
        
        current_user.updated_at = datetime.utcnow()
        session.add(current_user)
        await session.commit()
        
        return {"message": "Profile updated successfully"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users/change-password")
async def change_password(
    password_data: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Change user password"""
    try:
        # Validate input
        if not all(k in password_data for k in ["current_password", "new_password"]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify current password
        if not verify_password(password_data["current_password"], current_user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect current password")
        
        # Update password
        current_user.password_hash = get_password_hash(password_data["new_password"])
        current_user.updated_at = datetime.utcnow()
        session.add(current_user)
        await session.commit()
        
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Team management endpoints (for future multi-user support)
@app.get("/api/team/members")
async def get_team_members(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get team members (currently returns only the current user)"""
    try:
        # For now, just return the current user
        return [{
            "id": str(current_user.id),
            "name": f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email,
            "email": current_user.email,
            "role": "admin",
            "status": "active",
            "joined_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "last_active": datetime.utcnow().isoformat()
        }]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Security logs endpoint
@app.get("/api/security/logs")
async def get_security_logs(
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, le=100),
    session: AsyncSession = Depends(get_db)
):
    """Get security logs for the user"""
    try:
        # This would query an audit_logs table in production
        # For now, return mock data
        return [{
            "id": "1",
            "event": "Login successful",
            "ip_address": "192.168.1.1",
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success"
        }]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Settings endpoints
@app.get("/api/settings/{key}")
async def get_setting(
    key: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get a specific user setting"""
    try:
        # This would query a user_settings table
        # For now, return from local storage on frontend
        return {"key": key, "value": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/settings/{key}")
async def update_setting(
    key: str,
    value: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Update a user setting"""
    try:
        # This would update a user_settings table
        # For now, settings are stored in frontend localStorage
        return {"message": f"Setting {key} updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add OAuth endpoints after existing routes

# Email verification endpoints
@app.post("/auth/send-verification", response_model=VerificationResponse)
async def send_verification_code(
    data: EmailVerificationRequest, 
    db: AsyncSession = Depends(get_db)
):
    """Send verification code to email"""
    try:
        # Validate professional email
        if not validate_professional_email(data.email):
            raise HTTPException(
                status_code=400, 
                detail="Please use your professional email address (not Gmail, Yahoo, etc.)"
            )
        
        # Check if user already exists
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Clean up expired codes
        await cleanup_expired_codes(db)
        
        # Check rate limiting (max 3 attempts per email per hour)
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_attempts = await db.execute(
            select(EmailVerification).where(
                EmailVerification.email == data.email,
                EmailVerification.created_at > one_hour_ago
            )
        )
        
        if len(recent_attempts.scalars().all()) >= 3:
            raise HTTPException(
                status_code=429, 
                detail="Too many verification attempts. Please try again later."
            )
        
        # Generate and send code
        code = await create_verification_code(data.email, db)
        
        # Send email
        if await send_verification_email(data.email, code):
            return VerificationResponse(
                message="Verification code sent successfully",
                success=True
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to send verification email"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in send_verification_code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/verify-email", response_model=VerificationResponse)
async def verify_email_code(
    data: EmailVerificationCode,
    db: AsyncSession = Depends(get_db)
):
    """Verify email with code"""
    try:
        # Clean up expired codes
        await cleanup_expired_codes(db)
        
        # Find the verification record
        result = await db.execute(
            select(EmailVerification).where(
                EmailVerification.email == data.email,
                EmailVerification.verified == False
            ).order_by(EmailVerification.created_at.desc())
        )
        
        verification = result.scalar_one_or_none()
        
        if not verification:
            raise HTTPException(
                status_code=400,
                detail="No pending verification found for this email"
            )
        
        # Check if code is expired
        if verification.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=400,
                detail="Verification code has expired"
            )
        
        # Increment attempts
        verification.attempts += 1
        
        # Check max attempts (5 attempts max)
        if verification.attempts > 5:
            # Delete the verification record
            await db.delete(verification)
            await db.commit()
            raise HTTPException(
                status_code=400,
                detail="Too many failed attempts. Please request a new code."
            )
        
        # Check if code matches
        if verification.code != data.code:
            await db.commit()  # Save the incremented attempts
            raise HTTPException(
                status_code=400,
                detail="Invalid verification code"
            )
        
        # Mark as verified
        verification.verified = True
        await db.commit()
        
        return VerificationResponse(
            message="Email verified successfully",
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in verify_email_code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/oauth/signup")
async def oauth_signup(data: OAuthSignupIn, db: AsyncSession = Depends(get_db)):
    """Handle OAuth signup from Google or Apple"""
    try:
        user_info = None
        
        if data.provider == 'google' and data.credential:
            user_info = await verify_google_token(data.credential)
        elif data.provider == 'apple' and data.authorization:
            user_info = await verify_apple_token(data.authorization, data.user or {})
        else:
            raise HTTPException(status_code=400, detail="Invalid OAuth provider or missing credentials")
        
        if not user_info or not user_info.get('email'):
            raise HTTPException(status_code=400, detail="Unable to get user email from OAuth provider")
        
        email = user_info['email']
        
        # Check if user already exists
        result = await db.execute(select(User).where(User.email == email))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # User exists, log them in
            token = create_access_token(str(existing_user.id))
            return {
                "user": {
                    "id": str(existing_user.id),
                    "email": existing_user.email,
                    "first_name": existing_user.first_name,
                    "last_name": existing_user.last_name
                },
                "needsInfo": False,
                "token": token
            }
        
        # Create new user with OAuth info
        new_user = User(
            email=email,
            first_name=user_info.get('first_name', ''),
            last_name=user_info.get('last_name', ''),
            password_hash='',  # No password for OAuth users
            auth_provider=data.provider,
            email_verified=user_info.get('verified', False),
            is_active=True
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        # Check if user needs to complete profile
        needs_info = not all([
            new_user.first_name,
            new_user.last_name,
            new_user.company,
            new_user.phone
        ])
        
        token = create_access_token(str(new_user.id))
        
        return {
            "user": {
                "id": str(new_user.id),
                "email": new_user.email,
                "first_name": new_user.first_name,
                "last_name": new_user.last_name
            },
            "needsInfo": needs_info,
            "token": token
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"OAuth signup failed: {str(e)}")

@app.post("/auth/oauth/complete")
async def complete_oauth_signup(
    data: OAuthCompleteIn, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Complete OAuth user profile"""
    try:
        # Update user with additional information
        current_user.first_name = data.first_name
        current_user.last_name = data.last_name
        current_user.company = data.company
        current_user.phone = data.phone
        
        await db.commit()
        await db.refresh(current_user)
        
        return {
            "user": {
                "id": str(current_user.id),
                "email": current_user.email,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name,
                "company": current_user.company,
                "phone": current_user.phone
            },
            "success": True
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Profile completion failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
