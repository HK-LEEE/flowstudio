import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Space,
  Typography,
  Button,
  Select,
  Slider,
  InputNumber,
  Switch,
  Alert,
  Spin,
  Tag,
  Tooltip,
  Row,
  Col,
  Input,
  Collapse
} from 'antd';
import {
  CloudServerOutlined,
  RobotOutlined,
  SettingOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  ApiOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { VariableAwareTextArea } from './VariableAwareTextArea';
import { useNodeConnections } from '../../hooks/useNodeConnections';
import './OllamaConfigPanel.css';

const { Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

interface VariableInfo {
  name: string;
  type: string;
  description?: string;
  sourceNode?: string;
  sourcePort?: string;
}

interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
  details?: Record<string, any>;
}

interface OllamaConfigPanelProps {
  nodeId: string;
  currentConfig: {
    prompt?: string;
    system_message?: string;
    ollama_base_url?: string;
    model?: string;
    temperature?: number;
    top_p?: number;
    num_predict?: number;
    top_k?: number;
    repeat_penalty?: number;
    stream?: boolean;
    timeout?: number;
    variable_mappings?: Array<{
      input_field: string;
      variable_name: string;
      default_value?: string;
      transform?: string;
    }>;
    manual_variables?: Record<string, any>;
  };
  onConfigChange: (config: any) => void;
  onClose?: () => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const OllamaConfigPanel: React.FC<OllamaConfigPanelProps> = ({
  nodeId,
  currentConfig,
  onConfigChange,
  onClose
}) => {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  
  // UI state
  const [activeSection, setActiveSection] = useState(['prompt', 'server']);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  // Get connected variables using the hook
  const { inputFields: connectedVariables, hasConnections } = useNodeConnections(nodeId, 'input_data');
  
  // Transform connected variables to the format expected by VariableAwareTextArea
  const availableVariables: VariableInfo[] = useMemo(() => {
    const variables: VariableInfo[] = connectedVariables.map(field => ({
      name: field.name,
      type: field.type,
      description: field.description,
      sourceNode: field.sourceNode,
      sourcePort: field.sourcePort
    }));
    
    // Add manual variables if any
    if (currentConfig.manual_variables) {
      Object.entries(currentConfig.manual_variables).forEach(([key, value]) => {
        variables.push({
          name: key,
          type: 'string',
          description: 'Manual variable',
          sourceNode: 'manual'
        });
      });
    }
    
    return variables;
  }, [connectedVariables, currentConfig.manual_variables]);
  
  // Test connection to Ollama server
  const testConnection = useCallback(async () => {
    const baseUrl = currentConfig.ollama_base_url || 'http://localhost:11434';
    setConnectionStatus('connecting');
    setConnectionMessage('Testing connection...');
    
    try {
      const response = await fetch(`/api/ollama/test-connection?base_url=${encodeURIComponent(baseUrl)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setConnectionStatus('connected');
        setConnectionMessage(`Connected successfully (${result.model_count || 0} models available)`);
        await loadModels(baseUrl);
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage('Failed to connect to Ollama server');
      console.error('Connection test error:', error);
    }
  }, [currentConfig.ollama_base_url]);
  
  // Load available models from Ollama server
  const loadModels = useCallback(async (baseUrl?: string) => {
    const url = baseUrl || currentConfig.ollama_base_url || 'http://localhost:11434';
    setModelsLoading(true);
    
    try {
      const response = await fetch(`/api/ollama/models?base_url=${encodeURIComponent(url)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      
      if (result.status === 'connected' && result.models) {
        const models = result.models.map((name: string) => ({ name }));
        setAvailableModels(models);
        
        // If current model is not in the list, update to first available
        if (!result.models.includes(currentConfig.model) && result.models.length > 0) {
          handleConfigChange('model', result.models[0]);
        }
      } else {
        setAvailableModels([]);
        console.warn('Failed to load models:', result.error);
      }
    } catch (error) {
      setAvailableModels([]);
      console.error('Model loading error:', error);
    } finally {
      setModelsLoading(false);
    }
  }, [currentConfig.ollama_base_url, currentConfig.model]);
  
  // Handle configuration changes
  const handleConfigChange = useCallback((key: string, value: any) => {
    const newConfig = { ...currentConfig, [key]: value };
    onConfigChange(newConfig);
  }, [currentConfig, onConfigChange]);
  
  // Handle variable insertion into focused input
  const handleVariableClick = useCallback((variableName: string) => {
    const variableText = `{${variableName}}`;
    
    // Find the currently focused input element
    const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      const start = activeElement.selectionStart || 0;
      const end = activeElement.selectionEnd || 0;
      const currentValue = activeElement.value;
      
      // Insert variable at cursor position
      const newValue = currentValue.substring(0, start) + variableText + currentValue.substring(end);
      
      // Update the appropriate config field
      if (activeElement.getAttribute('data-field') === 'prompt') {
        handleConfigChange('prompt', newValue);
      } else if (activeElement.getAttribute('data-field') === 'system_message') {
        handleConfigChange('system_message', newValue);
      }
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        const newCursorPos = start + variableText.length;
        activeElement.focus();
        activeElement.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else if (focusedInput) {
      // Fallback: append to the last focused field
      if (focusedInput === 'prompt') {
        const currentValue = currentConfig.prompt || '';
        handleConfigChange('prompt', currentValue + variableText);
      } else if (focusedInput === 'system_message') {
        const currentValue = currentConfig.system_message || '';
        handleConfigChange('system_message', currentValue + variableText);
      }
    }
  }, [handleConfigChange, currentConfig, focusedInput]);
  
  // Handle URL change and auto-test connection
  const handleUrlChange = useCallback((url: string) => {
    handleConfigChange('ollama_base_url', url);
    // Auto-test connection after URL change with debounce
    setTimeout(() => {
      if (url && url !== currentConfig.ollama_base_url) {
        testConnection();
      }
    }, 1000);
  }, [handleConfigChange, currentConfig.ollama_base_url, testConnection]);
  
  // Initial connection test
  useEffect(() => {
    if (currentConfig.ollama_base_url) {
      testConnection();
    }
  }, []);
  
  // Get connection status icon and color
  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return { icon: <CheckCircleOutlined />, color: 'green', text: 'Connected' };
      case 'connecting':
        return { icon: <LoadingOutlined spin />, color: 'blue', text: 'Connecting' };
      case 'error':
        return { icon: <ExclamationCircleOutlined />, color: 'red', text: 'Error' };
      default:
        return { icon: <ApiOutlined />, color: 'default', text: 'Disconnected' };
    }
  };
  
  const statusDisplay = getConnectionStatusDisplay();
  
  return (
    <div className="ollama-config-panel">
      <Card
        title={
          <Space>
            <RobotOutlined style={{ color: '#ff6b35' }} />
            <span>🦙 Ollama LLM Configuration</span>
          </Space>
        }
        extra={onClose && <Button type="text" onClick={onClose}>Close</Button>}
        style={{ height: '100%' }}
      >
        
        <Collapse
          activeKey={activeSection}
          onChange={setActiveSection}
          size="small"
          ghost
        >
          {/* Prompt Configuration Section */}
          <Panel
            header={
              <Space>
                <SettingOutlined style={{ color: '#ff6b35' }} />
                <Text strong>Prompt & System Message</Text>
              </Space>
            }
            key="prompt"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* Connected Variables Section */}
              {hasConnections && (
                <Card size="small" style={{ backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Space>
                      <LinkOutlined style={{ color: '#0ea5e9' }} />
                      <Text strong style={{ color: '#0c4a6e' }}>Available Variables ({availableVariables.length})</Text>
                    </Space>
                    <Tag color="blue">{availableVariables.length} connected</Tag>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 8 }}>
                    {availableVariables.map(variable => (
                      <Tooltip
                        key={variable.name}
                        title={`Click to insert {${variable.name}} • Type: ${variable.type} • From: ${variable.sourceNode || 'unknown'}`}
                      >
                        <Tag
                          color="blue"
                          style={{ 
                            cursor: 'pointer', 
                            fontSize: '11px',
                            transition: 'all 0.2s',
                            fontFamily: 'monospace'
                          }}
                          onClick={() => handleVariableClick(variable.name)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1e40af';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                            e.currentTarget.style.color = '';
                          }}
                        >
                          {`{${variable.name}}`}
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>
                  
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    💡 Click any variable above to insert it into your prompt or system message
                  </Text>
                </Card>
              )}

              {/* User Prompt */}
              <VariableAwareTextArea
                label="User Prompt"
                value={currentConfig.prompt || ''}
                onChange={(value) => handleConfigChange('prompt', value)}
                availableVariables={availableVariables}
                placeholder="Enter your prompt. Use {variable} for dynamic content.&#10;Example: Question: {user_input}&#10;Context: {context}"
                rows={4}
                showVariableAnalysis={true}
                showSuggestions={true}
                highlightVariables={true}
              />
              
              {/* System Message */}
              <VariableAwareTextArea
                label="System Message"
                value={currentConfig.system_message || ''}
                onChange={(value) => handleConfigChange('system_message', value)}
                availableVariables={availableVariables}
                placeholder="Define AI behavior. Use {variable} for dynamic context.&#10;Example: You are a {role} expert in {domain}. Answer in {style} tone."
                rows={3}
                showVariableAnalysis={true}
                showSuggestions={true}
                highlightVariables={true}
              />
              
              {/* Template Examples */}
              <Card size="small" style={{ backgroundColor: '#fff7e6' }}>
                <Text strong style={{ fontSize: '12px' }}>💡 Template Examples:</Text>
                <div style={{ marginTop: 8 }}>
                  <Text code style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                    System: You are a {`{role}`} expert in {`{domain}`}
                  </Text>
                  <Text code style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                    Prompt: Question: {`{user_input}`}, Context: {`{context}`}
                  </Text>
                </div>
              </Card>
            </Space>
          </Panel>
          
          {/* Server Configuration Section */}
          <Panel
            header={
              <Space>
                <CloudServerOutlined style={{ color: '#1890ff' }} />
                <Text strong>Ollama Server</Text>
                <Tag
                  icon={statusDisplay.icon}
                  color={statusDisplay.color}
                  style={{ marginLeft: 8 }}
                >
                  {statusDisplay.text}
                </Tag>
              </Space>
            }
            key="server"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* Server URL */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Server URL</Text>
                <Input.Group compact>
                  <Input
                    style={{ width: 'calc(100% - 80px)' }}
                    value={currentConfig.ollama_base_url || 'http://localhost:11434'}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                  <Button
                    style={{ width: 80 }}
                    onClick={testConnection}
                    loading={connectionStatus === 'connecting'}
                    icon={<ApiOutlined />}
                  >
                    Test
                  </Button>
                </Input.Group>
                {connectionMessage && (
                  <Alert
                    message={connectionMessage}
                    type={connectionStatus === 'connected' ? 'success' : 'error'}
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
              
              {/* Model Selection */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Model</Text>
                
                {/* Model Refresh Button - positioned above model selection */}
                <Button
                  style={{ width: '100%', marginBottom: 8 }}
                  icon={<ReloadOutlined />}
                  onClick={() => loadModels()}
                  loading={modelsLoading}
                  disabled={connectionStatus !== 'connected'}
                >
                  {modelsLoading ? 'Loading Models...' : 'Refresh Models'}
                </Button>
                
                <Select
                  style={{ width: '100%' }}
                  value={currentConfig.model || 'llama2'}
                  onChange={(value) => handleConfigChange('model', value)}
                  loading={modelsLoading}
                  placeholder="Select a model"
                  notFoundContent={modelsLoading ? <Spin size="small" /> : 'No models found'}
                >
                  {availableModels.map(model => (
                    <Option key={model.name} value={model.name}>
                      <Space>
                        <span>{model.name}</span>
                        {model.size && (
                          <Tag color="blue">
                            {Math.round(model.size / 1024 / 1024 / 1024 * 10) / 10}GB
                          </Tag>
                        )}
                      </Space>
                    </Option>
                  ))}
                </Select>
                {connectionStatus !== 'connected' && (
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
                    Connect to server to load available models
                  </Text>
                )}
              </div>
            </Space>
          </Panel>
          
          {/* Generation Parameters Section */}
          <Panel
            header={
              <Space>
                <SettingOutlined style={{ color: '#faad14' }} />
                <Text strong>Generation Parameters</Text>
              </Space>
            }
            key="parameters"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* Temperature */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>Temperature</Text>
                  <InputNumber
                    size="small"
                    min={0}
                    max={2}
                    step={0.1}
                    value={currentConfig.temperature || 0.7}
                    onChange={(value) => handleConfigChange('temperature', value)}
                    style={{ width: 80 }}
                  />
                </div>
                <Slider
                  min={0}
                  max={2}
                  step={0.1}
                  value={currentConfig.temperature || 0.7}
                  onChange={(value) => handleConfigChange('temperature', value)}
                  marks={{
                    0: 'Precise',
                    0.7: 'Balanced',
                    2: 'Creative'
                  }}
                />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Controls randomness. Lower = more focused, Higher = more creative
                </Text>
              </div>
              
              {/* Top P */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>Top P</Text>
                  <InputNumber
                    size="small"
                    min={0}
                    max={1}
                    step={0.05}
                    value={currentConfig.top_p || 0.9}
                    onChange={(value) => handleConfigChange('top_p', value)}
                    style={{ width: 80 }}
                  />
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={currentConfig.top_p || 0.9}
                  onChange={(value) => handleConfigChange('top_p', value)}
                />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Nucleus sampling. Lower values = more focused vocabulary
                </Text>
              </div>
              
              {/* Max Tokens */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Max Tokens</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={8192}
                  value={currentConfig.num_predict || 1000}
                  onChange={(value) => handleConfigChange('num_predict', value)}
                  placeholder="1000"
                />
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
                  Maximum number of tokens to generate (-1 for unlimited)
                </Text>
              </div>
            </Space>
          </Panel>
          
          {/* Advanced Parameters Section */}
          <Panel
            header={
              <Space>
                <ExperimentOutlined style={{ color: '#722ed1' }} />
                <Text strong>Advanced Options</Text>
              </Space>
            }
            key="advanced"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Top K</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={100}
                    value={currentConfig.top_k || 40}
                    onChange={(value) => handleConfigChange('top_k', value)}
                  />
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
                    Limit to top K tokens (0 = disabled)
                  </Text>
                </Col>
                
                <Col span={12}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Repeat Penalty</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={2}
                    step={0.1}
                    value={currentConfig.repeat_penalty || 1.1}
                    onChange={(value) => handleConfigChange('repeat_penalty', value)}
                  />
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
                    Penalty for repeating tokens
                  </Text>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Space direction="vertical">
                    <Text strong>Enable Streaming</Text>
                    <Switch
                      checked={currentConfig.stream || false}
                      onChange={(checked) => handleConfigChange('stream', checked)}
                    />
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Stream response tokens as generated
                    </Text>
                  </Space>
                </Col>
                
                <Col span={12}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Timeout (seconds)</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={10}
                    max={600}
                    value={currentConfig.timeout || 120}
                    onChange={(value) => handleConfigChange('timeout', value)}
                  />
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
                    Maximum wait time for response
                  </Text>
                </Col>
              </Row>
            </Space>
          </Panel>
        </Collapse>
      </Card>
    </div>
  );
};

export default OllamaConfigPanel;