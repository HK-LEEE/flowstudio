import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Typography, 
  Tooltip, 
  Button,
  Space,
  Progress,
  Input,
  InputNumber,
  Select,
  Switch
} from 'antd';
import {
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  LockOutlined,
  UnlockOutlined,
  EditOutlined,
  FileTextOutlined,
  RobotOutlined,
  FieldStringOutlined,
  BranchesOutlined,
  FormatPainterOutlined,
  FileAddOutlined,
  FilePdfOutlined,
  ApiOutlined,
  FunctionOutlined,
  ExperimentOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  SendOutlined,
  MailOutlined,
  EyeOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { useNodeConnections } from '../../hooks/useNodeConnections';
import './ModernWhiteNode.css';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Icon mapping function
const getComponentIcon = (iconName: string, componentType: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'EditOutlined': <EditOutlined />,
    'FileTextOutlined': <FileTextOutlined />,
    'RobotOutlined': <RobotOutlined />,
    'FieldStringOutlined': <FieldStringOutlined />,
    'BranchesOutlined': <BranchesOutlined />,
    'FormatPainterOutlined': <FormatPainterOutlined />,
    'FileAddOutlined': <FileAddOutlined />,
    'FilePdfOutlined': <FilePdfOutlined />,
    'ApiOutlined': <ApiOutlined />,
    'FunctionOutlined': <FunctionOutlined />,
    'CodeOutlined': <CodeOutlined />,
    'ClockCircleOutlined': <ClockCircleOutlined />,
    'SendOutlined': <SendOutlined />,
    'MailOutlined': <MailOutlined />,
  };

  // Component-specific icons
  const componentIcons: Record<string, React.ReactNode> = {
    'text_input': <EditOutlined />,
    'text_output': <FileTextOutlined />,
    'chat_input': <EditOutlined />,
    'chat_output': <SendOutlined />,
    'openai_llm': <RobotOutlined />,
    'claude_llm': <RobotOutlined />,
    'prompt_template': <FieldStringOutlined />,
    'conditional': <BranchesOutlined />,
    'text_processor': <FormatPainterOutlined />,
    'file_input': <FileAddOutlined />,
    'file_output': <FilePdfOutlined />,
    'http_request': <ApiOutlined />,
    'data_transform': <FunctionOutlined />,
    'json_parser': <CodeOutlined />,
    'delay': <ClockCircleOutlined />,
    'webhook': <SendOutlined />,
    'email_sender': <MailOutlined />,
    'code_executor': <CodeOutlined />,
  };

  return componentIcons[componentType] || iconMap[iconName] || <ExperimentOutlined />;
};

export interface LangflowNodeData extends Record<string, unknown> {
  template?: {
    id: string;
    component_type: string;
    display_name: string;
    description: string;
    category: string;
    icon: string;
    color: string;
    input_schema: Record<string, any>;
    output_schema: Record<string, any>;
  };
  display_name?: string;
  input_values?: Record<string, any>;
  config_data?: Record<string, any>;
  execution_status?: 'idle' | 'running' | 'completed' | 'failed' | 'frozen';
  execution_progress?: number;
  execution_time?: number;
  error_message?: string;
  output_data?: Record<string, any>;
  is_frozen?: boolean;
}

interface LangflowStyleNodeProps extends NodeProps {
  data: LangflowNodeData;
  onConfigClick?: (nodeId: string) => void;
  onExecuteClick?: (nodeId: string) => void;
  onFreezeToggle?: (nodeId: string, frozen: boolean) => void;
  onPreviewClick?: (nodeId: string) => void;
}

const LangflowStyleNode: React.FC<LangflowStyleNodeProps> = memo(({
  id,
  data,
  selected,
  onConfigClick,
  onExecuteClick,
  onFreezeToggle,
  onPreviewClick
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(false);
  
  const { template, execution_status = 'idle', execution_progress = 0, is_frozen = false } = data;
  const templateTyped = template as any;
  
  // Get connected variables for this node
  const { inputFields: connectedVariables, hasConnections } = useNodeConnections(id, 'input_data');

  // Get status-based styling
  const getStatusConfig = useCallback(() => {
    switch (execution_status) {
      case 'running':
        return {
          borderColor: '#faad14',
          headerBg: '#fff7e6',
          statusIcon: <LoadingOutlined spin />,
          statusColor: '#faad14'
        };
      case 'completed':
        return {
          borderColor: '#52c41a',
          headerBg: '#f6ffed',
          statusIcon: <CheckCircleOutlined />,
          statusColor: '#52c41a'
        };
      case 'failed':
        return {
          borderColor: '#ff4d4f',
          headerBg: '#fff2f1',
          statusIcon: <ExclamationCircleOutlined />,
          statusColor: '#ff4d4f'
        };
      case 'frozen':
        return {
          borderColor: '#1890ff',
          headerBg: '#e6f7ff',
          statusIcon: <LockOutlined />,
          statusColor: '#1890ff'
        };
      default:
        return {
          borderColor: template?.color || '#1890ff',
          headerBg: 'white',
          statusIcon: null,
          statusColor: template?.color || '#1890ff'
        };
    }
  }, [execution_status, template?.color]);

  const statusConfig = getStatusConfig();

  // Handle input/output schema parsing
  const getInputHandles = useCallback(() => {
    if (!template?.input_schema?.properties) return [];
    
    return Object.entries(template.input_schema.properties).map(([key, schema]: [string, any]) => ({
      id: key,
      label: schema.title || key,
      type: schema.type || 'string',
      required: template.input_schema.required?.includes(key) || false,
      description: schema.description
    }));
  }, [template?.input_schema]);

  const getOutputHandles = useCallback(() => {
    if (!template?.output_schema?.properties) return [];
    
    return Object.entries(template.output_schema.properties).map(([key, schema]: [string, any]) => ({
      id: key,
      label: schema.title || key,
      type: schema.type || 'string',
      description: schema.description
    }));
  }, [template?.output_schema]);

  const inputHandles = getInputHandles();
  const outputHandles = getOutputHandles();
  
  // Separate fields into input, config, and output
  const getFieldCategory = (fieldId: string) => {
    // Define which fields are actual inputs (need ports)
    const inputFields = ['prompt', 'system_message', 'input', 'text', 'response'];
    // Define which fields are outputs (need ports)  
    const outputFields = ['response', 'model_used', 'token_usage', 'output', 'result', 'message'];
    // Everything else is configuration (no ports)
    
    // Special handling for Chat components
    if (template?.component_type === 'chat_input') {
      // Chat Input: no real input ports, only output ports
      if (fieldId === 'auto_message') return 'config'; // This is just an info field
      return 'output';
    }
    
    if (template?.component_type === 'chat_output') {
      // Chat Output: 'response' is input, others are output  
      if (fieldId === 'response') return 'input';
      return 'output';
    }
    
    if (inputFields.some(field => fieldId.toLowerCase().includes(field))) {
      return 'input';
    }
    if (outputFields.some(field => fieldId.toLowerCase().includes(field))) {
      return 'output';
    }
    return 'config';
  };
  
  // Calculate stable height - prevent flickering
  const isPromptTemplate = template?.component_type === 'prompt_template';
  const isOllamaLLM = template?.component_type === 'ollama_llm';
  const isCompactComponent = isPromptTemplate || isOllamaLLM;
  const baseHeight = 200; // Base height for header + description
  
  let inputSectionHeight, outputSectionHeight, configSectionHeight;
  
  if (isCompactComponent) {
    // Compact height for Prompt Template and Ollama LLM
    inputSectionHeight = inputHandles.length > 0 ? 40 : 0;
    outputSectionHeight = outputHandles.length > 0 ? 40 : 0;
    configSectionHeight = 50; // Compact config section
  } else {
    // Normal height for other components  
    inputSectionHeight = inputHandles.length > 0 ? 60 + (inputHandles.length * 50) : 0;
    outputSectionHeight = outputHandles.length > 0 ? 60 + (outputHandles.length * 40) : 0;
    const configFields = inputHandles.filter(handle => getFieldCategory(handle.id) === 'config');
    configSectionHeight = configFields.length > 0 ? 60 + (configFields.length * 50) : 0;
  }
  
  const dynamicHeight = Math.max(
    isCompactComponent ? 250 : 300, 
    baseHeight + inputSectionHeight + outputSectionHeight + configSectionHeight
  );


  const handleConfigClick = useCallback(() => {
    setShowConfig(!showConfig);
    // Also call external handler if provided
    onConfigClick?.(id);
  }, [id, onConfigClick, showConfig]);

  const handleExecuteClick = useCallback(() => {
    onExecuteClick?.(id);
  }, [id, onExecuteClick]);

  const handleFreezeToggle = useCallback(() => {
    onFreezeToggle?.(id, !is_frozen);
  }, [id, is_frozen, onFreezeToggle]);

  const handlePreviewClick = useCallback(() => {
    setShowPreview(!showPreview);
    onPreviewClick?.(id);
  }, [id, onPreviewClick, showPreview]);

  // Render inline config field
  const renderConfigField = useCallback((key: string, schema: any) => {
    const value = configValues[key] || schema.default || '';
    
    const onChange = (newValue: any) => {
      setConfigValues(prev => ({ ...prev, [key]: newValue }));
    };

    // Handle password fields
    if (schema.format === 'password') {
      return (
        <Input.Password 
          size="small"
          placeholder={schema.description}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Handle select fields (enum)
    if (schema.enum && schema.enum.length > 0) {
      return (
        <Select 
          size="small" 
          value={value}
          placeholder={schema.description}
          onChange={onChange}
          style={{ width: '100%' }}
        >
          {schema.enum.map((option: string) => (
            <Option key={option} value={option}>{option}</Option>
          ))}
        </Select>
      );
    }

    // Handle number fields
    if (schema.type === 'number' || schema.type === 'integer') {
      return (
        <InputNumber 
          size="small"
          style={{ width: '100%' }} 
          min={schema.minimum}
          max={schema.maximum}
          value={value}
          onChange={onChange}
          placeholder={schema.description}
        />
      );
    }

    // Handle boolean fields
    if (schema.type === 'boolean') {
      return (
        <Switch 
          size="small"
          checked={value}
          onChange={onChange}
        />
      );
    }

    // Handle text areas for long strings
    if (schema.type === 'string' && (key.includes('prompt') || key.includes('template') || key.includes('message'))) {
      return (
        <TextArea 
          size="small"
          rows={2} 
          placeholder={schema.description}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Default to regular input
    return (
      <Input 
        size="small"
        placeholder={schema.description}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }, [configValues]);

  return (
    <div 
      className={`langflow-node ${selected ? 'selected' : ''} ${execution_status}`}
      style={{
        '--node-border-color': statusConfig.borderColor,
        '--node-header-bg': statusConfig.headerBg,
        '--node-status-color': statusConfig.statusColor,
        '--template-color': template?.color || '#1890ff',
        minHeight: `${dynamicHeight}px`,
      } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Node Header with Inline Ports */}
      <div className="node-header">
        <div className="node-icon" style={{ color: template?.color || '#1890ff' }}>
          {getComponentIcon(template?.icon || '', template?.component_type || '')}
        </div>
        
        <div className="node-title">
          <Text strong className="node-name">
            {data.display_name || template?.display_name || 'Node'}
          </Text>
          
          <div className="node-meta">
            <Text className="node-category">{template?.category || 'Component'}</Text>
            {data.execution_time && (
              <Text className="execution-time">
                {data.execution_time}ms
              </Text>
            )}
          </div>
        </div>

        <div className="node-actions">
          {statusConfig.statusIcon && (
            <div className="status-indicator" style={{ color: statusConfig.statusColor }}>
              {statusConfig.statusIcon}
            </div>
          )}
          
          {execution_status === 'running' && execution_progress > 0 && (
            <div className="progress-indicator">
              <Progress 
                type="circle" 
                percent={execution_progress} 
                size={16}
                strokeWidth={8}
                showInfo={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Node Body - Simplified and Stable */}
      <div className="node-body">
        {/* Node Description */}
        <div style={{ 
          padding: '16px',
          textAlign: 'center',
          borderBottom: '1px solid #f3f4f6'
        }}>
          <Text style={{ 
            fontSize: '12px', 
            color: '#6b7280'
          }}>
            {template?.description || 'Component description'}
          </Text>
        </div>

        {/* Input Section - Fields that need ports */}
        {(() => {
          const inputFields = inputHandles.filter(handle => getFieldCategory(handle.id) === 'input');
          if (inputFields.length === 0) return null;
          
          // Special handling for Prompt Template and Ollama LLM - show ports at top
          
          return (
            <div style={{ padding: isCompactComponent ? '8px 16px' : '16px', position: 'relative' }}>
              {/* Left ports for Compact Components */}
              {isCompactComponent && (
                <div style={{
                  position: 'absolute',
                  left: '-8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {inputFields.map((handle) => (
                    <Handle
                      key={`input-${handle.id}`}
                      type="target"
                      position={Position.Left}
                      id={handle.id}
                      style={{
                        position: 'relative',
                        width: '12px',
                        height: '12px',
                        background: '#3b82f6',
                        border: '2px solid #ffffff',
                        borderRadius: '50%',
                        boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
                        zIndex: 1000,
                        cursor: 'crosshair'
                      }}
                      className="input-port"
                    />
                  ))}
                </div>
              )}
              
              {/* For Compact Components, show minimal input summary */}
              {isCompactComponent ? (
                <div 
                  style={{ 
                    padding: '8px 12px',
                    backgroundColor: isOllamaLLM ? '#fff7e6' : '#eff6ff',
                    borderRadius: '6px',
                    border: '1px solid #dbeafe',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={handleConfigClick}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dbeafe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                >
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: '600', 
                    color: '#1e40af', 
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>Input Data ({inputFields.length})</span>
                    <span style={{ 
                      fontSize: '9px', 
                      color: '#6b7280',
                      backgroundColor: '#e2e8f0',
                      padding: '1px 4px',
                      borderRadius: '3px'
                    }}>
                      Configure
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>
                    {inputFields.map(field => field.label).join(', ')}
                  </div>
                </div>
              ) : (
                // For other components, show full input fields
                <>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#374151', 
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      background: '#3b82f6', 
                      borderRadius: '50%' 
                    }}></div>
                    Inputs ({inputFields.length})
                  </div>
                  {inputFields.map((handle) => {
                    const schema = template?.input_schema?.properties?.[handle.id];
                    return (
                      <div key={`input-field-${handle.id}`} style={{ 
                        position: 'relative',
                        marginBottom: '12px',
                        padding: '12px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        border: '2px solid #dbeafe'
                      }}>
                        {/* Port on left edge for non-prompt-template nodes */}
                        <Handle
                          type="target"
                          position={Position.Left}
                          id={handle.id}
                          style={{
                            position: 'absolute',
                            left: '-8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '12px',
                            height: '12px',
                            background: '#3b82f6',
                            border: '2px solid #ffffff',
                            borderRadius: '50%',
                            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
                            zIndex: 1000,
                            cursor: 'crosshair'
                          }}
                          className="input-port"
                        />
                        
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#1e40af',
                          marginBottom: '4px'
                        }}>
                          {handle.label}
                          {handle.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#6b7280',
                          marginBottom: schema ? '8px' : '0px'
                        }}>
                          {handle.description}
                        </div>
                        {/* Inline Configuration */}
                        {schema && (
                          <div>
                            {renderConfigField(handle.id, schema)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })()}

        {/* Configuration Section - No ports */}
        {(() => {
          const configFields = inputHandles.filter(handle => getFieldCategory(handle.id) === 'config');
          
          // For Compact Components, show minimal summary instead of full config
          if (isCompactComponent) {
            // Different display for different component types
            if (isOllamaLLM) {
              const model = data.input_values?.model || 'llama2';
              const baseUrl = data.input_values?.ollama_base_url || 'localhost:11434';
              const temperature = data.input_values?.temperature || 0.7;
              
              return (
                <div>
                  {/* Connected Variables Section */}
                  {hasConnections && connectedVariables.length > 0 && (
                    <div 
                      style={{ 
                        padding: '8px 16px', 
                        borderTop: '1px solid #f3f4f6',
                        backgroundColor: '#f0f9ff',
                        borderLeft: '3px solid #52c41a'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '6px'
                      }}>
                        <Space size={4}>
                          <LinkOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
                          <Text strong style={{ fontSize: '11px', color: '#374151' }}>
                            Connected Variables
                          </Text>
                        </Space>
                        <span style={{ 
                          fontSize: '9px', 
                          color: '#52c41a',
                          backgroundColor: '#f6ffed',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          border: '1px solid #b7eb8f'
                        }}>
                          {connectedVariables.length} available
                        </span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '4px',
                        marginBottom: '4px'
                      }}>
                        {connectedVariables.slice(0, 4).map((variable, index) => (
                          <Tooltip
                            key={`${variable.name}-${index}`}
                            title={`${variable.type} from ${variable.sourceNode || 'unknown'}`}
                          >
                            <span
                              style={{
                                fontSize: '9px',
                                fontFamily: 'monospace',
                                color: '#52c41a',
                                backgroundColor: '#f6ffed',
                                padding: '1px 4px',
                                borderRadius: '2px',
                                border: '1px solid #b7eb8f',
                                cursor: 'help'
                              }}
                            >
                              {`{${variable.name}}`}
                            </span>
                          </Tooltip>
                        ))}
                        {connectedVariables.length > 4 && (
                          <span style={{ 
                            fontSize: '9px', 
                            color: '#6b7280',
                            fontStyle: 'italic'
                          }}>
                            +{connectedVariables.length - 4} more
                          </span>
                        )}
                      </div>
                      
                      <Text style={{ fontSize: '9px', color: '#6b7280' }}>
                        Use these in prompts with {'{variable}'} syntax
                      </Text>
                    </div>
                  )}

                  {/* Configuration Section */}
                  <div 
                    style={{ 
                      padding: '12px 16px', 
                      borderTop: hasConnections ? '1px solid #f3f4f6' : '1px solid #f3f4f6',
                      backgroundColor: '#fef7e6',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={handleConfigClick}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef1d9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef7e6';
                    }}
                  >
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>🦙 Ollama Configuration</span>
                      <span style={{ 
                        fontSize: '10px', 
                        color: '#6b7280',
                        backgroundColor: '#e2e8f0',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        Click to edit
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                      Model: {model} • Server: {baseUrl}
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px',
                      fontSize: '10px',
                      color: '#6b7280'
                    }}>
                      <span>🌡️ Temp: {temperature}</span>
                      <span>🔗 Local LLM</span>
                      {hasConnections && (
                        <span>🎯 {connectedVariables.length} vars</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            
            // Original Prompt Template display
            const templateValue = data.input_values?.template || 'No template defined';
            const mappingCount = data.input_values?.variable_mappings?.length || 0;
            const manualVarCount = Object.keys(data.input_values?.manual_variables || {}).length;
            
            return (
              <div 
                style={{ 
                  padding: '12px 16px', 
                  borderTop: '1px solid #f3f4f6',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onClick={handleConfigClick}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#374151', 
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>Configuration</span>
                  <span style={{ 
                    fontSize: '10px', 
                    color: '#6b7280',
                    backgroundColor: '#e2e8f0',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    Click to edit
                  </span>
                </div>
                
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                  Template: {templateValue.length > 50 ? templateValue.substring(0, 50) + '...' : templateValue}
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  fontSize: '10px',
                  color: '#6b7280'
                }}>
                  <span>📋 {mappingCount} mappings</span>
                  <span>⚙️ {manualVarCount} variables</span>
                </div>
              </div>
            );
          }
          
          // For other components, show full configuration as before
          if (configFields.length === 0) return null;
          
          return (
            <div style={{ padding: '16px', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  background: '#6b7280', 
                  borderRadius: '50%' 
                }}></div>
                Configuration ({configFields.length})
              </div>
              {configFields.map((handle) => {
                const schema = template?.input_schema?.properties?.[handle.id];
                return (
                  <div key={`config-field-${handle.id}`} style={{ 
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '4px'
                    }}>
                      {handle.label}
                      {handle.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#6b7280',
                      marginBottom: schema ? '8px' : '0px'
                    }}>
                      {handle.description}
                    </div>
                    {/* Inline Configuration */}
                    {schema && (
                      <div>
                        {renderConfigField(handle.id, schema)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Output Section - Fields with ports on right edge */}
        {outputHandles.length > 0 && (
          <div style={{ 
            padding: isCompactComponent ? '8px 16px' : '16px', 
            borderTop: '1px solid #f3f4f6', 
            position: 'relative' 
          }}>
            {/* Right ports for Compact Components */}
            {isCompactComponent && (
              <div style={{
                position: 'absolute',
                right: '-8px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {outputHandles.map((handle) => (
                  <Handle
                    key={`output-${handle.id}`}
                    type="source"
                    position={Position.Right}
                    id={handle.id}
                    style={{
                      position: 'relative',
                      width: '12px',
                      height: '12px',
                      background: isOllamaLLM ? '#ff6b35' : '#10b981',
                      border: '2px solid #ffffff',
                      borderRadius: '50%',
                      boxShadow: isOllamaLLM ? '0 2px 6px rgba(255, 107, 53, 0.4)' : '0 2px 6px rgba(16, 185, 129, 0.4)',
                      zIndex: 1000,
                      cursor: 'crosshair'
                    }}
                    className="output-port"
                  />
                ))}
              </div>
            )}
            
            {/* For Compact Components, show minimal output summary */}
            {isCompactComponent ? (
              <div style={{ 
                padding: '8px 12px',
                backgroundColor: isOllamaLLM ? '#fef7e6' : '#f0fdf4',
                borderRadius: '6px',
                border: isOllamaLLM ? '1px solid #fed7aa' : '1px solid #dcfce7'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '600', 
                  color: isOllamaLLM ? '#92400e' : '#065f46', 
                  marginBottom: '4px'
                }}>
                  {isOllamaLLM ? '🦙 AI Response' : 'Output Data'} ({outputHandles.length})
                </div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>
                  {outputHandles.map(handle => handle.label).join(', ')}
                </div>
              </div>
            ) : (
              // For other components, show full output fields
              <>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#374151', 
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    background: '#10b981', 
                    borderRadius: '50%' 
                  }}></div>
                  Outputs ({outputHandles.length})
                </div>
                {outputHandles.map((handle) => (
                  <div key={`output-field-${handle.id}`} style={{ 
                    position: 'relative',
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '8px',
                    border: '2px solid #dcfce7'
                  }}>
                    {/* Port on right edge for non-prompt-template nodes */}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={handle.id}
                      style={{
                        position: 'absolute',
                        right: '-8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '12px',
                        background: '#10b981',
                        border: '2px solid #ffffff',
                        borderRadius: '50%',
                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)',
                        zIndex: 1000,
                        cursor: 'crosshair'
                      }}
                      className="output-port"
                    />
                    
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#065f46',
                      marginBottom: '4px'
                    }}>
                      {handle.label}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#6b7280'
                    }}>
                      {handle.description}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>


      {/* Stable Node Footer - Always present but hidden */}
      <div className={`node-footer ${(isHovered || selected) ? 'visible' : 'hidden'}`}>
        <Space size="small">
          <Tooltip title="Configure">
            <Button 
              type="text" 
              size="small" 
              icon={<SettingOutlined />}
              onClick={handleConfigClick}
              className="node-action-btn"
            />
          </Tooltip>
          
          <Tooltip title={execution_status === 'running' ? 'Stop' : 'Run'}>
            <Button 
              type="text" 
              size="small" 
              icon={execution_status === 'running' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleExecuteClick}
              className="node-action-btn"
              disabled={is_frozen}
            />
          </Tooltip>
          
          <Tooltip title={is_frozen ? 'Unfreeze' : 'Freeze'}>
            <Button 
              type="text" 
              size="small" 
              icon={is_frozen ? <UnlockOutlined /> : <LockOutlined />}
              onClick={handleFreezeToggle}
              className="node-action-btn"
              style={{ color: is_frozen ? '#1890ff' : undefined }}
            />
          </Tooltip>
          
          <Tooltip title="Preview Output">
            <Button 
              type="text" 
              size="small" 
              icon={<EyeOutlined />}
              onClick={handlePreviewClick}
              className="node-action-btn"
              style={{ color: showPreview ? '#1890ff' : undefined }}
            />
          </Tooltip>
          
          {/* Data Available Indicator */}
          {data.output_data && execution_status === 'completed' && (
            <Tooltip title="Output data available">
              <div style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: '#52c41a',
                marginLeft: '4px'
              }} />
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Frozen Overlay */}
      {is_frozen && (
        <div className="frozen-overlay">
          <LockOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
        </div>
      )}

      {/* Selection Indicator */}
      {selected && <div className="selection-indicator" />}
    </div>
  );
});

LangflowStyleNode.displayName = 'LangflowStyleNode';

export default LangflowStyleNode;