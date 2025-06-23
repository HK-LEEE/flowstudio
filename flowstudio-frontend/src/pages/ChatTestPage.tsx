import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layout,
  Card,
  Input,
  Button,
  List,
  Avatar,
  Typography,
  Space,
  Tag,
  message as antdMessage,
  Select,
  Divider,
  Spin,
  Alert,
  Row,
  Col
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ClearOutlined,
  SettingOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { apiService } from '../services/api';
import { useAuth } from '../store/authStore';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  nodeId?: string;
  nodeType?: string;
  executionData?: any;
}

interface FlowExecutionResult {
  success: boolean;
  results: Record<string, any>;
  executionTime: number;
  error?: string;
}

const ChatTestPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [availableFlows, setAvailableFlows] = useState<any[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load available flows on mount and check URL parameters
  useEffect(() => {
    loadAvailableFlows();
    
    // Check for flowId URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const flowIdParam = urlParams.get('flowId');
    if (flowIdParam) {
      setSelectedFlowId(flowIdParam);
      antdMessage.info(`Flow ${flowIdParam} selected from URL parameter`);
    }
  }, []);

  const loadAvailableFlows = async () => {
    try {
      setLoadingFlows(true);
      const response = await apiService.getAxiosInstance().get('/flows');
      if (response.data) {
        // Filter flows that have chat_input nodes
        const chatFlows = response.data.filter((flow: any) => {
          if (!flow.flow_data?.nodes) return false;
          return flow.flow_data.nodes.some((node: any) => 
            node.data?.template?.component_type === 'chat_input' ||
            node.data?.template?.component_type === 'text_input'
          );
        });
        setAvailableFlows(chatFlows);
        if (chatFlows.length > 0 && !selectedFlowId) {
          setSelectedFlowId(chatFlows[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading flows:', error);
      antdMessage.error('Failed to load flows');
    } finally {
      setLoadingFlows(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedFlowId || isExecuting) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsExecuting(true);

    try {
      // Execute flow with user input
      const result = await executeFlowWithInput(selectedFlowId, userMessage.content);
      
      if (result.success) {
        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.results.response || 'No response generated',
          timestamp: new Date().toISOString(),
          executionData: result.results
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Show execution time
        antdMessage.success(`Flow executed in ${result.executionTime}ms`);
      } else {
        // Add error message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${result.error || 'Flow execution failed'}`,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, errorMessage]);
        antdMessage.error('Flow execution failed');
      }
    } catch (error) {
      console.error('Error executing flow:', error);
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      antdMessage.error('Flow execution error');
    } finally {
      setIsExecuting(false);
    }
  };

  const executeFlowWithInput = async (flowId: string, userInput: string): Promise<FlowExecutionResult> => {
    const startTime = Date.now();
    
    try {
      // Load flow data
      const flowResponse = await apiService.getAxiosInstance().get(`/flows/${flowId}/data`);
      const flowData = flowResponse.data;
      
      if (!flowData?.flow_data?.nodes) {
        throw new Error('Invalid flow data');
      }

      // Find chat input node
      const chatInputNode = flowData.flow_data.nodes.find((node: any) => 
        node.data?.template?.component_type === 'chat_input' ||
        node.data?.template?.component_type === 'text_input'
      );

      if (!chatInputNode) {
        throw new Error('No chat input node found in flow');
      }

      // Execute flow starting from chat input node
      const executionResponse = await apiService.getAxiosInstance().post('/flows/execute', {
        flow_id: flowId,
        input_data: {
          [chatInputNode.id]: {
            message: userInput,
            text: userInput,
            user_id: user?.id || 'anonymous',
            session_id: `session-${Date.now()}`,
            timestamp: new Date().toISOString()
          }
        },
        execution_mode: 'chat'
      });

      const endTime = Date.now();
      
      if (executionResponse.data?.success) {
        return {
          success: true,
          results: executionResponse.data.results,
          executionTime: endTime - startTime
        };
      } else {
        return {
          success: false,
          results: {},
          executionTime: endTime - startTime,
          error: executionResponse.data?.error || 'Unknown execution error'
        };
      }
    } catch (error) {
      const endTime = Date.now();
      return {
        success: false,
        results: {},
        executionTime: endTime - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const getMessageAvatar = (role: string) => {
    switch (role) {
      case 'user':
        return <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />;
      case 'assistant':
        return <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />;
      case 'system':
        return <Avatar icon={<SettingOutlined />} style={{ backgroundColor: '#fa8c16' }} />;
      default:
        return <Avatar icon={<MessageOutlined />} />;
    }
  };

  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return { backgroundColor: '#e6f7ff', borderLeft: '4px solid #1890ff' };
      case 'assistant':
        return { backgroundColor: '#f6ffed', borderLeft: '4px solid #52c41a' };
      case 'system':
        return { backgroundColor: '#fff7e6', borderLeft: '4px solid #fa8c16' };
      default:
        return {};
    }
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Content style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Card style={{ marginBottom: '16px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Title level={3} style={{ margin: 0 }}>Chat Flow Test</Title>
                <Tag color="blue">Interactive Testing</Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                <Select
                  value={selectedFlowId}
                  onChange={setSelectedFlowId}
                  placeholder="Select a flow to test"
                  style={{ width: 300 }}
                  loading={loadingFlows}
                >
                  {availableFlows.map(flow => (
                    <Option key={flow.id} value={flow.id}>
                      {flow.name} ({flow.flow_data?.nodes?.length || 0} nodes)
                    </Option>
                  ))}
                </Select>
                <Button icon={<ClearOutlined />} onClick={clearMessages}>
                  Clear
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Messages */}
        <Card 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ 
            flex: 1, 
            overflow: 'auto', 
            padding: '16px 0',
            maxHeight: 'calc(100vh - 300px)'
          }}>
            {!selectedFlowId ? (
              <Alert
                message="No Flow Selected"
                description="Please select a flow that contains a Chat Input or Text Input node to start testing."
                type="info"
                showIcon
              />
            ) : messages.length === 0 ? (
              <Alert
                message="Ready to Test"
                description={`Selected flow is ready for testing. Type a message below to start the conversation.`}
                type="success"
                showIcon
              />
            ) : (
              <List
                dataSource={messages}
                renderItem={(message) => (
                  <List.Item style={{ padding: '12px 0', border: 'none' }}>
                    <div style={{ 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '8px',
                      ...getMessageStyle(message.role)
                    }}>
                      <List.Item.Meta
                        avatar={getMessageAvatar(message.role)}
                        title={
                          <Space>
                            <Text strong>
                              {message.role === 'user' ? 'You' : 
                               message.role === 'assistant' ? 'Assistant' : 'System'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </Text>
                          </Space>
                        }
                        description={
                          <div>
                            <Text>{message.content}</Text>
                            {message.executionData && (
                              <div style={{ marginTop: '8px' }}>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                  Model: {message.executionData.model_used || 'N/A'} | 
                                  Tokens: {message.executionData.token_usage?.total_tokens || 'N/A'}
                                </Text>
                              </div>
                            )}
                          </div>
                        }
                      />
                    </div>
                  </List.Item>
                )}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* Input Area */}
          <div>
            <Row gutter={8}>
              <Col flex="auto">
                <TextArea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={!selectedFlowId || isExecuting}
                />
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={isExecuting ? <Spin size="small" /> : <SendOutlined />}
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || !selectedFlowId || isExecuting}
                  loading={isExecuting}
                  style={{ height: '40px' }}
                >
                  {isExecuting ? 'Running...' : 'Send'}
                </Button>
              </Col>
            </Row>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default ChatTestPage;