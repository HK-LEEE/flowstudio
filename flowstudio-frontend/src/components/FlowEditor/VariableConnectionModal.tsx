import React, { useState, useEffect } from 'react';
import {
  Modal,
  List,
  Checkbox,
  Typography,
  Space,
  Tag,
  Input,
  Button,
  Form,
  Card,
  Divider,
  Row,
  Col
} from 'antd';
import {
  ArrowRightOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

export interface VariableMapping {
  outputVariable: string;
  targetVariable: string;
  dataType: string;
  description?: string;
}

export interface VariableConnectionModalProps {
  visible: boolean;
  sourceNodeName: string;
  targetNodeName: string;
  availableVariables: {
    name: string;
    type: string;
    description?: string;
  }[];
  onConfirm: (mappings: VariableMapping[]) => void;
  onCancel: () => void;
}

const VariableConnectionModal: React.FC<VariableConnectionModalProps> = ({
  visible,
  sourceNodeName,
  targetNodeName,
  availableVariables,
  onConfirm,
  onCancel
}) => {
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  const [editingVariable, setEditingVariable] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedVariables([]);
      setVariableMappings({});
      setEditingVariable(null);
    }
  }, [visible]);

  const handleVariableToggle = (variableName: string) => {
    setSelectedVariables(prev => {
      const newSelected = prev.includes(variableName)
        ? prev.filter(v => v !== variableName)
        : [...prev, variableName];
      
      // Initialize mapping with the same name
      if (!prev.includes(variableName)) {
        setVariableMappings(mappings => ({
          ...mappings,
          [variableName]: variableName
        }));
      } else {
        // Remove mapping when deselecting
        setVariableMappings(mappings => {
          const newMappings = { ...mappings };
          delete newMappings[variableName];
          return newMappings;
        });
      }
      
      return newSelected;
    });
  };

  const handleMappingChange = (outputVar: string, targetVar: string) => {
    setVariableMappings(prev => ({
      ...prev,
      [outputVar]: targetVar
    }));
  };

  const handleConfirm = () => {
    const mappings: VariableMapping[] = selectedVariables.map(varName => {
      const variable = availableVariables.find(v => v.name === varName);
      return {
        outputVariable: varName,
        targetVariable: variableMappings[varName] || varName,
        dataType: variable?.type || 'string',
        description: variable?.description
      };
    });

    onConfirm(mappings);
  };

  const getVariableTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      'string': 'blue',
      'number': 'green',
      'integer': 'green',
      'boolean': 'orange',
      'object': 'purple',
      'array': 'magenta'
    };
    return typeColors[type] || 'default';
  };

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Connect Variables
          </Title>
          <Text type="secondary">
            Choose which variables to pass from <Text strong>{sourceNodeName}</Text> to <Text strong>{targetNodeName}</Text>
          </Text>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText={`Connect ${selectedVariables.length} Variable${selectedVariables.length !== 1 ? 's' : ''}`}
      cancelText="Cancel"
      width={700}
      okButtonProps={{
        disabled: selectedVariables.length === 0
      }}
    >
      <Divider />
      
      <div style={{ marginBottom: '16px' }}>
        <Text strong>Available Variables ({availableVariables.length})</Text>
        <Text type="secondary" style={{ marginLeft: '8px' }}>
          Select variables to expose to the next node
        </Text>
      </div>

      <List
        dataSource={availableVariables}
        renderItem={(variable) => {
          const isSelected = selectedVariables.includes(variable.name);
          const targetName = variableMappings[variable.name] || variable.name;
          const isEditing = editingVariable === variable.name;

          return (
            <List.Item>
              <Card
                size="small"
                style={{
                  width: '100%',
                  border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  backgroundColor: isSelected ? '#f6ffed' : 'white'
                }}
                styles={{ body: { padding: '12px' } }}
              >
                <Row align="middle" gutter={16}>
                  <Col flex="none">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleVariableToggle(variable.name)}
                    />
                  </Col>
                  
                  <Col flex="auto">
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div>
                        <Text strong>{variable.name}</Text>
                        <Tag 
                          color={getVariableTypeColor(variable.type)} 
                          style={{ marginLeft: '8px' }}
                        >
                          {variable.type}
                        </Tag>
                      </div>
                      {variable.description && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {variable.description}
                        </Text>
                      )}
                    </Space>
                  </Col>

                  {isSelected && (
                    <>
                      <Col flex="none">
                        <ArrowRightOutlined style={{ color: '#1890ff' }} />
                      </Col>
                      
                      <Col flex="auto">
                        {isEditing ? (
                          <Space>
                            <Input
                              size="small"
                              value={targetName}
                              onChange={(e) => handleMappingChange(variable.name, e.target.value)}
                              onPressEnter={() => setEditingVariable(null)}
                              autoFocus
                              style={{ width: '120px' }}
                            />
                            <Button
                              type="text"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={() => setEditingVariable(null)}
                            />
                          </Space>
                        ) : (
                          <Space>
                            <Text strong style={{ color: '#52c41a' }}>
                              {targetName}
                            </Text>
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => setEditingVariable(variable.name)}
                            />
                          </Space>
                        )}
                      </Col>
                    </>
                  )}
                </Row>
              </Card>
            </List.Item>
          );
        }}
      />

      {selectedVariables.length > 0 && (
        <>
          <Divider />
          <div>
            <Text strong>Selected Variables Preview:</Text>
            <div style={{ marginTop: '8px' }}>
              {selectedVariables.map(varName => (
                <Tag
                  key={varName}
                  color="blue"
                  style={{ marginBottom: '4px' }}
                >
                  {varName} → {variableMappings[varName] || varName}
                </Tag>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};

export default VariableConnectionModal;