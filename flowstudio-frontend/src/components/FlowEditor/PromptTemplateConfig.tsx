import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Space, 
  Card, 
  Typography, 
  Tag, 
  Divider,
  Select,
  Alert,
  Tooltip,
  Row,
  Col,
  App
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  InfoCircleOutlined,
  LinkOutlined,
  FieldStringOutlined
} from '@ant-design/icons';
import { usePromptTemplateInputs } from '../../hooks/useNodeConnections';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface PromptTemplateConfigProps {
  nodeId: string;
  initialValues: {
    template?: string;
    manual_variables?: Record<string, string>;
  };
  onValuesChange: (values: any) => void;
}

const PromptTemplateConfig: React.FC<PromptTemplateConfigProps> = ({
  nodeId,
  initialValues,
  onValuesChange
}) => {
  const [form] = Form.useForm();
  const { availableInputFields, inputFields, hasConnections } = usePromptTemplateInputs(nodeId);
  
  const [manualVariables, setManualVariables] = useState<Record<string, string>>(
    initialValues.manual_variables || {}
  );

  // Track if form has been initialized to prevent unnecessary resets
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  // Initialize form with default values only once
  useEffect(() => {
    if (!isFormInitialized) {
      const initialFormValues = {
        template: initialValues.template || 'Hello {input_text}!'
      };
      form.setFieldsValue(initialFormValues);
      setIsFormInitialized(true);
      console.log('PromptTemplateConfig: Form initialized with:', initialFormValues);
    }
  }, [initialValues.template, form, isFormInitialized]);

  const handleFormChange = (changedFields: any, allFields: any) => {
    // 실제 변경된 필드만 부모에게 알림 (debounce 적용)
    const values = form.getFieldsValue();
    onValuesChange({
      ...values,
      manual_variables: manualVariables
    });
  };

  const addManualVariable = () => {
    const newKey = `var_${Object.keys(manualVariables).length + 1}`;
    const newVariables = {
      ...manualVariables,
      [newKey]: ''
    };
    setManualVariables(newVariables);
    
    // 변경사항 부모에게 알림
    const values = form.getFieldsValue();
    onValuesChange({
      ...values,
      manual_variables: newVariables
    });
  };

  const removeManualVariable = (key: string) => {
    const { [key]: removed, ...rest } = manualVariables;
    setManualVariables(rest);
    
    // 변경사항 부모에게 알림
    const values = form.getFieldsValue();
    onValuesChange({
      ...values,
      manual_variables: rest
    });
  };

  const updateManualVariable = (oldKey: string, newKey: string, value: string) => {
    const { [oldKey]: removed, ...rest } = manualVariables;
    const newVariables = {
      ...rest,
      [newKey]: value
    };
    setManualVariables(newVariables);
    
    // 변경사항 부모에게 알림
    const values = form.getFieldsValue();
    onValuesChange({
      ...values,
      manual_variables: newVariables
    });
  };

  // Extract variables from template for validation
  const extractTemplateVariables = (template: string): string[] => {
    const matches = template.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  const currentTemplate = form.getFieldValue('template') || '';
  const templateVariables = extractTemplateVariables(currentTemplate);
  const manualVariableNames = Object.keys(manualVariables);
  const allDefinedVariables = [...availableInputFields, ...manualVariableNames];
  const unmappedVariables = templateVariables.filter(v => !allDefinedVariables.includes(v));

  return (
    <div style={{ padding: '16px' }}>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        preserve={false}
      >
        {/* Template Section */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Title level={5} style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FieldStringOutlined style={{ color: '#fa8c16' }} />
            Template Definition
          </Title>
          
          <Form.Item
            name="template"
            label="Template"
            rules={[{ required: true, message: 'Template is required' }]}
            help="Use {variable_name} for variable placeholders"
          >
            <TextArea 
              rows={4} 
              placeholder="Enter template with {variable} placeholders..." 
              style={{ fontFamily: 'Monaco, monospace' }}
            />
          </Form.Item>

          {/* Template Variable Analysis */}
          {templateVariables.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                Variables in template ({templateVariables.length}):
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
          )}
        </Card>

        {/* Available Input Variables Section */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Title level={5} style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LinkOutlined style={{ color: '#3b82f6' }} />
            Available Input Variables
            {hasConnections && (
              <Tag color="blue" size="small">
                {availableInputFields.length} variables
              </Tag>
            )}
          </Title>

          {!hasConnections ? (
            <Alert
              message="No input connections detected"
              description="Connect this node to another node's output to see available variables"
              type="info"
              size="small"
              showIcon
            />
          ) : (
            <div>
              <Text style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '12px' }}>
                Variables from connected nodes (use as {'{variable_name}'} in template):
              </Text>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {availableInputFields.map(field => {
                  const fieldInfo = inputFields.find(f => f.name === field);
                  return (
                    <Tag 
                      key={field}
                      color="blue"
                      style={{ 
                        fontSize: '11px',
                        cursor: 'pointer',
                        marginBottom: '6px'
                      }}
                      onClick={() => {
                        // Copy variable to clipboard or insert into template
                        const currentTemplate = form.getFieldValue('template') || '';
                        const newTemplate = currentTemplate + `{${field}}`;
                        form.setFieldValue('template', newTemplate);
                        handleFormChange();
                      }}
                    >
                      {field}
                      {fieldInfo && (
                        <Text style={{ fontSize: '9px', color: '#6b7280', marginLeft: '4px' }}>
                          ({fieldInfo.type})
                        </Text>
                      )}
                    </Tag>
                  );
                })}
              </div>
              
              {availableInputFields.length > 0 && (
                <Text style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginTop: '8px', display: 'block' }}>
                  💡 Tip: Click on a variable to add it to your template
                </Text>
              )}
            </div>
          )}
        </Card>

        {/* Manual Variables Section */}
        <Card size="small">
          <Title level={5} style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusOutlined style={{ color: '#10b981' }} />
            Manual Variables
            {Object.keys(manualVariables).length > 0 && (
              <Tag color="green" size="small">
                {Object.keys(manualVariables).length} variables
              </Tag>
            )}
          </Title>

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
        </Card>
      </Form>
    </div>
  );
};

export default PromptTemplateConfig;