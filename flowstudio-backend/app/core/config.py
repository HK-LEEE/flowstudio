"""
FlowStudio Backend Configuration
Manages application settings using Pydantic BaseSettings
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Application settings management class"""
    
    # Project info
    project_name: str = "FlowStudio API"
    version: str = "1.0.0"
    description: str = "Visual Flow Design Platform API"
    
    # Server settings
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8003, env="PORT")
    debug: bool = Field(default=True, env="DEBUG")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    
    # Database settings
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/flowstudio",
        env="DATABASE_URL"
    )
    
    # JWT settings
    jwt_secret_key: str = Field(
        default="your-super-secret-jwt-key-change-this-in-production",
        env="JWT_SECRET_KEY"
    )
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=30, 
        env="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    refresh_token_expire_days: int = Field(
        default=30, 
        env="REFRESH_TOKEN_EXPIRE_DAYS"
    )
    
    # Security settings
    secret_key: str = Field(
        default="your-super-secret-key-change-this-in-production",
        env="SECRET_KEY"
    )
    
    # CORS settings
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3003", "http://127.0.0.1:3003"],
        env="CORS_ORIGINS"
    )
    
    @validator('cors_origins', pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup logging configuration"""
        log_level = getattr(logging, self.log_level.upper(), logging.INFO)
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        if self.debug:
            logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    logger.info("Loading application settings...")
    return Settings()

# Global settings instance
settings = get_settings()