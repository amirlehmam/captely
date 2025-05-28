import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from common.config import get_settings

settings = get_settings()
security = HTTPBearer()

async def verify_api_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    Validates an API token with the auth service and returns the associated user_id
    if the token is valid, otherwise raises an HTTPException.
    """
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API token",
        )
    
    try:
        # Call auth service to validate token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"http://auth-service:8001/auth/validate-token",
                json={"token": token},
                timeout=5.0,
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid API token",
                )
                
            data = response.json()
            return str(data["user_id"])
                
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to authentication service",
        ) 