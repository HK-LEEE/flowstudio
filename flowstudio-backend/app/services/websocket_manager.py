"""
FlowStudio WebSocket Manager
Handles real-time communication for execution updates
"""
import asyncio
import json
import logging
from typing import Dict, Set, List, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time execution updates
    """
    
    def __init__(self):
        # Store active connections by user_id
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store execution subscriptions: execution_id -> set of user_ids
        self.execution_subscriptions: Dict[str, Set[str]] = {}
        # Reverse lookup: user_id -> set of execution_ids
        self.user_subscriptions: Dict[str, Set[str]] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        
        logger.info(f"User {user_id} connected via WebSocket")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "message": "Connected to FlowStudio execution updates",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                
        # Clean up subscriptions for this user
        if user_id in self.user_subscriptions:
            for execution_id in self.user_subscriptions[user_id].copy():
                self.unsubscribe_from_execution(user_id, execution_id)
            del self.user_subscriptions[user_id]
        
        logger.info(f"User {user_id} disconnected from WebSocket")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {e}")
    
    async def send_to_user(self, message: dict, user_id: str):
        """Send a message to all connections of a specific user"""
        if user_id in self.active_connections:
            disconnected_connections = []
            
            for connection in self.active_connections[user_id].copy():
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to send message to user {user_id}: {e}")
                    disconnected_connections.append(connection)
            
            # Remove failed connections
            for connection in disconnected_connections:
                self.active_connections[user_id].discard(connection)
    
    async def send_personal_message(self, message: str, user_id: str):
        """Send a string message to all connections of a specific user (for chat compatibility)"""
        if user_id in self.active_connections:
            disconnected_connections = []
            
            for connection in self.active_connections[user_id].copy():
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Failed to send personal message to user {user_id}: {e}")
                    disconnected_connections.append(connection)
            
            # Remove failed connections
            for connection in disconnected_connections:
                self.active_connections[user_id].discard(connection)
    
    async def broadcast_to_execution_subscribers(self, message: dict, execution_id: str):
        """Send a message to all users subscribed to an execution"""
        if execution_id in self.execution_subscriptions:
            for user_id in self.execution_subscriptions[execution_id].copy():
                await self.send_to_user(message, user_id)
    
    def subscribe_to_execution(self, user_id: str, execution_id: str):
        """Subscribe a user to execution updates"""
        if execution_id not in self.execution_subscriptions:
            self.execution_subscriptions[execution_id] = set()
        self.execution_subscriptions[execution_id].add(user_id)
        
        if user_id not in self.user_subscriptions:
            self.user_subscriptions[user_id] = set()
        self.user_subscriptions[user_id].add(execution_id)
        
        logger.info(f"User {user_id} subscribed to execution {execution_id}")
    
    def unsubscribe_from_execution(self, user_id: str, execution_id: str):
        """Unsubscribe a user from execution updates"""
        if execution_id in self.execution_subscriptions:
            self.execution_subscriptions[execution_id].discard(user_id)
            if not self.execution_subscriptions[execution_id]:
                del self.execution_subscriptions[execution_id]
        
        if user_id in self.user_subscriptions:
            self.user_subscriptions[user_id].discard(execution_id)
        
        logger.info(f"User {user_id} unsubscribed from execution {execution_id}")
    
    async def send_execution_update(
        self, 
        execution_id: str, 
        update_type: str, 
        data: dict, 
        user_id: Optional[str] = None
    ):
        """Send an execution update to subscribers"""
        message = {
            "type": "execution_update",
            "execution_id": execution_id,
            "update_type": update_type,  # status, progress, component, log, error, result
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if user_id:
            # Send to specific user only
            await self.send_to_user(message, user_id)
        else:
            # Broadcast to all subscribers
            await self.broadcast_to_execution_subscribers(message, execution_id)
    
    async def send_execution_status(self, execution_id: str, status: str, progress: int, user_id: Optional[str] = None):
        """Send execution status update"""
        await self.send_execution_update(
            execution_id=execution_id,
            update_type="status",
            data={
                "status": status,
                "progress": progress
            },
            user_id=user_id
        )
    
    async def send_component_update(
        self, 
        execution_id: str, 
        component_id: str, 
        component_status: str, 
        user_id: Optional[str] = None
    ):
        """Send component execution update"""
        await self.send_execution_update(
            execution_id=execution_id,
            update_type="component",
            data={
                "component_id": component_id,
                "status": component_status
            },
            user_id=user_id
        )
    
    async def send_execution_log(
        self, 
        execution_id: str, 
        level: str, 
        message: str, 
        component_id: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        """Send execution log update"""
        await self.send_execution_update(
            execution_id=execution_id,
            update_type="log",
            data={
                "level": level,
                "message": message,
                "component_id": component_id
            },
            user_id=user_id
        )
    
    async def send_execution_error(
        self, 
        execution_id: str, 
        error_message: str, 
        component_id: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        """Send execution error update"""
        await self.send_execution_update(
            execution_id=execution_id,
            update_type="error",
            data={
                "error_message": error_message,
                "component_id": component_id
            },
            user_id=user_id
        )
    
    async def send_execution_result(self, execution_id: str, results: dict, user_id: Optional[str] = None):
        """Send execution results"""
        await self.send_execution_update(
            execution_id=execution_id,
            update_type="result",
            data={
                "results": results
            },
            user_id=user_id
        )
    
    def get_connection_stats(self) -> dict:
        """Get connection statistics"""
        total_connections = sum(len(connections) for connections in self.active_connections.values())
        return {
            "total_users": len(self.active_connections),
            "total_connections": total_connections,
            "active_executions": len(self.execution_subscriptions),
            "total_subscriptions": sum(len(users) for users in self.execution_subscriptions.values())
        }


# Global connection manager instance
connection_manager = ConnectionManager()


class ExecutionNotifier:
    """
    Helper class to send execution notifications via WebSocket
    """
    
    def __init__(self, manager: ConnectionManager):
        self.manager = manager
    
    async def notify_execution_started(self, execution_id: str, user_id: str):
        """Notify that execution has started"""
        await self.manager.send_execution_status(
            execution_id=execution_id,
            status="running",
            progress=0,
            user_id=user_id
        )
    
    async def notify_execution_progress(self, execution_id: str, progress: int, user_id: str):
        """Notify execution progress update"""
        await self.manager.send_execution_status(
            execution_id=execution_id,
            status="running",
            progress=progress,
            user_id=user_id
        )
    
    async def notify_component_started(self, execution_id: str, component_id: str, user_id: str):
        """Notify that a component has started executing"""
        await self.manager.send_component_update(
            execution_id=execution_id,
            component_id=component_id,
            component_status="running",
            user_id=user_id
        )
    
    async def notify_component_completed(self, execution_id: str, component_id: str, user_id: str):
        """Notify that a component has completed"""
        await self.manager.send_component_update(
            execution_id=execution_id,
            component_id=component_id,
            component_status="completed",
            user_id=user_id
        )
    
    async def notify_component_failed(self, execution_id: str, component_id: str, error: str, user_id: str):
        """Notify that a component has failed"""
        await self.manager.send_component_update(
            execution_id=execution_id,
            component_id=component_id,
            component_status="failed",
            user_id=user_id
        )
        
        await self.manager.send_execution_error(
            execution_id=execution_id,
            error_message=error,
            component_id=component_id,
            user_id=user_id
        )
    
    async def notify_execution_completed(self, execution_id: str, results: dict, user_id: str):
        """Notify that execution has completed"""
        await self.manager.send_execution_status(
            execution_id=execution_id,
            status="completed",
            progress=100,
            user_id=user_id
        )
        
        await self.manager.send_execution_result(
            execution_id=execution_id,
            results=results,
            user_id=user_id
        )
    
    async def notify_execution_failed(self, execution_id: str, error: str, user_id: str):
        """Notify that execution has failed"""
        await self.manager.send_execution_status(
            execution_id=execution_id,
            status="failed",
            progress=0,
            user_id=user_id
        )
        
        await self.manager.send_execution_error(
            execution_id=execution_id,
            error_message=error,
            user_id=user_id
        )


# Global execution notifier instance
execution_notifier = ExecutionNotifier(connection_manager)