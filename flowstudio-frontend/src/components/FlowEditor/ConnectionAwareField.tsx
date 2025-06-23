/**
 * Connection-Aware Field Component
 * Provides advanced input mapping capabilities for any component type
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Card,
  Typography,
  Space,
  Tag,
  Alert,
  Button,
  Input,
  Select,
  Row,
  Col,
  Tooltip,
  Divider
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  FieldStringOutlined
} from '@ant-design/icons';
import { 
  VariableMapping, 
  generateSuggestedMappings, 
  validateMappings,
  extractVariables,
  isTemplateField
} from '../../utils/variableExtractor';

const { Title, Text } = Typography;
const { Option } = Select;

interface ConnectionAwareFieldProps {
  fieldName: string;
  fieldSchema: any;
  nodeId: string;
  availableInputFields: string[];
  inputFields: Array<{
    name: string;
    type: string;
    description?: string;
    sourceNode?: string;
  }>;
  form: any;
  initialMappings?: VariableMapping[];
  onMappingsChange?: (mappings: VariableMapping[]) => void;
}

const ConnectionAwareField: React.FC<ConnectionAwareFieldProps> = ({
  fieldName,
  fieldSchema,
  nodeId,
  availableInputFields,
  inputFields,
  form,
  initialMappings = [],
  onMappingsChange
}) => {
  const [mappings, setMappings] = useState<VariableMapping[]>(initialMappings);
  const [showMappingEditor, setShowMappingEditor] = useState(false);
  const [autoMappingApplied, setAutoMappingApplied] = useState(false);

  const hasConnections = availableInputFields.length > 0;
  const isTemplate = isTemplateField(fieldName, fieldSchema);

  // Extract template variables if this is a template field
  const currentValue = form.getFieldValue(fieldName) || fieldSchema.default || '';
  const templateAnalysis = isTemplate ? extractVariables(currentValue) : null;

  // Generate automatic mappings when connections are available
  const suggestedMappings = useMemo(() => {
    if (!hasConnections) return [];
    
    if (isTemplate && templateAnalysis?.uniqueVariables) {
      return generateSuggestedMappings(templateAnalysis.uniqueVariables, availableInputFields);
    }
    
    // For non-template fields, create direct mapping
    return [{
      inputField: availableInputFields[0] || '',
      variableName: fieldName,
      defaultValue: '',
      transform: 'none' as const,
      source: 'connected_node' as const
    }];
  }, [hasConnections, isTemplate, templateAnalysis, availableInputFields, fieldName]);

  // Auto-apply suggested mappings when connections become available
  useEffect(() => {
    if (hasConnections && !autoMappingApplied && suggestedMappings.length > 0) {
      setMappings(suggestedMappings);
      setAutoMappingApplied(true);
      onMappingsChange?.(suggestedMappings);
    }
  }, [hasConnections, suggestedMappings, autoMappingApplied, onMappingsChange]);

  // Validate current mappings
  const validationResult = useMemo(() => 
    validateMappings(mappings, availableInputFields),
    [mappings, availableInputFields]
  );

  const handleMappingChange = (index: number, field: keyof VariableMapping, value: any) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
    onMappingsChange?.(newMappings);
  };

  const addMapping = () => {
    const newMapping: VariableMapping = {
      inputField: '',
      variableName: `var_${mappings.length + 1}`,
      defaultValue: '',
      transform: 'none',
      source: 'manual'
    };
    const newMappings = [...mappings, newMapping];
    setMappings(newMappings);
    onMappingsChange?.(newMappings);
  };

  const removeMapping = (index: number) => {
    const newMappings = mappings.filter((_, i) => i !== index);
    setMappings(newMappings);
    onMappingsChange?.(newMappings);
  };

  const applyAutomaticMappings = () => {
    setMappings(suggestedMappings);
    setAutoMappingApplied(true);
    onMappingsChange?.(suggestedMappings);
  };

  const renderBasicField = () => (
    <Form.Item
      label={
        <Space>
          <Text>{fieldSchema.title || fieldName}</Text>
          {fieldSchema.required && <Text type="danger">*</Text>}
          {hasConnections && (
            <Tooltip title="This field can receive data from connected nodes">
              <LinkOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
          )}
        </Space>
      }
      name={fieldName}
      rules={[
        {
          required: fieldSchema.required,
          message: `${fieldSchema.title || fieldName} is required`,
        },
      ]}
      help={fieldSchema.description}
    >
      <Input placeholder={fieldSchema.description} disabled={hasConnections && mappings.length > 0} />
    </Form.Item>
  );

  if (!hasConnections && !isTemplate) {
    return renderBasicField();
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Field Header */}
      <div style={{ marginBottom: '12px' }}>
        <Space>
          <Text strong>{fieldSchema.title || fieldName}</Text>
          {fieldSchema.required && <Text type="danger">*</Text>}
          {hasConnections && (
            <Tag color="blue" size="small">
              {availableInputFields.length} connections
            </Tag>
          )}
          {isTemplate && (
            <Tag color="orange" size="small">
              Template field
            </Tag>
          )}
        </Space>
        {fieldSchema.description && (
          <div style={{ marginTop: '4px' }}>
            <Text style={{ fontSize: '12px', color: '#666' }}>
              {fieldSchema.description}
            </Text>
          </div>
        )}
      </div>

      {/* Connection Status */}
      {!hasConnections ? (
        <Alert
          message="No input connections"
          description="Connect this node to another node's output to enable automatic data mapping"
          type="info"
          size="small"
          showIcon
          style={{ marginBottom: '12px' }}
        />
      ) : (
        <Card size="small" style={{ marginBottom: '12px', background: '#f6ffed' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <LinkOutlined style={{ color: '#52c41a' }} />
              <Text style={{ fontSize: '12px' }}>
                Connected to {inputFields.length} output{inputFields.length !== 1 ? 's' : ''}
              </Text>
            </Space>
            {!showMappingEditor && (
              <Button
                size="small"
                type="link"
                onClick={() => setShowMappingEditor(true)}
              >
                Configure Mapping
              </Button>
            )}
          </Space>

          {/* Quick mapping info */}
          {mappings.length > 0 && !showMappingEditor && (
            <div style={{ marginTop: '8px' }}>
              <Text style={{ fontSize: '11px', color: '#666' }}>
                Mapped fields: {mappings.map(m => m.inputField || m.variableName).join(', ')}
              </Text>
            </div>
          )}
        </Card>
      )}

      {/* Template Variable Analysis */}
      {isTemplate && templateAnalysis?.hasVariables && (
        <Card size="small" style={{ marginBottom: '12px', background: '#fff7e6' }}>
          <Space style={{ marginBottom: '8px' }}>
            <FieldStringOutlined style={{ color: '#fa8c16' }} />
            <Text style={{ fontSize: '12px', fontWeight: 600 }}>
              Template Variables ({templateAnalysis.totalVariables})
            </Text>
          </Space>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {templateAnalysis.uniqueVariables.map(variable => {
              const isMapped = mappings.some(m => m.variableName === variable);
              return (
                <Tag 
                  key={variable}
                  color={isMapped ? 'green' : 'orange'}
                  style={{ fontSize: '10px' }}
                >
                  {variable}
                  {!isMapped && (
                    <Tooltip title="Variable not mapped">
                      <InfoCircleOutlined style={{ marginLeft: '2px' }} />
                    </Tooltip>
                  )}
                </Tag>
              );
            })}
          </div>
        </Card>
      )}

      {/* Automatic Mapping Suggestion */}
      {hasConnections && suggestedMappings.length > 0 && !autoMappingApplied && (
        <Alert
          message="Automatic mapping available"
          description={
            <Space>
              <Text>We can automatically map available inputs to your template variables.</Text>
              <Button size="small" type="primary" onClick={applyAutomaticMappings}>
                Apply Auto-mapping
              </Button>
            </Space>
          }
          type="info"
          size="small"
          showIcon
          style={{ marginBottom: '12px' }}
        />
      )}

      {/* Mapping Editor */}
      {showMappingEditor && hasConnections && (
        <Card 
          size="small" 
          title={
            <Space>
              <ArrowRightOutlined style={{ color: '#1890ff' }} />
              <Text>Input Mapping Configuration</Text>
            </Space>
          }
          extra={
            <Button 
              size="small" 
              onClick={() => setShowMappingEditor(false)}
            >
              Done
            </Button>
          }
          style={{ marginBottom: '12px' }}
        >
          {/* Available Inputs */}
          <div style={{ marginBottom: '16px' }}>
            <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Available Input Fields:
            </Text>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {inputFields.map(field => (
                <Tooltip 
                  key={field.name} 
                  title={`From ${field.sourceNode}: ${field.description || 'No description'}`}
                >
                  <Tag color="blue" style={{ fontSize: '11px' }}>
                    {field.name}
                    <Text style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.7 }}>
                      ({field.type})
                    </Text>
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* Mapping Configuration */}
          <div style={{ marginBottom: '12px' }}>
            <Space style={{ marginBottom: '8px' }}>
              <Text style={{ fontSize: '12px', fontWeight: 600 }}>Variable Mappings:</Text>
              <Button size="small" icon={<PlusOutlined />} onClick={addMapping}>
                Add Mapping
              </Button>
            </Space>

            {mappings.map((mapping, index) => (
              <Row key={index} gutter={8} style={{ marginBottom: '8px', alignItems: 'center' }}>
                <Col span={8}>
                  <Select
                    size="small"
                    placeholder="Input field"
                    value={mapping.inputField}
                    onChange={(value) => handleMappingChange(index, 'inputField', value)}
                    style={{ width: '100%' }}
                    allowClear
                  >
                    {availableInputFields.map(field => (
                      <Option key={field} value={field}>{field}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={1} style={{ textAlign: 'center' }}>
                  <ArrowRightOutlined style={{ fontSize: '10px', color: '#999' }} />
                </Col>
                <Col span={8}>
                  <Input
                    size="small"
                    placeholder="Variable name"
                    value={mapping.variableName}
                    onChange={(e) => handleMappingChange(index, 'variableName', e.target.value)}
                  />
                </Col>
                <Col span={5}>
                  <Select
                    size="small"
                    value={mapping.transform}
                    onChange={(value) => handleMappingChange(index, 'transform', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="none">No transform</Option>
                    <Option value="uppercase">UPPERCASE</Option>
                    <Option value="lowercase">lowercase</Option>
                    <Option value="title_case">Title Case</Option>
                    <Option value="trim">Trim spaces</Option>
                  </Select>
                </Col>
                <Col span={2}>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeMapping(index)}
                  />
                </Col>
              </Row>
            ))}

            {mappings.length === 0 && (
              <Text style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                No mappings configured. Add a mapping to connect input data to this field.
              </Text>
            )}
          </div>

          {/* Validation Messages */}
          {!validationResult.valid && (
            <Alert
              message="Mapping Configuration Issues"
              description={
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {validationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              }
              type="warning"
              size="small"
              showIcon
            />
          )}
        </Card>
      )}

      {/* Fallback Field for Manual Input */}
      {!hasConnections || mappings.length === 0 ? (
        renderBasicField()
      ) : (
        <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
          <Text style={{ fontSize: '11px', color: '#666' }}>
            This field will receive data from connected nodes. Manual input is disabled.
          </Text>
        </div>
      )}
    </div>
  );
};

export default ConnectionAwareField;