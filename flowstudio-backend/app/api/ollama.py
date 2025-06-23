"""
Ollama API endpoints for model management and dynamic loading
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import httpx
import asyncio
import logging
from pydantic import BaseModel

from ..auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ollama", tags=["ollama"])

class OllamaServerInfo(BaseModel):
    url: str
    status: str
    models: List[str]
    error: Optional[str] = None

class ModelInfo(BaseModel):
    name: str
    size: Optional[int] = None
    digest: Optional[str] = None
    modified_at: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class OllamaGenerateRequest(BaseModel):
    base_url: str = "http://localhost:11434"
    model: str
    prompt: str
    system_message: Optional[str] = None
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    top_k: Optional[int] = 40
    num_predict: Optional[int] = 1000
    repeat_penalty: Optional[float] = 1.1
    stream: Optional[bool] = False

class OllamaGenerateResponse(BaseModel):
    response: str
    model: str
    created_at: str
    done: bool
    total_duration: Optional[int] = None
    load_duration: Optional[int] = None
    prompt_eval_count: Optional[int] = None
    prompt_eval_duration: Optional[int] = None
    eval_count: Optional[int] = None
    eval_duration: Optional[int] = None

@router.get("/models")
async def get_ollama_models(
    base_url: str = "http://localhost:11434",
    current_user = Depends(get_current_user)
) -> OllamaServerInfo:
    """
    Fetch available models from Ollama server
    """
    try:
        # Clean up the base URL
        base_url = base_url.rstrip('/')
        api_url = f"{base_url}/api/tags"
        
        logger.info(f"Fetching Ollama models from {api_url}")
        
        # Make request to Ollama server
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(api_url)
        
        if response.status_code == 200:
            data = response.json()
            models = []
            
            # Extract model names from response
            if 'models' in data:
                for model_info in data['models']:
                    if 'name' in model_info:
                        models.append(model_info['name'])
            
            return OllamaServerInfo(
                url=base_url,
                status="connected",
                models=sorted(models)
            )
        
        else:
            error_msg = f"Ollama server error: {response.status_code}"
            logger.error(error_msg)
            return OllamaServerInfo(
                url=base_url,
                status="error",
                models=[],
                error=error_msg
            )
    
    except httpx.ConnectError:
        error_msg = f"Cannot connect to Ollama server at {base_url}"
        logger.error(error_msg)
        return OllamaServerInfo(
            url=base_url,
            status="disconnected",
            models=[],
            error=error_msg
        )
    
    except Exception as e:
        error_msg = f"Error fetching models: {str(e)}"
        logger.error(error_msg)
        return OllamaServerInfo(
            url=base_url,
            status="error",
            models=[],
            error=error_msg
        )

@router.get("/models/detailed")
async def get_ollama_models_detailed(
    base_url: str = "http://localhost:11434",
    current_user = Depends(get_current_user)
) -> List[ModelInfo]:
    """
    Fetch detailed model information from Ollama server
    """
    try:
        base_url = base_url.rstrip('/')
        api_url = f"{base_url}/api/tags"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(api_url)
        
        if response.status_code == 200:
            data = response.json()
            models = []
            
            if 'models' in data:
                for model_info in data['models']:
                    models.append(ModelInfo(
                        name=model_info.get('name', ''),
                        size=model_info.get('size'),
                        digest=model_info.get('digest'),
                        modified_at=model_info.get('modified_at'),
                        details=model_info.get('details', {})
                    ))
            
            return sorted(models, key=lambda x: x.name)
        
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ollama server error: {response.text}"
            )
    
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama server at {base_url}"
        )
    
    except Exception as e:
        logger.error(f"Error fetching detailed models: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching models: {str(e)}"
        )

@router.post("/test-connection")
async def test_ollama_connection(
    base_url: str = "http://localhost:11434",
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Test connection to Ollama server
    """
    try:
        base_url = base_url.rstrip('/')
        
        # Test basic connectivity
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/api/tags")
        
        if response.status_code == 200:
            data = response.json()
            model_count = len(data.get('models', []))
            
            return {
                "status": "success",
                "message": f"Connected to Ollama server at {base_url}",
                "server_url": base_url,
                "model_count": model_count,
                "response_time": response.elapsed.total_seconds()
            }
        else:
            return {
                "status": "error",
                "message": f"Server responded with status {response.status_code}",
                "server_url": base_url,
                "error_details": response.text
            }
    
    except httpx.ConnectError:
        return {
            "status": "error",
            "message": f"Cannot connect to Ollama server at {base_url}",
            "server_url": base_url,
            "suggestion": "Please ensure Ollama is running and accessible"
        }
    
    except Exception as e:
        return {
            "status": "error",
            "message": f"Connection test failed: {str(e)}",
            "server_url": base_url
        }

@router.get("/health")
async def ollama_health_check(
    base_url: str = "http://localhost:11434"
) -> Dict[str, Any]:
    """
    Health check endpoint for Ollama server (no auth required)
    """
    try:
        base_url = base_url.rstrip('/')
        
        start_time = asyncio.get_event_loop().time()
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{base_url}/api/tags")
        
        response_time = asyncio.get_event_loop().time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            return {
                "status": "healthy",
                "server_url": base_url,
                "response_time_ms": round(response_time * 1000, 2),
                "model_count": len(data.get('models', [])),
                "api_version": data.get('version', 'unknown')
            }
        else:
            return {
                "status": "unhealthy",
                "server_url": base_url,
                "error": f"HTTP {response.status_code}"
            }
    
    except Exception as e:
        return {
            "status": "unhealthy",
            "server_url": base_url,
            "error": str(e)
        }

@router.post("/generate")
async def generate_ollama_response(
    request: OllamaGenerateRequest,
    current_user = Depends(get_current_user)
) -> OllamaGenerateResponse:
    """
    Generate response using Ollama LLM
    """
    try:
        base_url = request.base_url.rstrip('/')
        api_url = f"{base_url}/api/generate"
        
        # Prepare the request payload
        payload = {
            "model": request.model,
            "prompt": request.prompt,
            "stream": request.stream,
            "options": {
                "temperature": request.temperature,
                "top_p": request.top_p,
                "top_k": request.top_k,
                "num_predict": request.num_predict,
                "repeat_penalty": request.repeat_penalty
            }
        }
        
        # Add system message if provided
        if request.system_message:
            payload["system"] = request.system_message
        
        logger.info(f"Generating Ollama response with model {request.model}")
        
        # Make request to Ollama server
        async with httpx.AsyncClient(timeout=120.0) as client:  # 2 minute timeout for generation
            response = await client.post(api_url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            
            return OllamaGenerateResponse(
                response=data.get("response", ""),
                model=data.get("model", request.model),
                created_at=data.get("created_at", ""),
                done=data.get("done", True),
                total_duration=data.get("total_duration"),
                load_duration=data.get("load_duration"),
                prompt_eval_count=data.get("prompt_eval_count"),
                prompt_eval_duration=data.get("prompt_eval_duration"),
                eval_count=data.get("eval_count"),
                eval_duration=data.get("eval_duration")
            )
        
        else:
            error_msg = f"Ollama generation failed: {response.status_code} - {response.text}"
            logger.error(error_msg)
            raise HTTPException(
                status_code=response.status_code,
                detail=error_msg
            )
    
    except httpx.ConnectError:
        error_msg = f"Cannot connect to Ollama server at {request.base_url}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=503,
            detail=error_msg
        )
    
    except httpx.TimeoutException:
        error_msg = "Ollama generation request timed out"
        logger.error(error_msg)
        raise HTTPException(
            status_code=504,
            detail=error_msg
        )
    
    except Exception as e:
        error_msg = f"Error generating Ollama response: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )