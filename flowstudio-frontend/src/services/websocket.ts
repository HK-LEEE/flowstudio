/**
 * FlowStudio WebSocket Service
 * Handles real-time communication for execution updates
 */

export interface ExecutionUpdate {
  type: 'execution_update';
  execution_id: string;
  update_type: 'status' | 'progress' | 'component' | 'log' | 'error' | 'result';
  data: any;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export type ExecutionUpdateHandler = (update: ExecutionUpdate) => void;
export type ConnectionHandler = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private executionHandlers: Map<string, Set<ExecutionUpdateHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private isConnecting = false;

  /**
   * Connect to WebSocket server
   */
  connect(token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `ws://localhost:8003/api/fs/ws?token=${encodeURIComponent(token)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.notifyConnectionHandlers(false);
          
          // Attempt to reconnect if not a manual disconnect
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(token);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    this.executionHandlers.clear();
    this.connectionHandlers.clear();
  }

  /**
   * Subscribe to execution updates
   */
  subscribeToExecution(executionId: string, handler: ExecutionUpdateHandler): () => void {
    if (!this.executionHandlers.has(executionId)) {
      this.executionHandlers.set(executionId, new Set());
      
      // Send subscription message to server
      this.sendMessage({
        type: 'subscribe_execution',
        execution_id: executionId
      });
    }

    this.executionHandlers.get(executionId)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.executionHandlers.get(executionId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.executionHandlers.delete(executionId);
          
          // Send unsubscription message to server
          this.sendMessage({
            type: 'unsubscribe_execution',
            execution_id: executionId
          });
        }
      }
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send a message to the server
   */
  private sendMessage(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'execution_update':
        this.handleExecutionUpdate(message as ExecutionUpdate);
        break;
        
      case 'connection_established':
        console.log('WebSocket connection established');
        break;
        
      case 'subscription_confirmed':
        console.log('Subscription confirmed for execution:', message.execution_id);
        break;
        
      case 'unsubscription_confirmed':
        console.log('Unsubscription confirmed for execution:', message.execution_id);
        break;
        
      case 'error':
        console.error('WebSocket error message:', message.message);
        break;
        
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Handle execution update messages
   */
  private handleExecutionUpdate(update: ExecutionUpdate): void {
    const handlers = this.executionHandlers.get(update.execution_id);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(update);
        } catch (error) {
          console.error('Error in execution update handler:', error);
        }
      });
    }
  }

  /**
   * Notify connection handlers of status change
   */
  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(token: string): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect(token).catch(error => {
          console.error('WebSocket reconnect failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Send ping message for heartbeat
   */
  ping(): void {
    this.sendMessage({
      type: 'ping',
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Auto-connect when authentication token is available
export const connectWebSocket = async (): Promise<void> => {
  const token = localStorage.getItem('access_token');
  if (token && !webSocketService.isConnected()) {
    try {
      await webSocketService.connect(token);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }
};

export default webSocketService;