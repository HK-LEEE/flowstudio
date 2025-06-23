"""
ChatManager for Ollama real-time chat functionality
Handles chat sessions, streaming responses, and chat history
"""
import asyncio
import json
import logging
import time
import uuid
from typing import Dict, List, Optional, AsyncGenerator, Any
from dataclasses import dataclass, asdict
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from .websocket_manager import ConnectionManager

logger = logging.getLogger(__name__)

@dataclass
class ChatMessage:
    """Chat message structure"""
    id: str
    role: str  # 'user', 'assistant', 'system'
    content: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class ChatSession:
    """Chat session structure"""
    session_id: str
    user_id: str
    model: str
    base_url: str
    messages: List[ChatMessage]
    created_at: datetime
    updated_at: datetime
    settings: Dict[str, Any]

class ChatManager:
    """
    Manages Ollama chat sessions with WebSocket support
    """
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.active_sessions: Dict[str, ChatSession] = {}
        self.user_sessions: Dict[str, List[str]] = {}  # user_id -> [session_ids]
    
    async def create_chat_session(
        self,
        user_id: str,
        model: str = "llama2",
        base_url: str = "http://localhost:11434",
        system_message: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> ChatSession:
        """Create a new chat session"""
        session_id = f"chat_{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()
        
        messages = []
        if system_message:
            messages.append(ChatMessage(
                id=f"msg_{uuid.uuid4().hex[:8]}",
                role="system",
                content=system_message,
                timestamp=now
            ))
        
        session = ChatSession(
            session_id=session_id,
            user_id=user_id,
            model=model,
            base_url=base_url,
            messages=messages,
            created_at=now,
            updated_at=now,
            settings=settings or {}
        )
        
        # Store session
        self.active_sessions[session_id] = session
        
        # Add to user's session list
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = []
        self.user_sessions[user_id].append(session_id)
        
        logger.info(f"Created chat session {session_id} for user {user_id} with model {model}")
        return session
    
    async def get_chat_session(self, session_id: str) -> Optional[ChatSession]:
        """Get a chat session by ID"""
        return self.active_sessions.get(session_id)
    
    async def get_user_sessions(self, user_id: str) -> List[ChatSession]:
        """Get all chat sessions for a user"""
        session_ids = self.user_sessions.get(user_id, [])
        return [self.active_sessions[sid] for sid in session_ids if sid in self.active_sessions]
    
    async def send_message(
        self,
        session_id: str,
        user_message: str,
        stream: bool = True
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Send a message and get streaming response
        """
        session = await self.get_chat_session(session_id)
        if not session:
            yield {"error": f"Session {session_id} not found"}
            return
        
        # Add user message
        user_msg = ChatMessage(
            id=f"msg_{uuid.uuid4().hex[:8]}",
            role="user",
            content=user_message,
            timestamp=datetime.utcnow()
        )
        session.messages.append(user_msg)
        
        try:
            # Prepare context for Ollama
            context_messages = []
            for msg in session.messages:
                if msg.role in ["user", "assistant"]:
                    context_messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
            
            # Get settings
            settings = session.settings
            temperature = settings.get('temperature', 0.7)
            top_p = settings.get('top_p', 0.9)
            num_predict = settings.get('num_predict', 1000)
            
            # Prepare Ollama request
            api_url = f"{session.base_url.rstrip('/')}/api/chat"
            payload = {
                "model": session.model,
                "messages": context_messages,
                "stream": stream,
                "options": {
                    "temperature": temperature,
                    "top_p": top_p,
                    "num_predict": num_predict
                }
            }
            
            logger.info(f"Sending chat message to {api_url} with model {session.model}")
            
            # Create assistant message for accumulating response
            assistant_msg = ChatMessage(
                id=f"msg_{uuid.uuid4().hex[:8]}",
                role="assistant",
                content="",
                timestamp=datetime.utcnow()
            )
            
            if stream:
                # Streaming response
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream('POST', api_url, json=payload) as response:
                        if response.status_code != 200:
                            error_msg = f"Ollama API error: {response.status_code}"
                            yield {"error": error_msg}
                            return
                        
                        accumulated_response = ""
                        async for chunk in response.aiter_lines():
                            if chunk:
                                try:
                                    data = json.loads(chunk)
                                    
                                    if "message" in data and "content" in data["message"]:
                                        content = data["message"]["content"]
                                        accumulated_response += content
                                        assistant_msg.content = accumulated_response
                                        
                                        # Yield streaming chunk
                                        yield {
                                            "type": "chunk",
                                            "content": content,
                                            "accumulated": accumulated_response,
                                            "session_id": session_id,
                                            "message_id": assistant_msg.id
                                        }
                                    
                                    # Check if done
                                    if data.get("done", False):
                                        # Add final message to session
                                        session.messages.append(assistant_msg)
                                        session.updated_at = datetime.utcnow()
                                        
                                        # Send completion notification
                                        yield {
                                            "type": "complete",
                                            "session_id": session_id,
                                            "message_id": assistant_msg.id,
                                            "final_content": accumulated_response,
                                            "metadata": {
                                                "total_duration": data.get("total_duration"),
                                                "eval_count": data.get("eval_count"),
                                                "eval_duration": data.get("eval_duration")
                                            }
                                        }
                                        
                                        # Notify via WebSocket
                                        await self.connection_manager.send_personal_message(
                                            json.dumps({
                                                "type": "chat_message_complete",
                                                "session_id": session_id,
                                                "message": asdict(assistant_msg)
                                            }),
                                            session.user_id
                                        )
                                        
                                        break
                                
                                except json.JSONDecodeError:
                                    continue
            
            else:
                # Non-streaming response
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(api_url, json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    response_content = data.get("message", {}).get("content", "")
                    
                    assistant_msg.content = response_content
                    session.messages.append(assistant_msg)
                    session.updated_at = datetime.utcnow()
                    
                    yield {
                        "type": "complete",
                        "session_id": session_id,
                        "message_id": assistant_msg.id,
                        "final_content": response_content,
                        "metadata": {
                            "total_duration": data.get("total_duration"),
                            "eval_count": data.get("eval_count"),
                            "eval_duration": data.get("eval_duration")
                        }
                    }
                else:
                    yield {"error": f"Ollama API error: {response.status_code} - {response.text}"}
        
        except Exception as e:
            logger.error(f"Error in chat session {session_id}: {e}")
            yield {"error": f"Chat error: {str(e)}"}
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a chat session"""
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            user_id = session.user_id
            
            # Remove from active sessions
            del self.active_sessions[session_id]
            
            # Remove from user's session list
            if user_id in self.user_sessions:
                self.user_sessions[user_id] = [
                    sid for sid in self.user_sessions[user_id] if sid != session_id
                ]
            
            logger.info(f"Deleted chat session {session_id}")
            return True
        
        return False
    
    async def clear_user_sessions(self, user_id: str) -> int:
        """Clear all sessions for a user"""
        session_ids = self.user_sessions.get(user_id, [])
        count = 0
        
        for session_id in session_ids:
            if await self.delete_session(session_id):
                count += 1
        
        return count
    
    async def get_session_stats(self) -> Dict[str, Any]:
        """Get chat manager statistics"""
        total_sessions = len(self.active_sessions)
        total_users = len(self.user_sessions)
        
        # Calculate total messages
        total_messages = sum(len(session.messages) for session in self.active_sessions.values())
        
        # Model usage statistics
        model_usage = {}
        for session in self.active_sessions.values():
            model = session.model
            model_usage[model] = model_usage.get(model, 0) + 1
        
        return {
            "total_sessions": total_sessions,
            "total_users": total_users,
            "total_messages": total_messages,
            "model_usage": model_usage,
            "active_session_ids": list(self.active_sessions.keys())
        }

# Global chat manager instance
chat_manager: Optional[ChatManager] = None

def get_chat_manager() -> ChatManager:
    """Get the global chat manager instance"""
    global chat_manager
    if chat_manager is None:
        from .websocket_manager import connection_manager
        chat_manager = ChatManager(connection_manager)
    return chat_manager