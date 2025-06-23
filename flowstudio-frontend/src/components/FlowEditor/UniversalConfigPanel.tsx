import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Typography,
  Input,
  Select,
  Switch,
  InputNumber,
  Button,
  Space,
  Divider,
  Tag,
  Alert,
  Collapse,
  Form,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  FieldStringOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useReactFlow } from '@xyflow/react';
import { usePromptTemplateInputs } from '../../hooks/useNodeConnections';
import VariableField from './VariableField';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

interface UniversalConfigPanelProps {
  nodeId: string;
  template: any;
  initialValues: {
    input_values?: Record<string, any>;
    config_data?: Record<string, any>;
    display_name?: string;
  };
  onValuesChange: (values: any) => void;
  onChangesStateChange?: (hasChanges: boolean, saveFunc: () => void, resetFunc: () => void, getCurrentValuesFunc: () => any) => void;
}

interface InputSchemaItem {
  type: string;
  title?: string;
  description?: string;
  default?: any;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  format?: string;
  supports_variables?: boolean; // 새로운 플래그
}

const UniversalConfigPanel: React.FC<UniversalConfigPanelProps> = ({
  nodeId,
  template,
  initialValues,
  onValuesChange,
  onChangesStateChange
}) => {
  const [form] = Form.useForm();
  const { getNodes, getEdges } = useReactFlow();
  const { availableInputFields, hasConnections } = usePromptTemplateInputs(nodeId);
  
  const [manualVariables, setManualVariables] = useState<Record<string, string>>(() => 
    initialValues.input_values?.manual_variables || {}
  );
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic', 'inputs', 'config']);
  
  // Track if form values have changed (for unsaved changes detection)
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  
  // Debounce reference for form change handler
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Reset local changes when nodeId changes (new node selected)
  useEffect(() => {
    setHasLocalChanges(false);
    console.log('UniversalConfigPanel: Reset local changes for new node:', nodeId);
  }, [nodeId]);

  // Update form values only when nodeId changes (new node selected) or when user hasn't made local changes  
  useEffect(() => {
    const currentFormValues = {
      display_name: initialValues.display_name || template.display_name,
      ...initialValues.input_values,
      ...initialValues.config_data,
    };
    
    console.log('UniversalConfigPanel: Checking if form should update:', {
      hasLocalChanges,
      nodeId,
      currentFormValues
    });
    
    // Only update form if:
    // 1. User has not made local changes (to prevent overwriting user input)
    // 2. OR this is a new node (nodeId changed)
    if (!hasLocalChanges) {
      console.log('UniversalConfigPanel: Updating form with initial values');
      form.setFieldsValue(currentFormValues);
      
      // Update manual variables state
      const newManualVars = initialValues.input_values?.manual_variables || {};
      setManualVariables(newManualVars);
    } else {
      console.log('UniversalConfigPanel: Skipping form update - user has local changes');
    }
    
  }, [initialValues, form, template.display_name, nodeId, hasLocalChanges]);

  // Get real data from connected nodes
  const getRealInputData = useCallback(() => {
    const edges = getEdges();
    const nodes = getNodes();
    const realInputData: Record<string, any> = {};

    const incomingEdges = edges.filter(edge => edge.target === nodeId);

    incomingEdges.forEach(edge => {
      const sourceNode = nodes.find(node => node.id === edge.source);
      if (!sourceNode) return;

      const sourceOutputData = sourceNode.data?.output_data;
      
      if (sourceOutputData && Object.keys(sourceOutputData).length > 0) {
        const isExecuted = sourceNode.data?.execution_status === 'completed';
        
        if (isExecuted) {
          Object.entries(sourceOutputData).forEach(([key, value]) => {
            realInputData[key] = value;
          });
        }
      }
    });

    return realInputData;
  }, [nodeId, getEdges, getNodes]);

  // Save current form values to parent
  const handleSave = useCallback(() => {
    const values = form.getFieldsValue();
    const finalValues = {
      ...values,
      manual_variables: manualVariables
    };
    
    console.log('UniversalConfigPanel: Saving values to parent:', finalValues);
    onValuesChange(finalValues);
    setHasLocalChanges(false);
  }, [form, manualVariables, onValuesChange]);

  // Reset form to initial values
  const handleReset = useCallback(() => {
    const currentFormValues = {
      display_name: initialValues.display_name || template.display_name,
      ...initialValues.input_values,
      ...initialValues.config_data,
    };
    
    form.setFieldsValue(currentFormValues);
    setManualVariables(initialValues.input_values?.manual_variables || {});
    setHasLocalChanges(false);
    console.log('UniversalConfigPanel: Form reset to initial values');
  }, [form, initialValues, template.display_name]);

  // Get current form values (including unsaved changes)
  const getCurrentFormValues = useCallback(() => {
    const values = form.getFieldsValue();
    const finalValues = {
      ...values,
      manual_variables: manualVariables
    };
    console.log('UniversalConfigPanel: Getting current form values for preview:', finalValues);
    return finalValues;
  }, [form, manualVariables]);

  // Notify parent about changes state and provide save/reset/getCurrentValues functions
  useEffect(() => {
    onChangesStateChange?.(hasLocalChanges, handleSave, handleReset, getCurrentFormValues);
  }, [hasLocalChanges, onChangesStateChange, handleSave, handleReset, getCurrentFormValues]);

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  // Handle form changes locally without triggering parent updates
  const handleFormChange = (changedFields: any, allFields: any) => {
    setHasLocalChanges(true);
    console.log('UniversalConfigPanel: Local form change detected');
    // Do NOT call onValuesChange here - only save when user clicks Save
  };

  const addManualVariable = () => {
    const newKey = `var_${Object.keys(manualVariables).length + 1}`;
    const newVariables = {
      ...manualVariables,
      [newKey]: ''
    };
    setManualVariables(newVariables);
    setHasLocalChanges(true);
    console.log('UniversalConfigPanel: Manual variable added (not saved yet)');
  };

  const removeManualVariable = (key: string) => {
    const { [key]: removed, ...rest } = manualVariables;
    setManualVariables(rest);
    setHasLocalChanges(true);
    console.log('UniversalConfigPanel: Manual variable removed (not saved yet)');
  };

  const updateManualVariable = (oldKey: string, newKey: string, value: string) => {
    const { [oldKey]: removed, ...rest } = manualVariables;
    const newVariables = {
      ...rest,
      [newKey]: value
    };
    setManualVariables(newVariables);
    setHasLocalChanges(true);
    console.log('UniversalConfigPanel: Manual variable updated (not saved yet)');
  };

  // Extract variables from template-like fields
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  // Categorize schema fields
  const categorizeFields = () => {
    if (!template.input_schema?.properties) return { inputs: [], configs: [] };
    
    const inputs: Array<[string, InputSchemaItem]> = [];
    const configs: Array<[string, InputSchemaItem]> = [];
    
    Object.entries(template.input_schema.properties).forEach(([key, schema]: [string, any]) => {
      // Special handling for Text Input components - their fields are config, not input
      const isTextInputComponent = template.component_type === 'text_input' || 
                                   template.component_type === 'chat_input' ||
                                   template.display_name?.toLowerCase().includes('text input');
      
      if (isTextInputComponent) {
        // For text input components, all fields are configuration
        configs.push([key, schema]);
      } else {
        // Fields that typically receive data from other nodes
        const inputFields = ['prompt', 'input', 'text', 'message', 'data', 'content'];
        
        if (inputFields.some(field => key.toLowerCase().includes(field))) {
          inputs.push([key, schema]);
        } else {
          configs.push([key, schema]);
        }
      }
    });
    
    return { inputs, configs };
  };

  const { inputs: inputSchemaFields, configs: configFields } = categorizeFields();
  
  // Debug logging for Text Input components
  console.log('UniversalConfigPanel - Component analysis:', {
    component_type: template.component_type,
    display_name: template.display_name,
    inputSchemaFields: inputSchemaFields.length,
    configFields: configFields.length,
    hasConnections,
    availableInputFields
  });

  // Check if a field supports variables
  const supportsVariables = (key: string, schema: InputSchemaItem): boolean => {
    if (schema.supports_variables !== undefined) {
      return schema.supports_variables;
    }
    
    // Auto-detect based on field type and name
    return schema.type === 'string' && (
      key.includes('template') ||
      key.includes('prompt') ||
      key.includes('message') ||
      key.includes('text') ||
      key.includes('content')
    );
  };

  // Render field based on type and variable support
  const renderField = (key: string, schema: InputSchemaItem, section: 'input' | 'config') => {
    const commonProps = {
      placeholder: schema.description,
      onChange: handleFormChange,
    };

    // Special handling for Chat Input test message field
    if (key === 'test_message' && template.component_type === 'chat_input') {
      return (
        <TextArea
          rows={3}
          placeholder="Enter test message for this Chat Input node (used for testing and preview)"
          {...commonProps}
          value={form.getFieldValue(key) || 'Hello, this is a test message!'}
        />
      );
    }

    // Special handling for Ollama model field - load models dynamically
    if (key === 'model' && template.component_type === 'ollama_llm') {
      return (
        <Select
          {...commonProps}
          value={form.getFieldValue(key) || schema.default}
          onFocus={async () => {
            // Load models when field is focused
            const baseUrl = form.getFieldValue('ollama_base_url') || 'http://localhost:11434';
            try {
              const response = await fetch(`/api/ollama/models?base_url=${encodeURIComponent(baseUrl)}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.status === 'connected' && result.models) {
                  // Update schema enum with available models
                  schema.enum = result.models;
                  // Force re-render by updating form
                  form.setFieldsValue({ [key]: form.getFieldValue(key) });
                }
              }
            } catch (error) {
              console.warn('Failed to load Ollama models:', error);
            }
          }}
          notFoundContent="Connect to Ollama server to load models"
          loading={false}
          allowClear
        >
          {(schema.enum || []).map(option => (
            <Option key={option} value={option}>{option}</Option>
          ))}
        </Select>
      );
    }

    // Use VariableField for variable-supporting string fields
    if (supportsVariables(key, schema)) {
      return (
        <VariableField
          value={form.getFieldValue(key) || schema.default || ''}
          onChange={(value) => {
            form.setFieldValue(key, value);
            handleFormChange(null, null);
          }}
          availableVariables={[...availableInputFields, ...Object.keys(manualVariables)]}
          realInputData={getRealInputData()}
          placeholder={schema.description}
          isTextArea={key.includes('template') || key.includes('prompt') || key.includes('message')}
        />
      );
    }

    // Handle password fields
    if (schema.format === 'password') {
      return <Input.Password {...commonProps} />;
    }

    // Handle select fields (enum)
    if (schema.enum && schema.enum.length > 0) {
      return (
        <Select {...commonProps} allowClear>
          {schema.enum.map(option => (
            <Option key={option} value={option}>{option}</Option>
          ))}
        </Select>
      );
    }

    // Handle number fields
    if (schema.type === 'number' || schema.type === 'integer') {
      return (
        <InputNumber 
          style={{ width: '100%' }} 
          min={schema.minimum}
          max={schema.maximum}
          {...commonProps} 
        />
      );
    }

    // Handle boolean fields
    if (schema.type === 'boolean') {
      return <Switch onChange={handleFormChange} />;
    }

    // Handle text areas for long strings
    if (schema.type === 'string' && (key.includes('prompt') || key.includes('template') || key.includes('message'))) {
      return <TextArea rows={4} {...commonProps} />;
    }

    // Default to regular input
    return <Input {...commonProps} />;
  };

  // Analyze current template content for variables
  const analyzeVariables = () => {
    const allVariables = new Set<string>();
    const currentValues = form.getFieldsValue();
    
    // Extract variables from all text fields
    Object.entries(currentValues).forEach(([key, value]) => {
      if (typeof value === 'string' && template.input_schema?.properties?.[key]) {
        const schema = template.input_schema.properties[key];
        if (supportsVariables(key, schema)) {
          extractVariables(value).forEach(v => allVariables.add(v));
        }
      }
    });

    const allDefinedVariables = [...availableInputFields, ...Object.keys(manualVariables)];
    const unmappedVariables = Array.from(allVariables).filter(v => !allDefinedVariables.includes(v));
    
    return {
      templateVariables: Array.from(allVariables),
      unmappedVariables,
      allDefinedVariables
    };
  };

  const { templateVariables, unmappedVariables, allDefinedVariables } = analyzeVariables();

  return (
    <div style={{ padding: '16px' }}>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        preserve={true}
        initialValues={{
          display_name: initialValues.display_name || template.display_name,
          ...initialValues.input_values,
          ...initialValues.config_data,
        }}
      >
        <Collapse 
          activeKey={expandedSections}
          onChange={setExpandedSections}
          style={{ marginBottom: '16px' }}
        >
          {/* Basic Information Section */}
          <Panel 
            header={
              <Space align="center">
                <SettingOutlined style={{ color: template.color }} />
                <Text strong>Basic Information</Text>
              </Space>
            } 
            key="basic"
          >
            <Card size="small">
              <Space align="center" style={{ marginBottom: '12px' }}>
                <span style={{ color: template.color, fontSize: '16px' }}>
                  {template.icon}
                </span>
                <Text strong>{template.display_name}</Text>
                <Tag color={template.color}>{template.category}</Tag>
              </Space>
              
              <Text style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '12px' }}>
                {template.description}
              </Text>

              <Form.Item
                label="Display Name"
                name="display_name"
                rules={[{ required: true, message: 'Display name is required' }]}
              >
                <Input placeholder="Enter display name" />
              </Form.Item>
            </Card>
          </Panel>

          {/* Input Variables Section - for fields that receive data from other nodes */}
          {inputSchemaFields.length > 0 && (
            <Panel 
              header={
                <Space align="center">
                  <LinkOutlined style={{ color: '#3b82f6' }} />
                  <Text strong>Input Variables</Text>
                  {hasConnections && (
                    <Tag color="blue" size="small">
                      {availableInputFields.length} connected
                    </Tag>
                  )}
                </Space>
              } 
              key="inputs"
            >
              {/* Available Input Variables Info */}
              {hasConnections && (
                <Alert
                  message={`Connected variables: ${availableInputFields.join(', ')}`}
                  description="These variables are available from connected nodes and can be used in template fields with {variable_name} syntax"
                  type="info"
                  size="small"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}

              {inputSchemaFields.map(([key, schema]) => {
                // Hide "Input Data" field and similar data input fields
                const hideField = key.toLowerCase().includes('data') || 
                                 key.toLowerCase().includes('input_data') ||
                                 (schema.title && schema.title.toLowerCase().includes('input data'));
                
                if (hideField) {
                  return null;
                }
                
                return (
                  <Form.Item
                    key={key}
                    label={
                      <Space>
                        <Text>{schema.title || key}</Text>
                        {template.input_schema.required?.includes(key) && <Text type="danger">*</Text>}
                        {supportsVariables(key, schema) && (
                          <Tooltip title="This field supports {variable} substitution">
                            <FieldStringOutlined style={{ color: '#faad14' }} />
                          </Tooltip>
                        )}
                      </Space>
                    }
                    name={key}
                    rules={[
                      {
                        required: template.input_schema.required?.includes(key),
                        message: `${schema.title || key} is required`,
                      },
                    ]}
                    help={schema.description}
                    initialValue={schema.default}
                  >
                    {renderField(key, schema, 'input')}
                  </Form.Item>
                );
              }).filter(Boolean)}
            </Panel>
          )}

          {/* Special Chat Input Test Message Section */}
          {template.component_type === 'chat_input' && (
            <Panel 
              header={
                <Space align="center">
                  <SettingOutlined style={{ color: '#52c41a' }} />
                  <Text strong>Test Message</Text>
                  <Tag color="green">Preview & Testing</Tag>
                </Space>
              } 
              key="chat-test"
            >
              <Alert
                message="Test Message Configuration"
                description="Enter a test message that will be used when this Chat Input node is executed during preview or testing. This simulates user input in the chat flow."
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />
              
              <Form.Item
                label="Test Message"
                name="test_message"
                help="This message will be used as the Chat Input output for testing and preview purposes"
                rules={[{ required: false }]}
              >
                <TextArea
                  rows={3}
                  placeholder="안녕하세요! 이것은 테스트 메시지입니다. 이 메시지가 Chat Input의 출력으로 사용됩니다."
                  maxLength={500}
                  showCount
                />
              </Form.Item>
            </Panel>
          )}

          {/* Configuration Section - for component settings */}
          {configFields.length > 0 && (
            <Panel 
              header={
                <Space align="center">
                  <SettingOutlined style={{ color: '#6b7280' }} />
                  <Text strong>Configuration</Text>
                  <Tag color="default" size="small">
                    {configFields.length} settings
                  </Tag>
                </Space>
              } 
              key="config"
            >
              {configFields.map(([key, schema]) => {
                // Hide variable_mappings and manual_variables fields that show as [object Object]
                const hideField = key === 'variable_mappings' || 
                                 key === 'manual_variables' ||
                                 (schema.title && (schema.title === 'Variable Mappings' || schema.title === 'Manual Variables'));
                
                if (hideField) {
                  return null;
                }
                
                return (
                  <Form.Item
                    key={key}
                    label={
                      <Space>
                        <Text>{schema.title || key}</Text>
                        {template.input_schema.required?.includes(key) && <Text type="danger">*</Text>}
                        {supportsVariables(key, schema) && (
                          <Tooltip title="This field supports {variable} substitution">
                            <FieldStringOutlined style={{ color: '#faad14' }} />
                          </Tooltip>
                        )}
                      </Space>
                    }
                    name={key}
                    rules={[
                      {
                        required: template.input_schema.required?.includes(key),
                        message: `${schema.title || key} is required`,
                      },
                    ]}
                    help={schema.description}
                    initialValue={schema.default}
                  >
                    {renderField(key, schema, 'config')}
                  </Form.Item>
                );
              }).filter(Boolean)}
            </Panel>
          )}

          {/* Variable Analysis Section - Hidden but functionality preserved */}
          {false && templateVariables.length > 0 && (
            <Panel 
              header={
                <Space align="center">
                  <FieldStringOutlined style={{ color: '#fa8c16' }} />
                  <Text strong>Variable Analysis</Text>
                  <Tag color="orange" size="small">
                    {templateVariables.length} variables
                  </Tag>
                </Space>
              } 
              key="variables"
            >
              <div style={{ marginBottom: '12px' }}>
                <Text style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                  Variables found in template fields:
                </Text>
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {templateVariables.map(variable => (
                    <Tag 
                      key={variable}
                      color={allDefinedVariables.includes(variable) ? 'green' : 'orange'}
                      style={{ fontSize: '11px' }}
                    >
                      {variable}
                      {!allDefinedVariables.includes(variable) && (
                        <Tooltip title="This variable is not mapped">
                          <InfoCircleOutlined style={{ marginLeft: '4px', color: '#faad14' }} />
                        </Tooltip>
                      )}
                    </Tag>
                  ))}
                </div>
                
                {unmappedVariables.length > 0 && (
                  <Alert
                    message={`Unmapped variables: ${unmappedVariables.join(', ')}`}
                    description="These variables won't be replaced unless you map them below"
                    type="warning"
                    size="small"
                    showIcon
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>
            </Panel>
          )}

          {/* Manual Variables Section */}
          <Panel 
            header={
              <Space align="center">
                <PlusOutlined style={{ color: '#10b981' }} />
                <Text strong>Manual Variables</Text>
                {Object.keys(manualVariables).length > 0 && (
                  <Tag color="green" size="small">
                    {Object.keys(manualVariables).length} variables
                  </Tag>
                )}
              </Space>
            } 
            key="manual"
          >
            <Text style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '12px' }}>
              Add static variables that don't come from input data:
            </Text>

            {Object.entries(manualVariables).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '12px' }}>
                <Row gutter={12}>
                  <Col span={10}>
                    <Input
                      placeholder="Variable name"
                      value={key}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        updateManualVariable(key, newKey, value);
                      }}
                      size="small"
                    />
                  </Col>
                  <Col span={12}>
                    <Input
                      placeholder="Variable value"
                      value={value}
                      onChange={(e) => {
                        updateManualVariable(key, key, e.target.value);
                      }}
                      size="small"
                    />
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeManualVariable(key)}
                    />
                  </Col>
                </Row>
              </div>
            ))}

            <Button
              type="dashed"
              onClick={addManualVariable}
              icon={<PlusOutlined />}
              size="small"
              block
            >
              Add Manual Variable
            </Button>
          </Panel>
        </Collapse>
      </Form>
    </div>
  );
};

export default UniversalConfigPanel;