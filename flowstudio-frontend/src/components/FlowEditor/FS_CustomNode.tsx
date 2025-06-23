import React, { useState, useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { 
  Card, 
  Input, 
  Select, 
  Typography, 
  Space, 
  Button, 
  Dropdown,
  Switch,
  InputNumber
} from 'antd';
import { 
  MoreOutlined, 
  MessageOutlined,
  FileTextOutlined,
  CloudOutlined,
  EditOutlined,
  BranchesOutlined,
  FormatPainterOutlined,
  ExperimentOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Node data interface
interface NodeData {
  id?: string;
  template?: ComponentTemplate;
  component_key: string;
  display_name?: string;
  config_data: Record<string, any>;
  input_values: Record<string, any>;
}

interface ComponentTemplate {
  id: string;
  component_type: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  input_schema: Record<string, InputSchemaItem>;
  output_schema: Record<string, OutputSchemaItem>;
  version: string;
  is_active: boolean;
  is_beta: boolean;
  documentation: string | null;
  examples: Record<string, any> | null;
}

interface InputSchemaItem {
  display_name: string;
  type: 'string' | 'number' | 'boolean' | 'dict' | 'list' | 'Text' | 'Dataframe' | 'Code' | 'Model' | 'Agent' | 'Tool' | 'Generic';
  required: boolean;
  is_handle: boolean;
  field_type?: 'text' | 'textarea' | 'password' | 'code' | 'select' | 'number' | 'switch';
  options?: string[];
  description?: string;
}

interface OutputSchemaItem {
  display_name: string;
  type: 'string' | 'number' | 'boolean' | 'dict' | 'list' | 'Text' | 'Dataframe' | 'Code' | 'Model' | 'Agent' | 'Tool' | 'Generic';
  description?: string;
}

// Type color mapping based on the roadmap specifications
const getPortColor = (type: string): string => {
  const typeColorMap: Record<string, string> = {
    'Text': '#4A90E2',
    'Code': '#4A90E2',
    'string': '#4A90E2',
    'Dataframe': '#50E3C2',
    'dict': '#50E3C2',
    'list': '#50E3C2',
    'Model': '#BD10E0',
    'Agent': '#BD10E0',
    'Tool': '#BD10E0',
    'number': '#BD10E0',
    'boolean': '#BD10E0',
    'Generic': '#9B9B9B',
  };
  
  return typeColorMap[type] || '#9B9B9B';
};

// Icon mapping
const getComponentIcon = (iconName: string, category: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'MessageOutlined': <MessageOutlined />,
    'FileTextOutlined': <FileTextOutlined />,
    'CloudOutlined': <CloudOutlined />,
    'EditOutlined': <EditOutlined />,
    'BranchesOutlined': <BranchesOutlined />,
    'FormatPainterOutlined': <FormatPainterOutlined />,
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    'Inputs': <MessageOutlined />,
    'Outputs': <MessageOutlined />,
    'LLMs': <CloudOutlined />,
    'Prompts': <EditOutlined />,
    'Logic': <BranchesOutlined />,
    'Utilities': <FormatPainterOutlined />,
  };

  return iconMap[iconName] || categoryIcons[category] || <ExperimentOutlined />;
};

const FS_CustomNode: React.FC<NodeProps<NodeData>> = ({ data, selected, id }) => {
  const [inputValues, setInputValues] = useState<Record<string, any>>(data.input_values || {});
  const [configData, setConfigData] = useState<Record<string, any>>(data.config_data || {});
  const { setNodes } = useReactFlow();

  const template = data.template;
  
  if (!template) {
    return (
      <Card size="small" style={{ minWidth: 200, border: '2px solid #ff4d4f' }}>
        <Text type="danger">Missing template data</Text>
      </Card>
    );
  }

  // Handle input value changes
  const handleInputChange = useCallback((key: string, value: any) => {
    const newInputValues = { ...inputValues, [key]: value };
    setInputValues(newInputValues);
    
    // Update node data in flow state
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                input_values: newInputValues,
              },
            }
          : node
      )
    );
  }, [id, inputValues, setNodes]);

  // Handle configuration changes
  const handleConfigChange = useCallback((key: string, value: any) => {
    const newConfigData = { ...configData, [key]: value };
    setConfigData(newConfigData);
    
    // Update node data in flow state
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                config_data: newConfigData,
              },
            }
          : node
      )
    );
  }, [id, configData, setNodes]);

  // Render input field based on field type
  const renderInputField = (key: string, schema: InputSchemaItem) => {
    const value = inputValues[key] || '';
    
    switch (schema.field_type) {
      case 'textarea':
        return (
          <TextArea
            rows={3}
            value={value}
            onChange={(e) => handleInputChange(key, e.target.value)}
            placeholder={schema.description}
            size="small"
          />
        );
      
      case 'password':
        return (
          <Input.Password
            value={value}
            onChange={(e) => handleInputChange(key, e.target.value)}
            placeholder={schema.description}
            size="small"
          />
        );
      
      case 'select':
        return (
          <Select
            value={value}
            onChange={(val) => handleInputChange(key, val)}
            placeholder={schema.description}
            size="small"
            style={{ width: '100%' }}
          >
            {schema.options?.map(option => (
              <Option key={option} value={option}>{option}</Option>
            ))}
          </Select>
        );
      
      case 'number':
        return (
          <InputNumber
            value={value}
            onChange={(val) => handleInputChange(key, val)}
            placeholder={schema.description}
            size="small"
            style={{ width: '100%' }}
          />
        );
      
      case 'switch':
        return (
          <Switch
            checked={value}
            onChange={(checked) => handleInputChange(key, checked)}
            size="small"
          />
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleInputChange(key, e.target.value)}
            placeholder={schema.description}
            size="small"
          />
        );
    }
  };

  // Node menu items
  const menuItems = [
    {
      key: 'duplicate',
      label: 'Duplicate Node',
    },
    {
      key: 'delete',
      label: 'Delete Node',
      danger: true,
    },
    {
      key: 'disable',
      label: 'Disable Node',
    },
    {
      key: 'help',
      label: 'View Documentation',
    },
  ];

  return (
    <Card
      size="small"
      style={{
        minWidth: 280,
        maxWidth: 400,
        border: selected ? `2px solid ${template.color}` : '1px solid #d9d9d9',
        boxShadow: selected ? `0 0 0 2px ${template.color}20` : '0 2px 8px rgba(0,0,0,0.1)',
        borderRadius: 8,
      }}
      styles={{ body: { padding: 12 } }}
    >
      {/* Header Section */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid #f0f0f0'
      }}>
        <Space align="center">
          <span style={{ color: template.color, fontSize: '16px' }}>
            {getComponentIcon(template.icon, template.category)}
          </span>
          <Text strong style={{ fontSize: '14px' }}>
            {data.display_name || template.display_name}
          </Text>
        </Space>
        
        <Dropdown
          menu={{ 
            items: menuItems,
            onClick: ({ key }) => {
              console.log('Menu action:', key);
              // TODO: Implement menu actions
            }
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button 
            type="text" 
            size="small" 
            icon={<MoreOutlined />}
            style={{ padding: 0, width: 24, height: 24 }}
          />
        </Dropdown>
      </div>

      {/* Input Section (Body) */}
      <div style={{ marginBottom: 8 }}>
        {Object.entries(template.input_schema || {}).map(([key, schema]) => (
          <div key={key} style={{ marginBottom: 8, position: 'relative' }}>
            {/* Input Handle (Left side) */}
            {schema.is_handle && (
              <Handle
                type="target"
                position={Position.Left}
                id={key}
                style={{
                  background: getPortColor(schema.type),
                  border: '2px solid white',
                  borderRadius: '50%',
                  width: 12,
                  height: 12,
                  left: -6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            )}
            
            {/* Input Field */}
            <div style={{ paddingLeft: schema.is_handle ? 12 : 0 }}>
              <div style={{ marginBottom: 4 }}>
                <Text 
                  style={{ 
                    fontSize: '12px', 
                    color: '#666',
                    fontWeight: schema.required ? 600 : 400
                  }}
                >
                  {schema.display_name}
                  {schema.required && <span style={{ color: '#ff4d4f' }}> *</span>}
                </Text>
              </div>
              
              {!schema.is_handle && renderInputField(key, schema)}
            </div>
          </div>
        ))}
      </div>

      {/* Output Section (Footer) */}
      {Object.keys(template.output_schema || {}).length > 0 && (
        <div style={{ 
          paddingTop: 8,
          borderTop: '1px solid #f0f0f0'
        }}>
          {Object.entries(template.output_schema || {}).map(([key, schema]) => (
            <div 
              key={key} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-end',
                marginBottom: 4,
                position: 'relative'
              }}
            >
              <Text 
                style={{ 
                  fontSize: '12px', 
                  color: '#666',
                  marginRight: 12
                }}
              >
                {schema.display_name}
              </Text>
              
              {/* Output Handle (Right side) */}
              <Handle
                type="source"
                position={Position.Right}
                id={key}
                style={{
                  background: getPortColor(schema.type),
                  border: '2px solid white',
                  borderRadius: '50%',
                  width: 12,
                  height: 12,
                  right: -6,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default FS_CustomNode;