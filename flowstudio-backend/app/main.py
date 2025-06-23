"""
FlowStudio FastAPI Application
Main entry point for the FlowStudio backend API
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import settings
from .db.database import init_db, close_db
from .api import flowstudio, ollama, chat, flow_execution
from .routers import flow_api

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting FlowStudio API...")
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down FlowStudio API...")
    await close_db()

# Create FastAPI application
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description=settings.description,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    flowstudio.router,
    prefix="/api/fs",
    tags=["FlowStudio"]
)

app.include_router(
    flow_api.router,
    tags=["Flow API"]
)

app.include_router(
    ollama.router,
    prefix="/api",
    tags=["Ollama"]
)

app.include_router(
    chat.router,
    prefix="/api",
    tags=["Chat"]
)

app.include_router(
    flow_execution.router,
    prefix="/api",
    tags=["Flow Execution"]
)

# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "FlowStudio API"}

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to FlowStudio API",
        "version": settings.version,
        "docs": "/docs" if settings.debug else "Documentation not available in production"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )