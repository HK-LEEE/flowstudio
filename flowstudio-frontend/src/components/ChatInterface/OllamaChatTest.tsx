import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  List,
  Avatar,
  Spin,
  Select,
  Divider,
  Tag,
  Alert,
  Row,
  Col,
  Tooltip,
  Modal,
  Form,
  InputNumber,
  Switch,
  message as antdMessage
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  SettingOutlined,
  ClearOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  ApiOutlined,
  MessageOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import './OllamaChatTest.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  metadata?: {
    total_duration?: number;
    eval_count?: number;
    eval_duration?: number;
  };
}

interface ChatSession {
  session_id: string;
  user_id: string;
  model: string;
  base_url: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  settings: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
}

const OllamaChatTest: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  
  // Configuration state
  const [config, setConfig] = useState({
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
    temperature: 0.7,
    top_p: 0.9,
    num_predict: 1000,
    systemMessage: 'You are a helpful AI assistant.'
  });
  
  // UI state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showConnectionTest, setShowConnectionTest] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<Input>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load available models from Ollama
  const loadModels = useCallback(async () => {
    setModelLoading(true);
    try {
      const response = await fetch(`/api/ollama/models?base_url=${encodeURIComponent(config.baseUrl)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'connected' && data.models) {
          setAvailableModels(data.models.map((name: string) => ({ name })));
          setConnectionStatus('connected');
          
          // If current model is not in the list, set to first available
          if (!data.models.includes(config.model) && data.models.length > 0) {
            setConfig(prev => ({ ...prev, model: data.models[0] }));
          }
        } else {
          setConnectionStatus('error');
          antdMessage.error(data.error || 'Failed to connect to Ollama server');
        }
      } else {
        setConnectionStatus('error');
        antdMessage.error('Failed to fetch models from Ollama server');
      }
    } catch (error) {
      setConnectionStatus('error');
      antdMessage.error('Network error connecting to Ollama server');
      console.error('Model loading error:', error);
    } finally {
      setModelLoading(false);
    }
  }, [config.baseUrl, config.model]);

  // Test connection to Ollama server
  const testConnection = useCallback(async () => {
    setShowConnectionTest(true);
    try {
      const response = await fetch(`/api/ollama/test-connection?base_url=${encodeURIComponent(config.baseUrl)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setConnectionStatus('connected');
        antdMessage.success(`Connected to Ollama server (${data.model_count} models available)`);
        await loadModels();
      } else {
        setConnectionStatus('error');
        antdMessage.error(data.message || 'Connection test failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      antdMessage.error('Connection test failed');
      console.error('Connection test error:', error);
    } finally {
      setShowConnectionTest(false);
    }
  }, [config.baseUrl, loadModels]);

  // Create new chat session
  const createChatSession = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          model: config.model,
          base_url: config.baseUrl,
          system_message: config.systemMessage,
          settings: {
            temperature: config.temperature,
            top_p: config.top_p,
            num_predict: config.num_predict
          }
        })
      });

      if (response.ok) {
        const session = await response.json();
        setCurrentSession(session);
        setMessages([]);
        antdMessage.success('New chat session created');
        return session;
      } else {
        throw new Error('Failed to create chat session');
      }
    } catch (error) {
      antdMessage.error('Failed to create chat session');
      console.error('Session creation error:', error);
      return null;
    }
  }, [config]);

  // Send message with streaming response
  const sendMessage = useCallback(async () => {
    if (!currentMessage.trim() || isLoading) return;
    
    // Create session if none exists
    let session = currentSession;
    if (!session) {
      session = await createChatSession();
      if (!session) return;
    }

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setIsStreaming(true);

    // Create assistant message placeholder
    const assistantMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/chat/sessions/${session.session_id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';
      let finalMetadata = {};

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'chunk') {
                  accumulatedContent += data.content;
                  // Update the assistant message with accumulated content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ));
                } else if (data.type === 'complete') {
                  finalMetadata = data.metadata || {};
                  // Mark message as complete
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { 
                          ...msg, 
                          content: data.final_content || accumulatedContent,
                          isStreaming: false,
                          metadata: finalMetadata
                        }
                      : msg
                  ));
                } else if (data.error) {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      
      if (error.name === 'AbortError') {
        antdMessage.info('Message cancelled');
      } else {
        antdMessage.error('Failed to send message: ' + error.message);
        
        // Update assistant message with error
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { 
                ...msg, 
                content: `Error: ${error.message}`,
                isStreaming: false
              }
            : msg
        ));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [currentMessage, currentSession, createChatSession]);

  // Cancel current streaming response
  const cancelMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Clear chat messages
  const clearChat = useCallback(() => {
    setMessages([]);
    if (isStreaming) {
      cancelMessage();
    }
  }, [isStreaming, cancelMessage]);

  // Delete current session
  const deleteSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      const response = await fetch(`/api/chat/sessions/${currentSession.session_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setCurrentSession(null);
        setMessages([]);
        antdMessage.success('Chat session deleted');
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      antdMessage.error('Failed to delete chat session');
      console.error('Session deletion error:', error);
    }
  }, [currentSession]);

  // Handle Enter key in input
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Format duration
  const formatDuration = (nanoseconds?: number) => {
    if (!nanoseconds) return '';
    return `${(nanoseconds / 1000000).toFixed(0)}ms`;
  };

  // Initialize component
  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="ollama-chat-test">
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <RobotOutlined style={{ color: '#ff6b35' }} />
              <Title level={4} style={{ margin: 0 }}>
                🦙 Ollama Chat Test
              </Title>
              <Tag color={connectionStatus === 'connected' ? 'green' : 'red'}>
                {connectionStatus.toUpperCase()}
              </Tag>
            </Space>
            <Space>
              <Tooltip title="Connection Test">
                <Button
                  icon={<ApiOutlined />}
                  onClick={testConnection}
                  loading={showConnectionTest}
                  size="small"
                />
              </Tooltip>
              <Tooltip title="Settings">
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setShowConfigModal(true)}
                  size="small"
                />
              </Tooltip>
              <Tooltip title="Clear Chat">
                <Button
                  icon={<ClearOutlined />}
                  onClick={clearChat}
                  size="small"
                  disabled={messages.length === 0}
                />
              </Tooltip>
              <Tooltip title="Delete Session">
                <Button
                  icon={<DeleteOutlined />}
                  onClick={deleteSession}
                  size="small"
                  disabled={!currentSession}
                  danger
                />
              </Tooltip>
            </Space>
          </div>
        }
        className="chat-card"
      >
        {/* Connection Alert */}
        {connectionStatus === 'error' && (
          <Alert
            message="Ollama Connection Error"
            description="Cannot connect to Ollama server. Please check that Ollama is running and accessible."
            type="error"
            showIcon
            action={
              <Button size="small" onClick={testConnection} loading={showConnectionTest}>
                Retry
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Session Info */}
        {currentSession && (
          <Alert
            message={
              <Space>
                <MessageOutlined />
                <Text>Session: {currentSession.session_id}</Text>
                <Text>Model: {currentSession.model}</Text>
                <Text>Messages: {currentSession.message_count}</Text>
              </Space>
            }
            type="info"
            showIcon={false}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Messages Area */}
        <div className="messages-container">
          <List
            dataSource={messages}
            renderItem={(message) => (
              <List.Item className={`message-item ${message.role}`}>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      style={{ 
                        backgroundColor: message.role === 'user' ? '#1890ff' : '#ff6b35' 
                      }}
                    />
                  }
                  title={
                    <Space>
                      <Text strong>
                        {message.role === 'user' ? 'You' : 'Ollama'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatTime(message.timestamp)}
                      </Text>
                      {message.isStreaming && (
                        <Spin size="small" />
                      )}
                      {message.metadata && (
                        <Space>
                          {message.metadata.eval_duration && (
                            <Tag icon={<ClockCircleOutlined />} color="blue" size="small">
                              {formatDuration(message.metadata.eval_duration)}
                            </Tag>
                          )}
                          {message.metadata.eval_count && (
                            <Tag color="green" size="small">
                              {message.metadata.eval_count} tokens
                            </Tag>
                          )}
                        </Space>
                      )}
                    </Space>
                  }
                  description={
                    <Paragraph
                      style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                      copyable={!message.isStreaming}
                    >
                      {message.content || (message.isStreaming ? 'Thinking...' : '')}
                    </Paragraph>
                  }
                />
              </List.Item>
            )}
          />
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-area">
          <Row gutter={8}>
            <Col flex="auto">
              <TextArea
                ref={inputRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={connectionStatus !== 'connected' || isLoading}
              />
            </Col>
            <Col>
              <Space direction="vertical">
                {isStreaming ? (
                  <Button
                    type="primary"
                    danger
                    icon={<PauseCircleOutlined />}
                    onClick={cancelMessage}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={sendMessage}
                    disabled={!currentMessage.trim() || connectionStatus !== 'connected'}
                    loading={isLoading}
                  >
                    Send
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </div>
      </Card>

      {/* Configuration Modal */}
      <Modal
        title="Ollama Configuration"
        open={showConfigModal}
        onCancel={() => setShowConfigModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowConfigModal(false)}>
            Cancel
          </Button>,
          <Button
            key="test"
            onClick={() => {
              testConnection();
              setShowConfigModal(false);
            }}
          >
            Test & Apply
          </Button>
        ]}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="Ollama Server URL">
            <Input
              value={config.baseUrl}
              onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="http://localhost:11434"
            />
          </Form.Item>

          <Form.Item label="Model">
            <Select
              value={config.model}
              onChange={(value) => setConfig(prev => ({ ...prev, model: value }))}
              loading={modelLoading}
              style={{ width: '100%' }}
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <Divider style={{ margin: '4px 0' }} />
                  <div style={{ padding: '8px', textAlign: 'center' }}>
                    <Button
                      type="link"
                      icon={<PlayCircleOutlined />}
                      onClick={loadModels}
                      size="small"
                    >
                      Refresh Models
                    </Button>
                  </div>
                </div>
              )}
            >
              {availableModels.map(model => (
                <Option key={model.name} value={model.name}>
                  {model.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="System Message">
            <TextArea
              value={config.systemMessage}
              onChange={(e) => setConfig(prev => ({ ...prev, systemMessage: e.target.value }))}
              rows={3}
              placeholder="You are a helpful AI assistant."
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Temperature">
                <InputNumber
                  value={config.temperature}
                  onChange={(value) => setConfig(prev => ({ ...prev, temperature: value || 0.7 }))}
                  min={0}
                  max={2}
                  step={0.1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Top P">
                <InputNumber
                  value={config.top_p}
                  onChange={(value) => setConfig(prev => ({ ...prev, top_p: value || 0.9 }))}
                  min={0}
                  max={1}
                  step={0.1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Max Tokens">
                <InputNumber
                  value={config.num_predict}
                  onChange={(value) => setConfig(prev => ({ ...prev, num_predict: value || 1000 }))}
                  min={1}
                  max={4000}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default OllamaChatTest;