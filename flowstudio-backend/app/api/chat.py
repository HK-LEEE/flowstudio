"""
Chat API endpoints for Ollama real-time chat functionality
Provides REST and WebSocket endpoints for chat sessions
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from typing import List, Dict, Any, Optional
import json
import logging
import asyncio
from pydantic import BaseModel

from ..auth.dependencies import get_current_user
from ..services.chat_manager import get_chat_manager, ChatSession, ChatMessage
from ..services.websocket_manager import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# Pydantic models for request/response
class CreateChatSessionRequest(BaseModel):
    model: str = "llama2"
    base_url: str = "http://localhost:11434"
    system_message: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class SendMessageRequest(BaseModel):
    message: str
    stream: bool = True

class ChatSessionResponse(BaseModel):
    session_id: str
    user_id: str
    model: str
    base_url: str
    created_at: str
    updated_at: str
    message_count: int
    settings: Dict[str, Any]

class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str
    metadata: Optional[Dict[str, Any]] = None

# REST API Endpoints

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    request: CreateChatSessionRequest,
    current_user = Depends(get_current_user)
) -> ChatSessionResponse:
    """Create a new chat session"""
    try:
        chat_manager = get_chat_manager()
        
        session = await chat_manager.create_chat_session(
            user_id=current_user.id,
            model=request.model,
            base_url=request.base_url,
            system_message=request.system_message,
            settings=request.settings or {}
        )
        
        logger.info(f"Created chat session {session.session_id} for user {current_user.id}")
        
        return ChatSessionResponse(
            session_id=session.session_id,
            user_id=session.user_id,
            model=session.model,
            base_url=session.base_url,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
            message_count=len(session.messages),
            settings=session.settings
        )
        
    except Exception as e:
        logger.error(f"Failed to create chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create chat session: {str(e)}")

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_user_chat_sessions(
    current_user = Depends(get_current_user)
) -> List[ChatSessionResponse]:
    """Get all chat sessions for the current user"""
    try:
        chat_manager = get_chat_manager()
        sessions = await chat_manager.get_user_sessions(current_user.id)
        
        return [
            ChatSessionResponse(
                session_id=session.session_id,
                user_id=session.user_id,
                model=session.model,
                base_url=session.base_url,
                created_at=session.created_at.isoformat(),
                updated_at=session.updated_at.isoformat(),
                message_count=len(session.messages),
                settings=session.settings
            )
            for session in sessions
        ]
        
    except Exception as e:
        logger.error(f"Failed to get user sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get sessions: {str(e)}")

@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: str,
    current_user = Depends(get_current_user)
) -> ChatSessionResponse:
    """Get a specific chat session"""
    try:
        chat_manager = get_chat_manager()
        session = await chat_manager.get_chat_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Check if user owns this session
        if session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this chat session")
        
        return ChatSessionResponse(
            session_id=session.session_id,
            user_id=session.user_id,
            model=session.model,
            base_url=session.base_url,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
            message_count=len(session.messages),
            settings=session.settings
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(
    session_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
) -> List[ChatMessageResponse]:
    """Get messages from a chat session"""
    try:
        chat_manager = get_chat_manager()
        session = await chat_manager.get_chat_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Check if user owns this session
        if session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this chat session")
        
        # Apply pagination
        messages = session.messages[offset:offset + limit]
        
        return [
            ChatMessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                timestamp=msg.timestamp.isoformat(),
                metadata=msg.metadata
            )
            for msg in messages
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chat messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

@router.post("/sessions/{session_id}/messages")
async def send_chat_message(
    session_id: str,
    request: SendMessageRequest,
    current_user = Depends(get_current_user)
):
    """Send a message to a chat session (streaming response)"""
    try:
        chat_manager = get_chat_manager()
        session = await chat_manager.get_chat_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Check if user owns this session
        if session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this chat session")
        
        # For streaming responses, we'll use Server-Sent Events
        from fastapi.responses import StreamingResponse
        
        async def generate_response():
            async for chunk in chat_manager.send_message(
                session_id=session_id,
                user_message=request.message,
                stream=request.stream
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        
        return StreamingResponse(
            generate_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send chat message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a chat session"""
    try:
        chat_manager = get_chat_manager()
        session = await chat_manager.get_chat_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Check if user owns this session
        if session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this chat session")
        
        success = await chat_manager.delete_session(session_id)
        
        if success:
            return {"message": "Chat session deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete chat session")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@router.delete("/sessions")
async def clear_user_sessions(
    current_user = Depends(get_current_user)
):
    """Clear all chat sessions for the current user"""
    try:
        chat_manager = get_chat_manager()
        deleted_count = await chat_manager.clear_user_sessions(current_user.id)
        
        return {
            "message": f"Cleared {deleted_count} chat sessions",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        logger.error(f"Failed to clear user sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear sessions: {str(e)}")

@router.get("/stats")
async def get_chat_stats(
    current_user = Depends(get_current_user)
):
    """Get chat manager statistics (admin endpoint)"""
    try:
        chat_manager = get_chat_manager()
        stats = await chat_manager.get_session_stats()
        
        # Filter stats for current user only (for privacy)
        user_sessions = await chat_manager.get_user_sessions(current_user.id)
        user_stats = {
            "user_sessions": len(user_sessions),
            "user_messages": sum(len(session.messages) for session in user_sessions),
            "user_models": list(set(session.model for session in user_sessions))
        }
        
        return user_stats
        
    except Exception as e:
        logger.error(f"Failed to get chat stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

# WebSocket Endpoint for Real-time Chat

@router.websocket("/ws/{session_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(..., description="JWT token for authentication")
):
    """WebSocket endpoint for real-time chat"""
    try:
        # TODO: Implement proper WebSocket authentication
        # For now, we'll accept the connection and validate later
        await connection_manager.connect(websocket, session_id)
        
        chat_manager = get_chat_manager()
        session = await chat_manager.get_chat_session(session_id)
        
        if not session:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Chat session not found"
            }))
            await websocket.close()
            return
        
        logger.info(f"WebSocket connected for chat session {session_id}")
        
        try:
            while True:
                # Wait for message from client
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                if message_data.get("type") == "chat_message":
                    user_message = message_data.get("message", "")
                    
                    if user_message:
                        # Stream response back through WebSocket
                        async for chunk in chat_manager.send_message(
                            session_id=session_id,
                            user_message=user_message,
                            stream=True
                        ):
                            await websocket.send_text(json.dumps(chunk))
                
                elif message_data.get("type") == "ping":
                    # Handle ping/pong for connection health
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": asyncio.get_event_loop().time()
                    }))
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for chat session {session_id}")
        except Exception as e:
            logger.error(f"WebSocket error for session {session_id}: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"WebSocket error: {str(e)}"
            }))
        
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Connection failed: {str(e)}"
            }))
            await websocket.close()
        except:
            pass
    
    finally:
        connection_manager.disconnect(websocket)