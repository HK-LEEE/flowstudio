/**
 * Advanced Configuration Panel
 * Universal component configuration interface that works with any component type
 * Uses the Prompt Template pattern for all components
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Typography,
  Input,
  Button,
  Space,
  Alert,
  Tag,
  Tooltip,
  Form
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
  EyeOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useReactFlow } from '@xyflow/react';
import { usePromptTemplateInputs } from '../../hooks/useNodeConnections';
import ConfigurationSectionRenderer from './ConfigurationSectionRenderer';
import { substituteVariables, extractVariables } from '../../utils/variableExtractor';

const { Title, Text } = Typography;

interface AdvancedConfigPanelProps {
  selectedNodeId: string | null;
  onClose: () => void;
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
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  version: string;
  documentation: string | null;
  examples: Record<string, any> | null;
}

const AdvancedConfigPanel: React.FC<AdvancedConfigPanelProps> = ({
  selectedNodeId,
  onClose,
}) => {
  const { getNode, setNodes, getEdges, getNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<any>(null);
  const [template, setTemplate] = useState<ComponentTemplate | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState<string>('');
  const [lastLoadedNodeId, setLastLoadedNodeId] = useState<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get input connections
  const { availableInputFields, inputFields, hasConnections } = usePromptTemplateInputs(selectedNodeId || '');

  // Function to get real data from connected nodes
  const getRealInputData = useCallback(() => {
    if (!selectedNodeId) return {};

    const edges = getEdges();
    const nodes = getNodes();
    const realInputData: Record<string, any> = {};

    const incomingEdges = edges.filter(edge => edge.target === selectedNodeId);

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
  }, [selectedNodeId, getEdges, getNodes]);

  // Load node data when selected node changes
  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== lastLoadedNodeId) {
      const node = getNode(selectedNodeId);
      if (node) {
        console.log('Loading node data for:', selectedNodeId);
        setNodeData(node.data);
        setTemplate(node.data.template);
        setLocalDisplayName(node.data.display_name || node.data.template?.display_name || '');
        setHasChanges(false);
        setShowPreview(false);
        setLastLoadedNodeId(selectedNodeId);
        
        console.log('Loaded node data:', {
          id: selectedNodeId,
          type: node.data.template?.component_type,
          input_values: node.data.input_values,
          config_data: node.data.config_data
        });
      }
    }
  }, [selectedNodeId, getNode, lastLoadedNodeId]);

  // Auto-save functionality
  useEffect(() => {
    if (hasChanges && selectedNodeId) {
      const autoSaveTimeout = setTimeout(() => {
        console.log('Auto-saving after changes');
        handleSave();
      }, 2000);

      return () => clearTimeout(autoSaveTimeout);
    }
  }, [hasChanges, selectedNodeId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleValuesChange = useCallback((values: Record<string, any>) => {
    console.log('Values changed:', values);
    setHasChanges(true);
    
    // Update local nodeData immediately
    setNodeData(prevData => ({
      ...prevData,
      input_values: {
        ...prevData.input_values,
        ...values
      }
    }));
    
    // Debounce updates to React Flow state
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      console.log('Updating React Flow nodes with values:', values);
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  input_values: {
                    ...node.data.input_values,
                    ...values
                  }
                }
              }
            : node
        )
      );
    }, 100);
  }, [selectedNodeId, setNodes]);

  const handleDisplayNameChange = useCallback((newDisplayName: string) => {
    setLocalDisplayName(newDisplayName);
    setHasChanges(true);
    
    // Update local nodeData immediately
    setNodeData(prevData => ({
      ...prevData,
      display_name: newDisplayName
    }));
    
    // Debounce updates to React Flow state
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  display_name: newDisplayName
                }
              }
            : node
        )
      );
    }, 300);
  }, [selectedNodeId, setNodes]);

  const handleSave = useCallback(async () => {
    try {
      if (!selectedNodeId || !nodeData || !template) return;

      const display_name = nodeData.display_name || template.display_name;
      const input_values = { ...nodeData.input_values };
      const config_data = { ...nodeData.config_data };

      // Update node data
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  display_name,
                  input_values,
                  config_data,
                },
              }
            : node
        )
      );

      // Update local nodeData to reflect the save
      setNodeData(prev => ({
        ...prev,
        display_name,
        input_values,
        config_data
      }));

      setHasChanges(false);
      console.log('Node configuration saved successfully:', { display_name, input_values, config_data });
    } catch (error) {
      console.error('Error saving node configuration:', error);
    }
  }, [selectedNodeId, nodeData, template, setNodes]);

  const handleReset = () => {
    if (nodeData && template) {
      const node = getNode(selectedNodeId!);
      if (node) {
        setNodeData(node.data);
        setLocalDisplayName(node.data.display_name || node.data.template?.display_name || '');
        setHasChanges(false);
      }
    }
  };

  const handlePreview = async () => {
    if (!selectedNodeId || !nodeData || !template) return;

    try {
      setIsLoadingPreview(true);
      
      const values = nodeData.input_values || {};
      console.log('Preview values for', template.component_type, ':', values);
      
      const simulatedOutput = await simulateNodeExecution(template, values);
      
      setPreviewData(simulatedOutput);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      setPreviewData({ error: 'Failed to generate preview' });
      setShowPreview(true);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const simulateNodeExecution = async (template: ComponentTemplate, inputValues: any) => {
    console.log('Simulating execution for:', template.component_type);
    console.log('Input values:', inputValues);

    const realInputData = getRealInputData();
    console.log('Real input data:', realInputData);

    // Enhanced simulation for different component types
    switch (template.component_type) {
      case 'prompt_template':
      case 'prompt.basic':
        return simulatePromptTemplate(inputValues, realInputData);
      
      case 'text_input':
      case 'input.text':
        return simulateTextInput(inputValues);
      
      case 'chat_input':
      case 'input.chat':
        return simulateChatInput(inputValues);
      
      case 'azure_openai':
      case 'llm.azure_openai':
      case 'openai_llm':
      case 'claude_llm':
        return simulateLLMComponent(inputValues, template.component_type);
      
      case 'variable_mapper':
        return simulateVariableMapper(inputValues, realInputData);
      
      case 'response_formatter':
        return simulateResponseFormatter(inputValues);
      
      default:
        return {
          type: template.component_type,
          output: {
            result: `Simulated output for ${template.display_name}`,
            status: 'success',
            input_values: inputValues,
            connected_data: realInputData
          },
          timestamp: new Date().toISOString()
        };
    }
  };

  const simulatePromptTemplate = (inputValues: any, realInputData: any) => {
    const templateText = inputValues.template || 'No template defined';
    const manualVariables = inputValues.manual_variables || {};
    
    // Combine real data with manual variables
    const allVariables = { ...realInputData, ...manualVariables };
    
    // Use the variable substitution utility
    const result = substituteVariables({
      template: templateText,
      variables: allVariables
    });

    return {
      type: 'prompt_template',
      output: {
        prompt: result.result,
        template_used: templateText,
        variables_applied: result.appliedVariables,
        unmapped_variables: result.unmappedVariables,
        substitution_log: result.substitutionLog,
        real_input_data: realInputData,
        manual_variables: manualVariables
      },
      timestamp: new Date().toISOString()
    };
  };

  const simulateTextInput = (inputValues: any) => {
    const textValue = inputValues.text_value || 
                     inputValues.text || 
                     inputValues.value || 
                     'Default text';
    
    return {
      type: 'text_input',
      output: {
        text: textValue,
        message: textValue
      },
      timestamp: new Date().toISOString()
    };
  };

  const simulateChatInput = (inputValues: any) => {
    return {
      type: 'chat_input',
      output: {
        message: inputValues.message || 'Hello, how can I help you?',
        session_id: inputValues.session_id || 'default_session',
        user_id: inputValues.user_id || 'anonymous',
        context: inputValues.context || {},
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  };

  const simulateLLMComponent = (inputValues: any, componentType: string) => {
    return {
      type: componentType,
      output: {
        response: `This is a simulated response from ${componentType}. Your prompt: "${inputValues.prompt || 'No prompt provided'}"`,
        model_used: inputValues.model || inputValues.deployment_name || 'default-model',
        token_usage: { 
          prompt_tokens: 25, 
          completion_tokens: 35, 
          total_tokens: 60 
        }
      },
      timestamp: new Date().toISOString()
    };
  };

  const simulateVariableMapper = (inputValues: any, realInputData: any) => {
    const mappings = inputValues.variable_mappings || [];
    const variables: Record<string, any> = {};
    const mappingResults: any[] = [];

    mappings.forEach((mapping: any) => {
      let value = realInputData[mapping.source_field] || mapping.default_value || '';
      let wasTransformed = false;

      // Apply transformation
      if (mapping.transform && mapping.transform !== 'none') {
        const originalValue = value;
        switch (mapping.transform) {
          case 'uppercase':
            value = String(value).toUpperCase();
            wasTransformed = true;
            break;
          case 'lowercase':
            value = String(value).toLowerCase();
            wasTransformed = true;
            break;
          case 'title_case':
            value = String(value).replace(/\w\S*/g, (txt) => 
              txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            );
            wasTransformed = true;
            break;
          case 'trim':
            value = String(value).trim();
            wasTransformed = wasTransformed || originalValue !== value;
            break;
        }
      }

      variables[mapping.target_variable] = value;
      mappingResults.push({
        source_field: mapping.source_field,
        target_variable: mapping.target_variable,
        value,
        was_transformed: wasTransformed,
        used_default: !realInputData[mapping.source_field]
      });
    });

    return {
      type: 'variable_mapper',
      output: {
        variables,
        mapping_results: mappingResults,
        total_variables: Object.keys(variables).length
      },
      timestamp: new Date().toISOString()
    };
  };

  const simulateResponseFormatter = (inputValues: any) => {
    const content = inputValues.content || 'No content provided';
    const template = inputValues.template || '{content}';
    const variables = inputValues.variables || {};
    
    // Simple template substitution
    let formattedContent = template.replace(/\{content\}/g, content);
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      formattedContent = formattedContent.replace(regex, String(value));
    });

    return {
      type: 'response_formatter',
      output: {
        formatted_content: formattedContent,
        format_type: inputValues.format_type || 'text',
        template_used: template,
        variables_applied: variables
      },
      timestamp: new Date().toISOString()
    };
  };

  if (!selectedNodeId || !nodeData || !template) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <InfoCircleOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
        <Text type="secondary">Select a node to configure its properties</Text>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa'
      }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space align="center">
            <SettingOutlined style={{ color: template.color }} />
            <Title level={5} style={{ margin: 0 }}>
              Advanced Configuration
            </Title>
          </Space>
          <Button type="text" size="small" onClick={onClose}>
            ×
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Basic Info */}
        <Card size="small" style={{ margin: '16px', marginBottom: '16px' }}>
          <Space align="center" style={{ marginBottom: '12px' }}>
            <span style={{ color: template.color, fontSize: '16px' }}>
              {template.icon}
            </span>
            <Text strong>{template.display_name}</Text>
            <Tag color={template.color}>{template.category}</Tag>
            {hasConnections && (
              <Tag color="blue">
                {availableInputFields.length} connection{availableInputFields.length !== 1 ? 's' : ''}
              </Tag>
            )}
          </Space>
          
          <Text style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '12px' }}>
            {template.description}
          </Text>

          <Input 
            placeholder="Enter display name" 
            value={localDisplayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
          />
        </Card>

        {/* Configuration Sections */}
        <ConfigurationSectionRenderer
          nodeId={selectedNodeId}
          template={template}
          initialValues={{
            ...nodeData.input_values,
            ...nodeData.config_data
          }}
          availableInputFields={availableInputFields}
          inputFields={inputFields}
          onValuesChange={handleValuesChange}
        />

        {/* Changes Alert */}
        {hasChanges && (
          <Alert
            message="You have unsaved changes"
            type="warning"
            showIcon
            style={{ margin: '16px' }}
          />
        )}
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div style={{ 
          padding: '16px', 
          borderTop: '1px solid #e8e8e8',
          background: '#f9f9f9',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <Text strong style={{ fontSize: '14px' }}>
              <EyeOutlined style={{ marginRight: '8px' }} />
              Preview Output
            </Text>
            <Button 
              size="small" 
              onClick={() => setShowPreview(false)}
            >
              ×
            </Button>
          </div>
          
          {previewData?.error ? (
            <Alert
              message="Preview Error"
              description={previewData.error}
              type="error"
              size="small"
            />
          ) : previewData ? (
            <div style={{ 
              background: '#fff', 
              border: '1px solid #e8e8e8', 
              borderRadius: '6px', 
              padding: '12px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              <Text style={{ fontSize: '11px', color: '#888', marginBottom: '8px', display: 'block' }}>
                Generated at: {new Date(previewData.timestamp).toLocaleTimeString()}
              </Text>
              <pre style={{ 
                margin: 0, 
                fontSize: '12px', 
                fontFamily: 'Monaco, monospace',
                whiteSpace: 'pre-wrap'
              }}>
                {JSON.stringify(previewData.output, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        padding: '16px', 
        borderTop: '1px solid #e8e8e8',
        background: '#fafafa'
      }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleReset}
              disabled={!hasChanges}
            >
              Reset
            </Button>
            
            <Button 
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={isLoadingPreview}
              style={{ color: '#1890ff', borderColor: '#1890ff' }}
            >
              Preview
            </Button>
          </Space>
          
          <Button 
            type="primary" 
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default AdvancedConfigPanel;