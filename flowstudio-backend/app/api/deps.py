"""
FastAPI dependencies for authentication and authorization
"""
import logging
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr

from ..db.database import get_db
from ..models.user import User
from ..utils.auth import verify_token, get_user_by_id

logger = logging.getLogger(__name__)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=True
)

class UserContext(BaseModel):
    """Current user context model"""
    id: str
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True
    is_verified: bool = False
    
    class Config:
        from_attributes = True

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> UserContext:
    """
    Dependency to get current authenticated user from JWT token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Verify token
        payload = verify_token(token, "access")
        if payload is None:
            logger.warning("Invalid token provided")
            raise credentials_exception
        
        user_id = payload.get("sub")
        if user_id is None:
            logger.warning("Token missing user ID")
            raise credentials_exception
            
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise credentials_exception
    
    # Get user from database
    try:
        user = await get_user_by_id(db, user_id)
        if user is None:
            logger.warning(f"User not found: {user_id}")
            raise credentials_exception
        
        if not user.is_active:
            logger.warning(f"Inactive user attempted access: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user account"
            )
        
        # Create user context
        user_context = UserContext(
            id=str(user.id),
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            is_admin=user.is_admin,
            is_active=user.is_active,
            is_verified=user.is_verified
        )
        
        logger.debug(f"User authenticated: {user.email}")
        return user_context
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during authentication: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

async def get_current_admin_user(
    current_user: UserContext = Depends(get_current_user)
) -> UserContext:
    """
    Dependency to ensure current user has admin privileges
    """
    if not current_user.is_admin:
        logger.warning(f"Non-admin user attempted admin access: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return current_user

async def get_current_active_user(
    current_user: UserContext = Depends(get_current_user)
) -> UserContext:
    """
    Dependency to ensure current user is active (additional verification)
    """
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted access: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive"
        )
    
    return current_user

# Optional authentication dependency (allows unauthenticated access)
oauth2_optional_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False
)

async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_optional_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[UserContext]:
    """
    Optional authentication dependency - returns user if authenticated, None otherwise
    """
    if not token:
        return None
    
    try:
        return await get_current_user(token, db)
    except HTTPException:
        # Return None instead of raising exception for optional auth
        return None