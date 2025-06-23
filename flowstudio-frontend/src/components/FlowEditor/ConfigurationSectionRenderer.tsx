/**
 * Universal Configuration Section Renderer
 * Renders any component schema as organized sections with advanced features
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Button,
  Space,
  Tag,
  Alert,
  Collapse,
  Tooltip,
  Row,
  Col,
  Divider
} from 'antd';
import {
  InfoCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
  FieldStringOutlined,
  SettingOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { 
  extractVariables, 
  generateSuggestedMappings, 
  isTemplateField,
  extractFieldTypeHints 
} from '../../utils/variableExtractor';
import ConnectionAwareField from './ConnectionAwareField';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

export interface ConfigSection {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  color?: string;
  fields: ConfigField[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  advanced?: boolean;
}

export interface ConfigField {
  name: string;
  schema: any;
  value?: any;
  isTemplateField?: boolean;
  isConnectionAware?: boolean;
  section?: string;
  advanced?: boolean;
}

interface ConfigurationSectionRendererProps {
  nodeId: string;
  template: any;
  initialValues: Record<string, any>;
  availableInputFields: string[];
  inputFields: Array<{
    name: string;
    type: string;
    description?: string;
    sourceNode?: string;
  }>;
  onValuesChange: (values: Record<string, any>) => void;
  onSectionExpand?: (sectionId: string, expanded: boolean) => void;
}

const ConfigurationSectionRenderer: React.FC<ConfigurationSectionRendererProps> = ({
  nodeId,
  template,
  initialValues,
  availableInputFields,
  inputFields,
  onValuesChange,
  onSectionExpand
}) => {
  const [form] = Form.useForm();
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic']);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Analyze the schema and organize into sections
  const sections = useMemo(() => {
    return organizeSchemaIntoSections(template, initialValues, availableInputFields);
  }, [template, initialValues, availableInputFields]);

  // Initialize form
  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const handleFormChange = (changedFields: any, allFields: any) => {
    const values = form.getFieldsValue();
    onValuesChange(values);
  };

  const handleSectionToggle = (sectionId: string) => {
    const newExpanded = expandedSections.includes(sectionId)
      ? expandedSections.filter(id => id !== sectionId)
      : [...expandedSections, sectionId];
    
    setExpandedSections(newExpanded);
    onSectionExpand?.(sectionId, newExpanded.includes(sectionId));
  };

  const filteredSections = sections.filter(section => 
    !section.advanced || showAdvanced
  );

  return (
    <div style={{ padding: '16px' }}>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        preserve={false}
      >
        {/* Advanced toggle */}
        {sections.some(s => s.advanced) && (
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            <Space>
              <Text style={{ fontSize: '12px' }}>Show Advanced Options</Text>
              <Switch
                size="small"
                checked={showAdvanced}
                onChange={setShowAdvanced}
                checkedChildren="Advanced"
                unCheckedChildren="Basic"
              />
            </Space>
          </div>
        )}

        {/* Render sections */}
        {filteredSections.map(section => (
          <ConfigSectionCard
            key={section.id}
            section={section}
            nodeId={nodeId}
            expanded={expandedSections.includes(section.id)}
            onToggle={() => handleSectionToggle(section.id)}
            availableInputFields={availableInputFields}
            inputFields={inputFields}
            form={form}
          />
        ))}
      </Form>
    </div>
  );
};

interface ConfigSectionCardProps {
  section: ConfigSection;
  nodeId: string;
  expanded: boolean;
  onToggle: () => void;
  availableInputFields: string[];
  inputFields: Array<{
    name: string;
    type: string;
    description?: string;
    sourceNode?: string;
  }>;
  form: any;
}

const ConfigSectionCard: React.FC<ConfigSectionCardProps> = ({
  section,
  nodeId,
  expanded,
  onToggle,
  availableInputFields,
  inputFields,
  form
}) => {
  const renderField = (field: ConfigField) => {
    if (field.isConnectionAware) {
      return (
        <ConnectionAwareField
          key={field.name}
          fieldName={field.name}
          fieldSchema={field.schema}
          nodeId={nodeId}
          availableInputFields={availableInputFields}
          inputFields={inputFields}
          form={form}
        />
      );
    }

    return (
      <StandardField
        key={field.name}
        field={field}
        availableInputFields={availableInputFields}
        form={form}
      />
    );
  };

  const content = (
    <div>
      {section.fields.map(renderField)}
    </div>
  );

  if (section.collapsible) {
    return (
      <Collapse
        style={{ marginBottom: '16px' }}
        activeKey={expanded ? [section.id] : []}
        onChange={() => onToggle()}
        items={[
          {
            key: section.id,
            label: (
              <Space>
                {section.icon}
                <Text strong>{section.title}</Text>
                {section.fields.length > 0 && (
                  <Tag color={section.color} size="small">
                    {section.fields.length} fields
                  </Tag>
                )}
              </Space>
            ),
            children: content
          }
        ]}
      />
    );
  }

  return (
    <Card size="small" style={{ marginBottom: '16px' }}>
      <Title level={5} style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {section.icon}
        {section.title}
        {section.fields.length > 0 && (
          <Tag color={section.color} size="small">
            {section.fields.length} fields
          </Tag>
        )}
      </Title>
      
      {section.description && (
        <Text style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '12px' }}>
          {section.description}
        </Text>
      )}
      
      {content}
    </Card>
  );
};

interface StandardFieldProps {
  field: ConfigField;
  availableInputFields: string[];
  form: any;
}

const StandardField: React.FC<StandardFieldProps> = ({ field, availableInputFields, form }) => {
  const { name, schema } = field;
  const [showVariableHelp, setShowVariableHelp] = useState(false);

  // Check if this field is a template field
  const isTemplate = field.isTemplateField || isTemplateField(name, schema);
  
  // Extract variables if it's a template field
  const currentValue = form.getFieldValue(name) || '';
  const variableAnalysis = isTemplate ? extractVariables(currentValue) : null;

  const renderFieldInput = () => {
    // Handle password fields
    if (schema.format === 'password') {
      return <Input.Password placeholder={schema.description} />;
    }

    // Handle select fields (enum)
    if (schema.enum && schema.enum.length > 0) {
      return (
        <Select placeholder={schema.description} allowClear>
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
          style={{ width: '100%' }} 
          min={schema.minimum}
          max={schema.maximum}
          placeholder={schema.description}
        />
      );
    }

    // Handle boolean fields
    if (schema.type === 'boolean') {
      return <Switch />;
    }

    // Handle text areas for template fields or long strings
    if (isTemplate || schema.field_type === 'textarea') {
      return (
        <div>
          <TextArea 
            rows={4} 
            placeholder={schema.description || "Enter template with {variable} placeholders..."}
            style={{ fontFamily: isTemplate ? 'Monaco, monospace' : undefined }}
          />
          {isTemplate && (
            <div style={{ marginTop: '8px' }}>
              <Button
                type="link"
                size="small"
                icon={<BulbOutlined />}
                onClick={() => setShowVariableHelp(!showVariableHelp)}
              >
                Variable Helper
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Default to regular input
    return <Input placeholder={schema.description} />;
  };

  return (
    <div>
      <Form.Item
        label={
          <Space>
            <Text>{schema.title || name}</Text>
            {schema.required && <Text type="danger">*</Text>}
            {isTemplate && (
              <Tooltip title="This field supports variable substitution">
                <FieldStringOutlined style={{ color: '#fa8c16' }} />
              </Tooltip>
            )}
          </Space>
        }
        name={name}
        rules={[
          {
            required: schema.required,
            message: `${schema.title || name} is required`,
          },
        ]}
        help={schema.description}
        initialValue={schema.default}
      >
        {renderFieldInput()}
      </Form.Item>

      {/* Variable analysis for template fields */}
      {isTemplate && variableAnalysis && variableAnalysis.hasVariables && (
        <div style={{ marginBottom: '16px' }}>
          <Text style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
            Variables found ({variableAnalysis.totalVariables}):
          </Text>
          <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {variableAnalysis.uniqueVariables.map(variable => {
              const isAvailable = availableInputFields.includes(variable);
              return (
                <Tag 
                  key={variable}
                  color={isAvailable ? 'green' : 'orange'}
                  style={{ fontSize: '11px' }}
                >
                  {variable}
                  {!isAvailable && (
                    <Tooltip title="This variable is not available from connected nodes">
                      <InfoCircleOutlined style={{ marginLeft: '4px', color: '#faad14' }} />
                    </Tooltip>
                  )}
                </Tag>
              );
            })}
          </div>
          
          {variableAnalysis.unmappedVariables.length > 0 && (
            <Alert
              message={`Unmapped variables: ${variableAnalysis.unmappedVariables.join(', ')}`}
              description="These variables won't be replaced unless connected to input nodes"
              type="warning"
              size="small"
              showIcon
              style={{ marginTop: '8px' }}
            />
          )}
        </div>
      )}

      {/* Variable help panel */}
      {isTemplate && showVariableHelp && availableInputFields.length > 0 && (
        <Card size="small" style={{ marginBottom: '16px', background: '#f6ffed' }}>
          <Text style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '8px' }}>
            Available variables from connected nodes:
          </Text>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {availableInputFields.map(field => (
              <Tag 
                key={field}
                color="blue"
                style={{ 
                  fontSize: '11px',
                  cursor: 'pointer',
                  marginBottom: '4px'
                }}
                onClick={() => {
                  const currentTemplate = form.getFieldValue(name) || '';
                  const newTemplate = currentTemplate + `{${field}}`;
                  form.setFieldValue(name, newTemplate);
                }}
              >
                {field}
              </Tag>
            ))}
          </div>
          <Text style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginTop: '8px', display: 'block' }}>
            💡 Click on a variable to add it to your template
          </Text>
        </Card>
      )}
    </div>
  );
};

/**
 * Organize component schema into logical sections
 */
function organizeSchemaIntoSections(
  template: any, 
  initialValues: Record<string, any>,
  availableInputFields: string[]
): ConfigSection[] {
  const sections: ConfigSection[] = [];
  
  if (!template?.input_schema?.properties) {
    return sections;
  }

  const properties = template.input_schema.properties;
  const required = template.input_schema.required || [];
  
  // Basic Information Section
  const basicFields: ConfigField[] = [];
  const connectionFields: ConfigField[] = [];
  const advancedFields: ConfigField[] = [];
  const templateFields: ConfigField[] = [];

  Object.entries(properties).forEach(([fieldName, fieldSchema]: [string, any]) => {
    const field: ConfigField = {
      name: fieldName,
      schema: {
        ...fieldSchema,
        required: required.includes(fieldName)
      },
      value: initialValues[fieldName],
      isTemplateField: isTemplateField(fieldName, fieldSchema),
      isConnectionAware: fieldSchema.is_handle || fieldName.includes('input_data')
    };

    // Categorize fields
    if (field.isTemplateField) {
      templateFields.push(field);
    } else if (field.isConnectionAware) {
      connectionFields.push(field);
    } else if (fieldName.includes('advanced') || fieldSchema.advanced) {
      advancedFields.push(field);
    } else {
      basicFields.push(field);
    }
  });

  // Add sections based on available fields
  if (basicFields.length > 0) {
    sections.push({
      id: 'basic',
      title: 'Basic Configuration',
      description: 'Essential settings for this component',
      icon: <SettingOutlined style={{ color: '#1890ff' }} />,
      color: '#1890ff',
      fields: basicFields,
      collapsible: false,
      defaultExpanded: true
    });
  }

  if (templateFields.length > 0) {
    sections.push({
      id: 'template',
      title: 'Template Configuration',
      description: 'Template definitions with variable support',
      icon: <FieldStringOutlined style={{ color: '#fa8c16' }} />,
      color: '#fa8c16',
      fields: templateFields,
      collapsible: true,
      defaultExpanded: true
    });
  }

  if (connectionFields.length > 0) {
    sections.push({
      id: 'connections',
      title: 'Input Connections',
      description: 'Data received from connected nodes',
      icon: <LinkOutlined style={{ color: '#52c41a' }} />,
      color: '#52c41a',
      fields: connectionFields,
      collapsible: true,
      defaultExpanded: availableInputFields.length > 0
    });
  }

  if (advancedFields.length > 0) {
    sections.push({
      id: 'advanced',
      title: 'Advanced Options',
      description: 'Advanced configuration options',
      icon: <SettingOutlined style={{ color: '#722ed1' }} />,
      color: '#722ed1',
      fields: advancedFields,
      collapsible: true,
      defaultExpanded: false,
      advanced: true
    });
  }

  return sections;
}

export default ConfigurationSectionRenderer;