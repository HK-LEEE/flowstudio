import React, { useState, useEffect, useCallback } from 'react';
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
  Col,
  Alert,
  Tooltip,
  Switch
} from 'antd';
import {
  ArrowRightOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  CopyOutlined,
  BulbOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

export interface OllamaVariableMapping {
  outputVariable: string;
  targetVariable: string;
  dataType: string;
  description?: string;
  useInPrompt?: boolean;
  useInSystemMessage?: boolean;
}

export interface OllamaVariableConnectionModalProps {
  visible: boolean;
  sourceNodeName: string;
  targetNodeName: string;
  availableVariables: {
    name: string;
    type: string;
    description?: string;
  }[];
  onConfirm: (mappings: OllamaVariableMapping[]) => void;
  onCancel: () => void;
}

const OllamaVariableConnectionModal: React.FC<OllamaVariableConnectionModalProps> = ({
  visible,
  sourceNodeName,
  targetNodeName,
  availableVariables,
  onConfirm,
  onCancel
}) => {
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [variableMappings, setVariableMappings] = useState<Map<string, OllamaVariableMapping>>(new Map());
  const [editingVariable, setEditingVariable] = useState<string | null>(null);

  // Initialize with all variables selected by default
  useEffect(() => {
    if (visible && availableVariables.length > 0) {
      const allSelected = new Set(availableVariables.map(v => v.name));
      setSelectedVariables(allSelected);
      
      // Create default mappings
      const defaultMappings = new Map<string, OllamaVariableMapping>();
      availableVariables.forEach(variable => {
        defaultMappings.set(variable.name, {
          outputVariable: variable.name,
          targetVariable: variable.name, // Default: same name
          dataType: variable.type,
          description: variable.description,
          useInPrompt: true, // Default: use in prompt
          useInSystemMessage: false // Default: don't use in system message
        });
      });
      setVariableMappings(defaultMappings);
    }
  }, [visible, availableVariables]);

  // Handle variable selection
  const handleVariableSelect = useCallback((variableName: string, selected: boolean) => {
    const newSelected = new Set(selectedVariables);
    if (selected) {
      newSelected.add(variableName);
      // Create default mapping if not exists
      if (!variableMappings.has(variableName)) {
        const variable = availableVariables.find(v => v.name === variableName);
        if (variable) {
          const newMappings = new Map(variableMappings);
          newMappings.set(variableName, {
            outputVariable: variableName,
            targetVariable: variableName,
            dataType: variable.type,
            description: variable.description,
            useInPrompt: true,
            useInSystemMessage: false
          });
          setVariableMappings(newMappings);
        }
      }
    } else {
      newSelected.delete(variableName);
    }
    setSelectedVariables(newSelected);
  }, [selectedVariables, variableMappings, availableVariables]);

  // Handle variable mapping update
  const handleMappingUpdate = useCallback((variableName: string, updates: Partial<OllamaVariableMapping>) => {
    const newMappings = new Map(variableMappings);
    const existing = newMappings.get(variableName);
    if (existing) {
      newMappings.set(variableName, { ...existing, ...updates });
      setVariableMappings(newMappings);
    }
  }, [variableMappings]);

  // Generate smart variable name
  const generateSmartVariableName = useCallback((originalName: string) => {
    // Convert camelCase or snake_case to more readable format
    const readable = originalName
      .replace(/([A-Z])/g, '_$1')
      .replace(/[_-]+/g, '_')
      .toLowerCase()
      .replace(/^_/, '');
    
    return readable;
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    const finalMappings: OllamaVariableMapping[] = [];
    
    selectedVariables.forEach(variableName => {
      const mapping = variableMappings.get(variableName);
      if (mapping) {
        finalMappings.push(mapping);
      }
    });

    onConfirm(finalMappings);
  }, [selectedVariables, variableMappings, onConfirm]);

  // Copy variable syntax to clipboard
  const copyVariableSyntax = useCallback((variableName: string) => {
    navigator.clipboard.writeText(`{${variableName}}`);
  }, []);

  // Quick action: Select all for prompt
  const selectAllForPrompt = useCallback(() => {
    const newMappings = new Map(variableMappings);
    selectedVariables.forEach(variableName => {
      const mapping = newMappings.get(variableName);
      if (mapping) {
        newMappings.set(variableName, { ...mapping, useInPrompt: true });
      }
    });
    setVariableMappings(newMappings);
  }, [selectedVariables, variableMappings]);

  // Quick action: Select all for system message
  const selectAllForSystemMessage = useCallback(() => {
    const newMappings = new Map(variableMappings);
    selectedVariables.forEach(variableName => {
      const mapping = newMappings.get(variableName);
      if (mapping) {
        newMappings.set(variableName, { ...mapping, useInSystemMessage: true });
      }
    });
    setVariableMappings(newMappings);
  }, [selectedVariables, variableMappings]);

  return (
    <Modal
      title={
        <Space>
          <BulbOutlined style={{ color: '#ff6b35' }} />
          <span>Select Variables for Ollama LLM</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      width={800}
      okText="Connect Variables"
      cancelText="Cancel"
      okButtonProps={{
        disabled: selectedVariables.size === 0,
        style: { backgroundColor: '#ff6b35', borderColor: '#ff6b35' }
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Connection Info */}
        <Alert
          message={
            <Space>
              <Text strong>{sourceNodeName}</Text>
              <ArrowRightOutlined />
              <Text strong>{targetNodeName}</Text>
            </Space>
          }
          description={`Select which variables from ${sourceNodeName} you want to use in ${targetNodeName}. You can customize how they appear in prompts.`}
          type="info"
          showIcon
        />

        {/* Quick Actions */}
        <Card size="small" style={{ backgroundColor: '#f6f8fa' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Text strong style={{ fontSize: '12px' }}>Quick Actions:</Text>
                <Button size="small" onClick={selectAllForPrompt}>
                  All → Prompt
                </Button>
                <Button size="small" onClick={selectAllForSystemMessage}>
                  All → System
                </Button>
              </Space>
            </Col>
            <Col>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {selectedVariables.size} of {availableVariables.length} variables selected
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Variable List */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <List
            dataSource={availableVariables}
            renderItem={(variable) => {
              const isSelected = selectedVariables.has(variable.name);
              const mapping = variableMappings.get(variable.name);
              const isEditing = editingVariable === variable.name;

              return (
                <List.Item
                  style={{
                    backgroundColor: isSelected ? '#f6ffed' : '#fafafa',
                    border: `1px solid ${isSelected ? '#b7eb8f' : '#e8e8e8'}`,
                    borderRadius: '6px',
                    marginBottom: '8px',
                    padding: '12px'
                  }}
                >
                  <div style={{ width: '100%' }}>
                    {/* Header Row */}
                    <Row justify="space-between" align="middle" style={{ marginBottom: '8px' }}>
                      <Col>
                        <Space>
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) => handleVariableSelect(variable.name, e.target.checked)}
                          />
                          <Text strong>{variable.name}</Text>
                          <Tag color="blue" style={{ fontSize: '10px' }}>
                            {variable.type}
                          </Tag>
                        </Space>
                      </Col>
                      <Col>
                        <Space>
                          {isSelected && mapping && (
                            <Tooltip title="Copy variable syntax">
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => copyVariableSyntax(mapping.targetVariable)}
                              />
                            </Tooltip>
                          )}
                          <Button
                            size="small"
                            icon={isEditing ? <CheckOutlined /> : <EditOutlined />}
                            onClick={() => setEditingVariable(isEditing ? null : variable.name)}
                            disabled={!isSelected}
                          />
                        </Space>
                      </Col>
                    </Row>

                    {/* Description */}
                    {variable.description && (
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                        {variable.description}
                      </Text>
                    )}

                    {/* Mapping Configuration */}
                    {isSelected && mapping && (
                      <div style={{ backgroundColor: 'white', padding: '8px', borderRadius: '4px', border: '1px solid #e8e8e8' }}>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                              Variable Name in Templates:
                            </Text>
                            {isEditing ? (
                              <Input
                                size="small"
                                value={mapping.targetVariable}
                                onChange={(e) => handleMappingUpdate(variable.name, { targetVariable: e.target.value })}
                                placeholder="Enter variable name"
                              />
                            ) : (
                              <code style={{ 
                                backgroundColor: '#f6f8fa', 
                                padding: '2px 6px', 
                                borderRadius: '3px',
                                color: '#ff6b35',
                                fontWeight: 'bold'
                              }}>
                                {`{${mapping.targetVariable}}`}
                              </code>
                            )}
                          </Col>
                          <Col span={12}>
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: '11px' }}>Use in Prompt:</Text>
                                <Switch
                                  size="small"
                                  checked={mapping.useInPrompt}
                                  onChange={(checked) => handleMappingUpdate(variable.name, { useInPrompt: checked })}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: '11px' }}>Use in System Message:</Text>
                                <Switch
                                  size="small"
                                  checked={mapping.useInSystemMessage}
                                  onChange={(checked) => handleMappingUpdate(variable.name, { useInSystemMessage: checked })}
                                />
                              </div>
                            </Space>
                          </Col>
                        </Row>
                      </div>
                    )}
                  </div>
                </List.Item>
              );
            }}
          />
        </div>

        {/* Preview Section */}
        {selectedVariables.size > 0 && (
          <Card 
            size="small" 
            title="Preview - How variables will appear in Ollama LLM"
            style={{ backgroundColor: '#fff7e6' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {/* Prompt Variables */}
              <div>
                <Text strong style={{ fontSize: '12px', color: '#ff6b35' }}>
                  Variables for Prompt ({Array.from(selectedVariables).filter(v => variableMappings.get(v)?.useInPrompt).length}):
                </Text>
                <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {Array.from(selectedVariables)
                    .filter(variableName => variableMappings.get(variableName)?.useInPrompt)
                    .map(variableName => {
                      const mapping = variableMappings.get(variableName)!;
                      return (
                        <code
                          key={variableName}
                          style={{
                            backgroundColor: '#f6ffed',
                            color: '#52c41a',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            border: '1px solid #b7eb8f'
                          }}
                        >
                          {`{${mapping.targetVariable}}`}
                        </code>
                      );
                    })}
                </div>
              </div>

              {/* System Message Variables */}
              <div>
                <Text strong style={{ fontSize: '12px', color: '#722ed1' }}>
                  Variables for System Message ({Array.from(selectedVariables).filter(v => variableMappings.get(v)?.useInSystemMessage).length}):
                </Text>
                <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {Array.from(selectedVariables)
                    .filter(variableName => variableMappings.get(variableName)?.useInSystemMessage)
                    .map(variableName => {
                      const mapping = variableMappings.get(variableName)!;
                      return (
                        <code
                          key={variableName}
                          style={{
                            backgroundColor: '#f9f0ff',
                            color: '#722ed1',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            border: '1px solid #d3adf7'
                          }}
                        >
                          {`{${mapping.targetVariable}}`}
                        </code>
                      );
                    })}
                </div>
              </div>

              {/* Usage Example */}
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Text strong style={{ fontSize: '11px', color: '#666' }}>Example Usage:</Text>
                {Array.from(selectedVariables).slice(0, 2).map(variableName => {
                  const mapping = variableMappings.get(variableName)!;
                  return (
                    <div key={variableName} style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                      • Prompt: "User question: {`{${mapping.targetVariable}}`}"
                    </div>
                  );
                })}
              </div>
            </Space>
          </Card>
        )}
      </Space>
    </Modal>
  );
};

export default OllamaVariableConnectionModal;