"""
FlowStudio WebSocket API
Handles real-time communication for execution updates
"""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional

from ..services.websocket_manager import connection_manager
from ..api.deps_external_auth import verify_token_with_auth_server

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_current_user_websocket(websocket: WebSocket, token: str = Query(...)):
    """
    Get current user from WebSocket query parameter token
    """
    try:
        user_data = await verify_token_with_auth_server(token)
        if not user_data:
            await websocket.close(code=4001, reason="Invalid token")
            return None
        
        return user_data
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Main WebSocket endpoint for real-time execution updates
    
    Usage: ws://localhost:8003/api/fs/ws?token=<access_token>
    """
    
    # Authenticate user
    user_data = await get_current_user_websocket(websocket, token)
    if not user_data:
        return
    
    user_id = user_data.get("id", "unknown")
    
    # Connect user
    await connection_manager.connect(websocket, user_id)
    
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                await handle_websocket_message(websocket, user_id, message)
                
            except json.JSONDecodeError:
                await connection_manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format"
                }, websocket)
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await connection_manager.send_personal_message({
                    "type": "error",
                    "message": "Failed to process message"
                }, websocket)
                
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        connection_manager.disconnect(websocket, user_id)


async def handle_websocket_message(websocket: WebSocket, user_id: str, message: dict):
    """
    Handle incoming WebSocket messages from client
    """
    message_type = message.get("type")
    
    if message_type == "subscribe_execution":
        # Subscribe to execution updates
        execution_id = message.get("execution_id")
        if execution_id:
            connection_manager.subscribe_to_execution(user_id, execution_id)
            await connection_manager.send_personal_message({
                "type": "subscription_confirmed",
                "execution_id": execution_id,
                "message": f"Subscribed to execution {execution_id}"
            }, websocket)
        else:
            await connection_manager.send_personal_message({
                "type": "error",
                "message": "execution_id is required for subscription"
            }, websocket)
    
    elif message_type == "unsubscribe_execution":
        # Unsubscribe from execution updates
        execution_id = message.get("execution_id")
        if execution_id:
            connection_manager.unsubscribe_from_execution(user_id, execution_id)
            await connection_manager.send_personal_message({
                "type": "unsubscription_confirmed",
                "execution_id": execution_id,
                "message": f"Unsubscribed from execution {execution_id}"
            }, websocket)
    
    elif message_type == "ping":
        # Heartbeat/ping message
        await connection_manager.send_personal_message({
            "type": "pong",
            "timestamp": message.get("timestamp")
        }, websocket)
    
    elif message_type == "get_stats":
        # Get connection statistics (for debugging)
        stats = connection_manager.get_connection_stats()
        await connection_manager.send_personal_message({
            "type": "stats",
            "data": stats
        }, websocket)
    
    else:
        await connection_manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }, websocket)


@router.get("/ws/stats")
async def get_websocket_stats():
    """
    Get WebSocket connection statistics
    """
    return connection_manager.get_connection_stats()