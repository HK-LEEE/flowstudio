"""
Authentication API endpoints for FlowStudio
"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr

from ..db.database import get_db
from ..api.deps import get_current_user, UserContext
from ..utils.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_token,
    get_user_by_email
)
from ..models.user import User
from ..core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic models for request/response
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str | None = None
    is_active: bool
    is_admin: bool
    is_verified: bool
    created_at: str | None = None

@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    User login endpoint
    
    Authenticates user with email and password, returns JWT tokens
    """
    logger.info(f"Login attempt for user: {login_data.email}")
    
    try:
        # Authenticate user
        user = await authenticate_user(db, login_data.email, login_data.password)
        if not user:
            logger.warning(f"Failed login attempt for user: {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Update last login time
        user.last_login_at = datetime.utcnow()
        await db.commit()
        
        # Create tokens
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})
        
        logger.info(f"Successful login for user: {user.email}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error for user {login_data.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed due to server error"
        )

@router.post("/refresh", response_model=dict, tags=["Authentication"])
async def refresh_token(
    refresh_data: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Token refresh endpoint
    
    Uses refresh token to generate new access token
    """
    try:
        # Verify refresh token
        payload = verify_token(refresh_data.refresh_token, "refresh")
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Create new access token
        new_access_token = create_access_token(data={"sub": user_id})
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )

@router.post("/logout", response_model=dict, tags=["Authentication"])
async def logout(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    User logout endpoint
    
    Invalidates current tokens (placeholder for token blacklisting)
    """
    logger.info(f"Logout for user: {current_user.email}")
    
    # In a real implementation, you would add tokens to a blacklist
    # For now, just return success response
    
    return {
        "message": "Successfully logged out",
        "status": "success"
    }

@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user_info(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user information
    """
    logger.info(f"User info requested: {current_user.email}")
    
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        is_verified=current_user.is_verified,
        created_at=None  # You can fetch this from the database if needed
    )

@router.post("/register", response_model=dict, tags=["Authentication"])
async def register(
    email: EmailStr = Form(...),
    password: str = Form(...),
    username: str = Form(...),
    full_name: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    User registration endpoint
    
    Creates a new user account
    """
    logger.info(f"Registration attempt for email: {email}")
    
    try:
        # Check if user already exists
        existing_user = await get_user_by_email(db, email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        hashed_password = get_password_hash(password)
        new_user = User(
            email=email,
            username=username,
            password_hash=hashed_password,
            full_name=full_name,
            is_active=True,
            is_verified=False
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        logger.info(f"User registered successfully: {email}")
        
        return {
            "message": "User registered successfully",
            "user_id": str(new_user.id),
            "email": new_user.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Registration error for {email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )