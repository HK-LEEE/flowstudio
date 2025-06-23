import React, { useState } from 'react';
import {
  Typography,
  Button,
  Space,
  Switch,
  Tooltip,
  Tag,
  Alert
} from 'antd';
import {
  SettingOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  SaveOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useReactFlow } from '@xyflow/react';
import AdvancedConfigPanel from './AdvancedConfigPanel';
import UniversalConfigPanel from './UniversalConfigPanel';
import LegacyPromptTemplateConfig from './PromptTemplateConfig';
import OllamaService from '../../services/ollamaService';

const { Text } = Typography;

// Universal Configuration Wrapper Component
const UniversalConfigWrapper: React.FC<{
  selectedNodeId: string;
  onClose: () => void;
}> = ({ selectedNodeId, onClose }) => {
  const { getNode, setNodes, getEdges, getNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveFunction, setSaveFunction] = useState<(() => void) | null>(null);
  const [resetFunction, setResetFunction] = useState<(() => void) | null>(null);
  const [getCurrentValuesFunction, setGetCurrentValuesFunction] = useState<(() => any) | null>(null);
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load node data
  React.useEffect(() => {
    if (selectedNodeId) {
      const node = getNode(selectedNodeId);
      if (node) {
        setNodeData(node.data);
        setTemplate(node.data.template);
        setHasChanges(false);
        setShowPreview(false);
      }
    }
  }, [selectedNodeId, getNode]);

  // Sync with React Flow only for execution status changes (not input_values)
  React.useEffect(() => {
    if (selectedNodeId && nodeData) {
      const intervalId = setInterval(() => {
        const node = getNode(selectedNodeId);
        if (node && node.data) {
          // Only sync execution status, not input_values (to prevent overwriting user input)
          const hasStatusChange = node.data.execution_status !== nodeData.execution_status;
          
          if (hasStatusChange) {
            console.log('NodeConfigPanel: Syncing execution status change', {
              oldStatus: nodeData.execution_status,
              newStatus: node.data.execution_status
            });
            setNodeData((prevData: any) => ({
              ...prevData,
              execution_status: node.data.execution_status,
              execution_progress: node.data.execution_progress,
              output_data: node.data.output_data
            }));
          }
        }
      }, 1000); // Check every 1 second (less frequent)
      
      return () => clearInterval(intervalId);
    }
  }, [selectedNodeId, nodeData, getNode]);

  // Handle configuration changes (now only updates local state, no auto-save)
  const handleValuesChange = React.useCallback((values: any) => {
    console.log('NodeConfigPanel: Configuration values received from UniversalConfigPanel:', values);
    
    // Update local nodeData immediately
    setNodeData((prevData: any) => ({
      ...prevData,
      input_values: {
        ...prevData.input_values,
        ...values
      }
    }));
    
    // Update React Flow state immediately (save action)
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
    
    console.log('NodeConfigPanel: Configuration saved to React Flow state');
  }, [selectedNodeId, setNodes]);

  // Handle changes state from UniversalConfigPanel
  const handleChangesStateChange = React.useCallback((hasChanges: boolean, saveFunc: () => void, resetFunc: () => void, getCurrentValuesFunc: () => any) => {
    setHasUnsavedChanges(hasChanges);
    setSaveFunction(() => saveFunc);
    setResetFunction(() => resetFunc);
    setGetCurrentValuesFunction(() => getCurrentValuesFunc);
    console.log('NodeConfigPanel: Unsaved changes state:', hasChanges);
  }, []);

  // Save configuration
  const handleSave = React.useCallback(async () => {
    if (saveFunction) {
      saveFunction();
      console.log('NodeConfigPanel: Configuration saved via UniversalConfigPanel');
    }
  }, [saveFunction]);

  // Reset configuration  
  const handleReset = React.useCallback(() => {
    if (resetFunction) {
      resetFunction();
      console.log('NodeConfigPanel: Configuration reset via UniversalConfigPanel');
    }
  }, [resetFunction]);

  // Handle close with unsaved changes check
  const handleClose = React.useCallback(() => {
    if (hasUnsavedChanges) {
      const shouldSave = window.confirm(
        'You have unsaved changes. Do you want to save them before closing?\n\n' +
        'Click "OK" to save and close\n' +
        'Click "Cancel" to close without saving'
      );
      
      if (shouldSave && saveFunction) {
        saveFunction();
      }
    }
    onClose();
  }, [hasUnsavedChanges, saveFunction, onClose]);

  // Execute dependency nodes automatically for preview
  const executeDependencyNodes = React.useCallback(async (targetNodeId: string) => {
    const edges = getEdges();
    const nodes = getNodes();
    
    // Find all incoming edges to the target node
    const incomingEdges = edges.filter(edge => edge.target === targetNodeId);
    
    console.log('Preview: Found incoming edges for', targetNodeId, ':', incomingEdges);
    
    // Execute source nodes that haven't been executed yet
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(node => node.id === edge.source);
      if (sourceNode && sourceNode.data?.execution_status !== 'completed') {
        console.log('Preview: Auto-executing dependency node:', sourceNode.id, sourceNode.data?.template?.display_name);
        
        // Import the execution function from FlowEditorPage (we need to pass it as a prop)
        // For now, we'll call a simple execution
        await executeNodeForPreview(sourceNode.id);
      }
    }
  }, [getEdges, getNodes]);

  // Simple node execution for preview (similar to FlowEditorPage execution logic)
  const executeNodeForPreview = React.useCallback(async (nodeId: string) => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node) return;

    console.log('Preview execution: Starting execution for node:', nodeId, node.data?.template?.display_name);

    // Update node status to running
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { ...n, data: { ...n.data, execution_status: 'running', execution_progress: 0 } }
        : n
    ));

    try {
      // Simulate execution delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate output data based on node type (simplified version of FlowEditorPage logic)
      const nodeData = node.data;
      let outputData = {};
      
      // Get input data from connected nodes
      const incomingEdges = currentEdges.filter(edge => edge.target === nodeId);
      const connectedInputData: Record<string, any> = {};
      incomingEdges.forEach(edge => {
        const sourceNode = currentNodes.find(n => n.id === edge.source);
        if (sourceNode?.data?.output_data) {
          Object.assign(connectedInputData, sourceNode.data.output_data);
        }
      });
      
      const manualVars = nodeData.input_values?.manual_variables || {};
      const allVars = { ...connectedInputData, ...manualVars };
      
      switch (nodeData.template?.component_type) {
        case 'text_input':
        case 'chat_input':
          let inputValue = nodeData.input_values?.text || 
                          nodeData.input_values?.default_value || 
                          nodeData.input_values?.value || 
                          'Default input text';
          
          // Apply variable substitution
          if (typeof inputValue === 'string' && inputValue.includes('{')) {
            Object.entries(allVars).forEach(([key, value]) => {
              const regex = new RegExp(`\\\\{${key}\\\\}`, 'g');
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
              inputValue = inputValue.replace(regex, valueStr);
            });
          }
          
          outputData = {
            message: inputValue,
            text: inputValue
          };
          break;
          
        case 'prompt_template':
          const template = nodeData.input_values?.template || 'Hello {message}!';
          let renderedPrompt = template;
          Object.entries(allVars).forEach(([key, value]) => {
            const regex = new RegExp(`\\\\{${key}\\\\}`, 'g');
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            renderedPrompt = renderedPrompt.replace(regex, valueStr);
          });
          
          outputData = {
            prompt: renderedPrompt,
            template_used: template,
            variables_applied: allVars
          };
          break;
          
        default:
          outputData = {
            result: 'Executed ' + (nodeData.template?.display_name || 'component'),
            status: 'success'
          };
      }

      // Update node status to completed
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                execution_status: 'completed', 
                execution_progress: 100,
                output_data: outputData
              } 
            }
          : n
      ));

      console.log('Preview execution: Node', nodeId, 'completed with output:', outputData);
    } catch (error) {
      console.error('Preview execution error for node', nodeId, ':', error);
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, execution_status: 'failed', error_message: String(error) } }
          : n
      ));
    }
  }, [getNodes, getEdges, setNodes]);

  // Generate preview
  const handlePreview = React.useCallback(async () => {
    if (!nodeData || !template) {
      console.error('Preview failed: Missing nodeData or template', { nodeData, template });
      return;
    }

    try {
      setIsLoadingPreview(true);
      
      console.log('Preview: Starting dependency execution for node:', selectedNodeId);
      
      // Execute dependency nodes first
      await executeDependencyNodes(selectedNodeId);
      
      // Wait a bit for all executions to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get current form values (including unsaved changes) for preview
      let previewInputValues = nodeData.input_values || {};
      if (getCurrentValuesFunction) {
        const currentValues = getCurrentValuesFunction();
        previewInputValues = currentValues;
        console.log('Using current form values for preview:', currentValues);
      } else {
        console.log('Using saved node values for preview:', previewInputValues);
      }
      
      console.log('Starting preview generation for:', {
        component_type: template.component_type,
        input_values: previewInputValues,
        selectedNodeId
      });
      
      // Simulate preview execution with current values
      const simulatedOutput = await simulateNodeExecution(template, previewInputValues);
      
      console.log('Preview generated successfully:', simulatedOutput);
      setPreviewData(simulatedOutput);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        nodeData,
        template
      });
      setPreviewData({ 
        error: `Failed to generate preview: ${error instanceof Error ? error.message : String(error)}` 
      });
      setShowPreview(true);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [nodeData, template, selectedNodeId, getEdges, getNodes, getCurrentValuesFunction, executeDependencyNodes]);

  // Simulate node execution for preview with variable substitution
  const simulateNodeExecution = async (template: any, inputValues: any) => {
    console.log('simulateNodeExecution called with:', { template, inputValues });
    
    try {
      // Get real input data from connected nodes
      const edges = getEdges();
      const nodes = getNodes();
      const realInputData: Record<string, any> = {};

      console.log('Available edges and nodes:', { edges: edges.length, nodes: nodes.length });

      // Collect data from connected nodes
      const incomingEdges = edges.filter(edge => edge.target === selectedNodeId);
      console.log('Incoming edges for', selectedNodeId, ':', incomingEdges);
      
      incomingEdges.forEach(edge => {
        const sourceNode = nodes.find(node => node.id === edge.source);
        if (sourceNode?.data?.output_data && sourceNode.data.execution_status === 'completed') {
          Object.assign(realInputData, sourceNode.data.output_data);
        }
      });

      // Combine connected data with manual variables
      const manualVars = inputValues.manual_variables || {};
      const allVars = { ...realInputData, ...manualVars };
      
      console.log('Variables for preview:', { realInputData, manualVars, allVars });

      // Function to apply variable substitution
      const applyVariableSubstitution = (text: string): string => {
        if (typeof text !== 'string' || !text.includes('{')) return text;
        
        let result = text;
        Object.entries(allVars).forEach(([key, value]) => {
          const regex = new RegExp(`\\{${key}\\}`, 'g');
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          result = result.replace(regex, valueStr);
        });
        return result;
      };

      // Enhanced simulation based on component type
      switch (template.component_type) {
        case 'text_input':
          try {
            // Try multiple possible field names for text input components
            const possibleTextFields = [
              'text', 'text_value', 'default_value', 'value', 'input_text', 'message', 'content'
            ];
            
            let textInputValue = 'Sample text input';
            for (const fieldName of possibleTextFields) {
              if (inputValues[fieldName] !== undefined && inputValues[fieldName] !== '') {
                textInputValue = String(inputValues[fieldName]);
                break;
              }
            }
            
            console.log('Text Input Preview - Available input values:', inputValues);
            console.log('Text Input Preview - Using value:', textInputValue);
            
            const textValue = applyVariableSubstitution(textInputValue);
            return {
              type: template.component_type,
              output: {
                text: textValue,
                message: textValue
              },
              variable_info: {
                variables_used: Object.keys(allVars),
                real_data_available: Object.keys(realInputData),
                manual_variables: Object.keys(manualVars)
              },
              timestamp: new Date().toISOString()
            };
          } catch (textInputError) {
            console.error('Error in text input preview:', textInputError);
            return {
              type: template.component_type,
              output: {
                text: 'Preview error: ' + String(textInputError),
                message: 'Preview error: ' + String(textInputError)
              },
              variable_info: {
                variables_used: Object.keys(allVars),
                real_data_available: Object.keys(realInputData),
                manual_variables: Object.keys(manualVars)
              },
              timestamp: new Date().toISOString()
            };
          }

        case 'chat_input':
          try {
            console.log('🔍 Chat Input Preview - Available input values:', inputValues);
            
            // Chat Input specific field names priority
            const chatInputFields = [
              'test_message', 'auto_message', 'message', 'text', 'user_input', 'content'
            ];
            
            let chatMessage = '기본 채팅 메시지';
            for (const fieldName of chatInputFields) {
              if (inputValues[fieldName] !== undefined && inputValues[fieldName] !== '') {
                chatMessage = String(inputValues[fieldName]);
                console.log(`📋 Chat Input Preview - Found ${fieldName}:`, chatMessage);
                break;
              }
            }
            
            console.log('✅ Chat Input Preview - Final message:', chatMessage);
            
            const finalMessage = applyVariableSubstitution(chatMessage);
            return {
              type: 'chat_input',
              output: {
                message: finalMessage,
                text: finalMessage, // For compatibility
                session_id: `session-${Date.now()}`,
                user_id: 'preview-user',
                timestamp: new Date().toISOString()
              },
              variable_info: {
                variables_used: Object.keys(allVars),
                real_data_available: Object.keys(realInputData),
                manual_variables: Object.keys(manualVars),
                field_search_result: {
                  searched_fields: chatInputFields,
                  found_field: chatInputFields.find(f => inputValues[f] !== undefined && inputValues[f] !== ''),
                  final_value: chatMessage
                }
              },
              timestamp: new Date().toISOString()
            };
          } catch (chatInputError) {
            console.error('Error in chat input preview:', chatInputError);
            return {
              type: 'chat_input',
              output: {
                message: 'Preview error: ' + String(chatInputError),
                text: 'Preview error: ' + String(chatInputError)
              },
              variable_info: {
                variables_used: Object.keys(allVars),
                real_data_available: Object.keys(realInputData),
                manual_variables: Object.keys(manualVars)
              },
              timestamp: new Date().toISOString()
            };
          }
          
        case 'ollama_llm':
          try {
            // Apply variable mappings if they exist
            const variableMappings = inputValues.variable_mappings || [];
            const manualVariables = inputValues.manual_variables || {};
            
            // Start with manual variables
            let allVariables = { ...manualVariables };
            
            // Apply variable mappings from connected nodes
            variableMappings.forEach((mapping: any) => {
              const inputField = mapping.input_field;
              const variableName = mapping.variable_name;
              const defaultValue = mapping.default_value || '';
              
              if (realInputData[inputField] !== undefined) {
                allVariables[variableName] = realInputData[inputField];
              } else if (defaultValue) {
                allVariables[variableName] = defaultValue;
              }
            });
            
            // Apply template variable substitution
            const applyOllamaVariableSubstitution = (text: string): string => {
              if (typeof text !== 'string' || !text.includes('{')) return text;
              
              let result = text;
              Object.entries(allVariables).forEach(([key, value]) => {
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                result = result.replace(regex, valueStr);
              });
              return result;
            };
            
            const promptValue = applyOllamaVariableSubstitution(
              inputValues.prompt || realInputData.prompt || realInputData.text || 'Hello, how can I help you?'
            );
            
            const systemMessage = inputValues.system_message ? 
              applyOllamaVariableSubstitution(inputValues.system_message) : 
              undefined;
            
            // Ollama configuration
            const baseUrl = inputValues.ollama_base_url || 'http://localhost:11434';
            const model = inputValues.model || 'llama2';
            const temperature = inputValues.temperature || 0.7;
            const topP = inputValues.top_p || 0.9;
            const topK = inputValues.top_k || 40;
            const numPredict = inputValues.num_predict || 1000;
            const repeatPenalty = inputValues.repeat_penalty || 1.1;
            
            console.log('Generating Ollama response with:', {
              model,
              prompt: promptValue,
              system: systemMessage,
              baseUrl,
              variableMappings: variableMappings.length,
              allVariables
            });
            
            // Generate actual Ollama response
            const startTime = Date.now();
            
            try {
              const response = await fetch('/api/ollama/generate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                  base_url: baseUrl,
                  model,
                  prompt: promptValue,
                  system_message: systemMessage,
                  temperature,
                  top_p: topP,
                  top_k: topK,
                  num_predict: numPredict,
                  repeat_penalty: repeatPenalty,
                  stream: false
                })
              });
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Ollama API error: ${response.status} - ${errorData.detail || response.statusText}`);
              }
              
              const ollamaResponse = await response.json();
              const endTime = Date.now();
            
              return {
                type: 'ollama_llm',
                output: {
                  response: ollamaResponse.response,
                  model_used: ollamaResponse.model,
                  base_url: baseUrl,
                  prompt_used: promptValue,
                  system_message_used: systemMessage,
                  generation_time_ms: endTime - startTime,
                  variables_applied: allVariables,
                  token_usage: {
                    prompt_tokens: ollamaResponse.prompt_eval_count || 0,
                    completion_tokens: ollamaResponse.eval_count || 0,
                    total_tokens: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0)
                  },
                  performance: {
                    total_duration: ollamaResponse.total_duration,
                    load_duration: ollamaResponse.load_duration,
                    prompt_eval_duration: ollamaResponse.prompt_eval_duration,
                    eval_duration: ollamaResponse.eval_duration
                  }
                },
                variable_info: {
                  variables_used: Object.keys(allVariables),
                  real_data_available: Object.keys(realInputData),
                  manual_variables: Object.keys(manualVariables),
                  variable_mappings: variableMappings,
                  template_applied: {
                    original_prompt: inputValues.prompt || '',
                    final_prompt: promptValue,
                    original_system: inputValues.system_message || '',
                    final_system: systemMessage || ''
                  }
                },
                timestamp: new Date().toISOString()
              };
            } catch (apiError) {
              const endTime = Date.now();
              console.warn('Ollama API failed, using fallback response:', apiError);
              
              return {
                type: 'ollama_llm',
                output: {
                  response: `[PREVIEW] Based on prompt: "${promptValue.substring(0, 100)}${promptValue.length > 100 ? '...' : ''}" - Ollama response would appear here. (API connection failed)`,
                  model_used: model,
                  base_url: baseUrl,
                  prompt_used: promptValue,
                  system_message_used: systemMessage,
                  generation_time_ms: endTime - startTime,
                  variables_applied: allVariables,
                  error: `API Error: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
                  fallback_mode: true
                },
                variable_info: {
                  variables_used: Object.keys(allVariables),
                  real_data_available: Object.keys(realInputData),
                  manual_variables: Object.keys(manualVariables),
                  variable_mappings: variableMappings,
                  template_applied: {
                    original_prompt: inputValues.prompt || '',
                    final_prompt: promptValue,
                    original_system: inputValues.system_message || '',
                    final_system: systemMessage || ''
                  }
                },
                timestamp: new Date().toISOString()
              };
            }
          } catch (error) {
            console.error('Ollama generation error:', error);
            return {
              type: 'ollama_llm',
              output: {
                error: `Ollama generation failed: ${error instanceof Error ? error.message : String(error)}`,
                model_used: inputValues.model || 'unknown',
                base_url: inputValues.ollama_base_url || 'http://localhost:11434'
              },
              variable_info: {
                variables_used: Object.keys(allVars),
                real_data_available: Object.keys(realInputData),
                manual_variables: Object.keys(manualVars)
              },
              timestamp: new Date().toISOString()
            };
          }

        case 'openai_llm':
        case 'claude_llm':
          const promptValue = applyVariableSubstitution(
            inputValues.prompt || inputValues.input || realInputData.prompt || realInputData.text || 'Default prompt'
          );
          return {
            type: template.component_type,
            output: {
              response: `This is a simulated AI response to: "${promptValue.substring(0, 100)}${promptValue.length > 100 ? '...' : ''}"`,
              model_used: inputValues.model || 'default-model',
              token_usage: { prompt_tokens: 25, completion_tokens: 15, total_tokens: 40 },
              input_prompt: promptValue
            },
            variable_info: {
              variables_used: Object.keys(allVars),
              real_data_available: Object.keys(realInputData),
              manual_variables: Object.keys(manualVars)
            },
            timestamp: new Date().toISOString()
            };
          
        case 'prompt_template':
          const templateText = inputValues.template || 'Hello {input_text}!';
          const renderedPrompt = applyVariableSubstitution(templateText);
          
          return {
            type: 'prompt_template',
            output: {
              prompt: renderedPrompt,
              template_used: templateText,
              variables_applied: allVars,
              real_input_data_received: realInputData,
              manual_variables_used: manualVars
            },
            variable_info: {
              variables_used: Object.keys(allVars),
              real_data_available: Object.keys(realInputData),
              manual_variables: Object.keys(manualVars)
            },
            timestamp: new Date().toISOString()
            };
          
        default:
          // Apply variable substitution to all string fields
          const processedConfig: Record<string, any> = {};
          Object.entries(inputValues).forEach(([key, value]) => {
            if (key === 'manual_variables') {
              processedConfig[key] = value; // Don't process manual variables themselves
            } else if (typeof value === 'string') {
              processedConfig[key] = applyVariableSubstitution(value);
            } else {
              processedConfig[key] = value;
            }
          });
          
          return {
            type: template.component_type,
            output: {
              result: 'Simulated output for ' + template.display_name,
              status: 'success',
              processed_config: processedConfig,
              applied_variables: allVars
            },
            variable_info: {
              variables_used: Object.keys(allVars),
              real_data_available: Object.keys(realInputData),
              manual_variables: Object.keys(manualVars)
            },
            timestamp: new Date().toISOString()
          };
      }
    } catch (error) {
      console.error('Error in simulateNodeExecution:', error);
      console.error('Template:', template);
      console.error('Input Values:', inputValues);
      console.error('All Variables:', allVars);
      throw new Error(`Preview generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (!nodeData || !template) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <InfoCircleOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
        <Text type="secondary">Loading node configuration...</Text>
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
            <Text strong>Universal Node Configuration</Text>
            <Tag color={template.color} size="small">{template.component_type}</Tag>
          </Space>
          <Button type="text" size="small" onClick={handleClose}>
            ×
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <UniversalConfigPanel
          nodeId={selectedNodeId}
          template={template}
          initialValues={{
            input_values: nodeData.input_values || {},
            config_data: nodeData.config_data || {},
            display_name: nodeData.display_name || template.display_name
          }}
          onValuesChange={handleValuesChange}
          onChangesStateChange={handleChangesStateChange}
        />
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div style={{ 
          padding: '16px', 
          borderTop: '1px solid #e8e8e8',
          background: '#f9f9f9'
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
              disabled={!hasUnsavedChanges}
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
            disabled={!hasUnsavedChanges}
          >
            Save Changes
          </Button>
        </Space>
      </div>

      {/* Unsaved Changes Alert */}
      {hasUnsavedChanges && (
        <Alert
          message="You have unsaved changes"
          description="Click 'Save Changes' to save your configuration, or 'Reset' to discard changes."
          type="warning"
          showIcon
          style={{ margin: '16px', marginTop: 0 }}
        />
      )}
    </div>
  );
};

interface NodeConfigPanelProps {
  selectedNodeId: string | null;
  onClose: () => void;
}

/**
 * Unified Node Configuration Panel
 * Now uses the Advanced Configuration System for all component types
 */
const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  selectedNodeId,
  onClose,
}) => {
  const [useAdvancedMode, setUseAdvancedMode] = useState(true);
  const [showModeToggle, setShowModeToggle] = useState(false);

  // Check if the selected node is a prompt template (for legacy mode option)
  const isPromptTemplate = selectedNodeId ? (() => {
    const { getNode } = useReactFlow();
    const node = getNode(selectedNodeId);
    return node?.data?.template?.component_type === 'prompt_template';
  })() : false;

  if (!selectedNodeId) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <InfoCircleOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
        <Text type="secondary">Select a node to configure its properties</Text>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with mode toggle for debugging/development */}
      {showModeToggle && isPromptTemplate && (
        <div style={{ 
          padding: '8px 16px', 
          borderBottom: '1px solid #e8e8e8',
          background: '#f0f2f5'
        }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <ExperimentOutlined style={{ color: '#1890ff' }} />
              <Text style={{ fontSize: '12px' }}>Configuration Mode:</Text>
            </Space>
            <Space>
              <Tooltip title="Switch between new unified system and legacy prompt template config">
                <Switch
                  size="small"
                  checked={useAdvancedMode}
                  onChange={setUseAdvancedMode}
                  checkedChildren={<ThunderboltOutlined />}
                  unCheckedChildren="Legacy"
                />
              </Tooltip>
              <Text style={{ fontSize: '11px', color: '#666' }}>
                {useAdvancedMode ? 'Advanced' : 'Legacy'}
              </Text>
            </Space>
          </Space>
        </div>
      )}

      {/* Render appropriate configuration panel */}
      {useAdvancedMode ? (
        <UniversalConfigWrapper
          selectedNodeId={selectedNodeId}
          onClose={onClose}
        />
      ) : (
        // Legacy mode - only available for prompt templates during development
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid #e8e8e8',
            background: '#fafafa'
          }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space align="center">
                <SettingOutlined style={{ color: '#fa8c16' }} />
                <Text strong>Legacy Prompt Template Configuration</Text>
              </Space>
              <Button type="text" size="small" onClick={onClose}>
                ×
              </Button>
            </Space>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <LegacyPromptTemplateConfig
              nodeId={selectedNodeId}
              initialValues={{}}
              onValuesChange={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeConfigPanel;