import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Spin, message, Typography } from 'antd';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  ReactFlowProvider,
  NodeTypes,
  EdgeTypes,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import LangflowStyleLibrary from '../components/FlowEditor/LangflowStyleLibrary';
import LangflowStyleNode from '../components/FlowEditor/LangflowStyleNode';
import FS_CustomEdge from '../components/FlowEditor/FS_CustomEdge';
import FlowToolbar from '../components/FlowEditor/FlowToolbar';
import NodeConfigPanel from '../components/FlowEditor/NodeConfigPanel';
import ExecutionPanel from '../components/FlowEditor/ExecutionPanel';
import VariableConnectionModal, { VariableMapping } from '../components/FlowEditor/VariableConnectionModal';
import OllamaVariableConnectionModal, { OllamaVariableMapping } from '../components/FlowEditor/OllamaVariableConnectionModal';
import { apiService } from '../services/api';
import { useAuth } from '../store/authStore';
import { FlowValidator, ValidationResult } from '../utils/flowValidator';

const { Sider, Content } = Layout;
const { Title } = Typography;

// Component template interface
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
  is_active: boolean;
  is_beta: boolean;
  sort_order: number;
  documentation: string | null;
  examples: Record<string, any> | null;
}

// Flow data interface
interface FlowData {
  id: string;
  name: string;
  description: string | null;
  flow_data: any;
  components: any[];
  connections: any[];
  version: string;
  is_public: boolean;
  is_active: boolean;
  owner_id: string;
}

// Define edge types outside component - static object
const edgeTypes: EdgeTypes = {
  customEdge: FS_CustomEdge,
};

// Inner component that has access to useReactFlow
const FlowEditorContent: React.FC = () => {
  const { } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const { getNodes, getEdges } = useReactFlow();
  const [componentTemplates, setComponentTemplates] = useState<ComponentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlowName, setSelectedFlowName] = useState<string>('Untitled Flow');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [, setExecutingNodes] = useState<Set<string>>(new Set());
  
  // Variable connection modal state
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [showOllamaVariableModal, setShowOllamaVariableModal] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [sourceNodeVariables, setSourceNodeVariables] = useState<{ name: string; type: string; description?: string; }[]>([]);

  // Node configuration handler
  const handleNodeConfig = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setShowConfigPanel(true);
  }, []);

  // Node execution handler
  const handleNodeExecute = useCallback(async (nodeId: string) => {
    console.log('Starting execution for node:', nodeId);
    
    // Get current nodes from React Flow state
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    console.log('Available nodes:', currentNodes.map(n => ({ id: n.id, type: n.data?.template?.component_type })));
    
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node) {
      console.error('Node not found:', nodeId);
      console.error('Looking for:', nodeId);
      console.error('Available node IDs:', currentNodes.map(n => n.id));
      
      // Force refresh nodes state to get latest
      message.warning('Node not found, please try again');
      return;
    }

    console.log('Found node:', node.data?.template?.display_name);

    try {
      setExecutingNodes(prev => new Set(prev).add(nodeId));
      
      // Update node status to running
      console.log('Setting node status to running');
      setNodes((nds: any) => nds.map((n: any) => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, execution_status: 'running', execution_progress: 0 } }
          : n
      ));

      // Execute node and generate output data
      console.log('Starting execution simulation...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced to 1 second
      console.log('Execution simulation completed');
      
      // Generate output data based on node type
      const nodeData = node.data;
      console.log('Generating output data for node type:', nodeData.template?.component_type);
      let outputData = {};
      
      // Get input data from connected nodes (common for all node types)
      const incomingEdges = currentEdges.filter(edge => edge.target === nodeId);
      const connectedInputData: Record<string, any> = {};
      incomingEdges.forEach(edge => {
        const sourceNode = currentNodes.find(n => n.id === edge.source);
        if (sourceNode?.data?.output_data) {
          const outputData = sourceNode.data.output_data;
          
          // Handle nested output structure (e.g., Chat Input with output.message)
          if (outputData.output && typeof outputData.output === 'object') {
            Object.assign(connectedInputData, outputData.output);
          }
          
          // Also include direct properties for backward compatibility
          Object.assign(connectedInputData, outputData);
        }
      });
      console.log('🔗 Connected input data for', nodeId, ':', connectedInputData);
      
      // Get manual variables (common for all node types)
      const manualVars = nodeData.input_values?.manual_variables || {};
      const allVars = { ...connectedInputData, ...manualVars };
      console.log('All variables for', nodeId, ':', allVars);
      
      switch (nodeData.template?.component_type) {
        case 'text_input':
          console.log('Processing text input node');
          console.log('Node input_values:', nodeData.input_values);
          
          // Get the base input value
          let textInputValue = nodeData.input_values?.text || 
                              nodeData.input_values?.default_value || 
                              nodeData.input_values?.value || 
                              nodeData.input_values?.input ||
                              nodeData.config_data?.text ||
                              nodeData.config_data?.default_value ||
                              'Default input text';
          
          // Apply variable substitution if the input contains variables
          if (typeof textInputValue === 'string' && textInputValue.includes('{')) {
            // Simple variable substitution
            Object.entries(allVars).forEach(([key, value]) => {
              const regex = new RegExp(`\\{${key}\\}`, 'g');
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
              textInputValue = textInputValue.replace(regex, valueStr);
            });
            
            console.log('Applied variable substitution:', { original: nodeData.input_values?.text, substituted: textInputValue, variables: allVars });
          }
          
          console.log('Final text input value:', textInputValue);
          
          // Text Input output format (matches Text Input template structure)
          outputData = {
            output: {
              text: textInputValue,
              length: textInputValue.length,
              word_count: textInputValue.split(/\s+/).filter(word => word.length > 0).length
            }
          };
          console.log('Text input output data:', outputData);
          break;

        case 'chat_input':
          console.log('🔍 Processing chat input node');
          console.log('📊 Node data:', nodeData);
          console.log('📋 Node input_values:', nodeData.input_values);
          console.log('⚙️ Node config_data:', nodeData.config_data);
          
          // Chat Input gets its message from various sources, prioritizing test_message for preview
          let chatMessage = nodeData.input_values?.test_message || 
                           nodeData.input_values?.auto_message || 
                           nodeData.input_values?.message ||
                           nodeData.input_values?.text ||
                           nodeData.input_values?.user_input ||
                           nodeData.config_data?.message ||
                           nodeData.config_data?.text ||
                           '안녕하세요! 이것은 테스트 메시지입니다.';
          
          console.log('🔄 Message selection process:', {
            test_message: nodeData.input_values?.test_message,
            auto_message: nodeData.input_values?.auto_message,
            message: nodeData.input_values?.message,
            text: nodeData.input_values?.text,
            selected: chatMessage
          });
          
          // Apply variable substitution if the message contains variables
          if (typeof chatMessage === 'string' && chatMessage.includes('{')) {
            Object.entries(allVars).forEach(([key, value]) => {
              const regex = new RegExp(`\\{${key}\\}`, 'g');
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
              chatMessage = chatMessage.replace(regex, valueStr);
            });
          }
          
          console.log('✅ Final chat message:', chatMessage);
          
          // Chat Input output format (matches Text Input template structure for compatibility)
          outputData = {
            output: {
              message: chatMessage,
              session_id: `session-${Date.now()}`,
              user_id: 'preview-user',
              timestamp: new Date().toISOString()
            },
            // Also provide direct access for compatibility
            message: chatMessage,
            text: chatMessage  // For backward compatibility with existing flows
          };
          console.log('Chat input output data:', outputData);
          break;
          
        case 'prompt_template':
          console.log('Processing prompt template node');
          console.log('Found incoming edges:', incomingEdges.length);
          
          const template = nodeData.input_values?.template || 'Hello {message}!';
          
          console.log('Template:', template);
          console.log('Connected input data:', connectedInputData);
          console.log('Manual variables:', manualVars);
          console.log('All variables:', allVars);
          
          let renderedPrompt = template;
          Object.entries(allVars).forEach(([key, value]) => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            renderedPrompt = renderedPrompt.replace(regex, valueStr);
          });
          
          outputData = {
            prompt: renderedPrompt,
            template_used: template,
            variables_applied: allVars,
            input_data_received: connectedInputData,
            mapping_results: Object.entries(allVars).map(([key, value]) => ({
              variable_name: key,
              value: typeof value === 'object' ? JSON.stringify(value) : String(value),
              source: connectedInputData[key] !== undefined ? 'connected_node' : 'manual'
            }))
          };
          console.log('Prompt template output data:', outputData);
          break;
          
        case 'ollama_llm':
          console.log('Processing Ollama LLM node');
          
          // Apply variable mappings for Ollama
          const ollamaVariableMappings = nodeData.input_values?.variable_mappings || [];
          const ollamaManualVariables = nodeData.input_values?.manual_variables || {};
          
          // Start with manual variables
          let ollamaAllVariables = { ...ollamaManualVariables };
          
          // Apply variable mappings from connected nodes
          ollamaVariableMappings.forEach((mapping: any) => {
            const inputField = mapping.input_field;
            const variableName = mapping.variable_name;
            const defaultValue = mapping.default_value || '';
            
            if (connectedInputData[inputField] !== undefined) {
              ollamaAllVariables[variableName] = connectedInputData[inputField];
            } else if (defaultValue) {
              ollamaAllVariables[variableName] = defaultValue;
            }
          });
          
          // Apply variable substitution to Ollama prompt
          const applyOllamaVariableSubstitution = (text: string): string => {
            if (typeof text !== 'string' || !text.includes('{')) return text;
            
            let result = text;
            Object.entries(ollamaAllVariables).forEach(([key, value]) => {
              const regex = new RegExp(`\\{${key}\\}`, 'g');
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
              result = result.replace(regex, valueStr);
            });
            return result;
          };
          
          const ollamaPrompt = applyOllamaVariableSubstitution(
            nodeData.input_values?.prompt || connectedInputData.prompt || connectedInputData.text || 'Hello, how can I help you?'
          );
          
          const ollamaSystemMessage = nodeData.input_values?.system_message ? 
            applyOllamaVariableSubstitution(nodeData.input_values.system_message) : 
            undefined;
          
          console.log('Ollama prompt processing:', { 
            originalPrompt: nodeData.input_values?.prompt,
            finalPrompt: ollamaPrompt, 
            systemMessage: ollamaSystemMessage,
            variables: ollamaAllVariables,
            mappings: ollamaVariableMappings.length
          });
          
          // Try to make actual API call to Ollama
          try {
            const ollamaConfig = {
              base_url: nodeData.input_values?.ollama_base_url || 'http://localhost:11434',
              model: nodeData.input_values?.model || 'llama2',
              prompt: ollamaPrompt,
              system_message: ollamaSystemMessage,
              temperature: nodeData.input_values?.temperature || 0.7,
              top_p: nodeData.input_values?.top_p || 0.9,
              top_k: nodeData.input_values?.top_k || 40,
              num_predict: nodeData.input_values?.num_predict || 1000,
              repeat_penalty: nodeData.input_values?.repeat_penalty || 1.1,
              stream: false
            };
            
            const ollamaResponse = await fetch('/api/ollama/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(ollamaConfig)
            });
            
            if (ollamaResponse.ok) {
              const result = await ollamaResponse.json();
              outputData = {
                response: result.response,
                model_used: result.model,
                prompt_used: ollamaPrompt,
                system_message_used: ollamaSystemMessage,
                variables_applied: ollamaAllVariables,
                token_usage: {
                  prompt_tokens: result.prompt_eval_count || 0,
                  completion_tokens: result.eval_count || 0,
                  total_tokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
                },
                performance_stats: {
                  total_duration: result.total_duration,
                  eval_duration: result.eval_duration,
                  load_duration: result.load_duration
                },
                server_info: {
                  base_url: ollamaConfig.base_url,
                  model: ollamaConfig.model
                }
              };
            } else {
              throw new Error(`Ollama API error: ${ollamaResponse.status}`);
            }
          } catch (error) {
            console.warn('Ollama API call failed, using simulated response:', error);
            outputData = {
              response: `[SIMULATED] AI response to: "${ollamaPrompt.substring(0, 100)}${ollamaPrompt.length > 100 ? '...' : ''}"`,
              model_used: nodeData.input_values?.model || 'llama2',
              prompt_used: ollamaPrompt,
              system_message_used: ollamaSystemMessage,
              variables_applied: ollamaAllVariables,
              error: `API connection failed: ${error instanceof Error ? error.message : String(error)}`,
              fallback_mode: true
            };
          }
          
          console.log('Ollama LLM output data:', outputData);
          break;

        case 'openai_llm':
        case 'claude_llm':
          console.log('Processing LLM node');
          
          // Get the prompt value and apply variable substitution
          let promptValue = nodeData.input_values?.prompt || 
                           nodeData.input_values?.input || 
                           connectedInputData.prompt ||
                           connectedInputData.text ||
                           'Default prompt';
          
          // Apply variable substitution for LLM prompts
          if (typeof promptValue === 'string' && promptValue.includes('{')) {
            
            Object.entries(allVars).forEach(([key, value]) => {
              const regex = new RegExp(`\\{${key}\\}`, 'g');
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
              promptValue = promptValue.replace(regex, valueStr);
            });
            
            console.log('LLM variable substitution:', { original: nodeData.input_values?.prompt, substituted: promptValue, variables: allVars });
          }
          
          outputData = {
            response: `This is a simulated AI response to: "${promptValue.substring(0, 100)}${promptValue.length > 100 ? '...' : ''}"`,
            model_used: nodeData.input_values?.model || 'default-model',
            token_usage: { prompt_tokens: 25, completion_tokens: 15, total_tokens: 40 },
            input_prompt: promptValue
          };
          console.log('LLM output data:', outputData);
          break;
          
        case 'chat_output':
          console.log('Processing chat output node');
          
          // Chat Output receives response from connected LLM nodes
          let responseText = connectedInputData.response || 
                           connectedInputData.result ||
                           nodeData.input_values?.response ||
                           '이것은 AI의 응답입니다. (실제 LLM 노드와 연결하여 실제 응답을 받으세요)';
          
          // Apply variable substitution if needed
          if (typeof responseText === 'string' && responseText.includes('{')) {
            Object.entries(allVars).forEach(([key, value]) => {
              const regex = new RegExp(`\\{${key}\\}`, 'g');
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
              responseText = responseText.replace(regex, valueStr);
            });
          }
          
          console.log('Chat output processing:', {
            connectedInputData,
            responseText,
            variables: allVars
          });
          
          outputData = {
            message: responseText,
            timestamp: new Date().toISOString(),
            status: 'sent',
            source: Object.keys(connectedInputData).length > 0 ? 'connected_llm' : 'manual_input',
            connected_data: connectedInputData
          };
          console.log('Chat output data:', outputData);
          break;
          
        default:
          console.log('Processing default component type:', nodeData.template?.component_type);
          
          // Apply variable substitution to all string fields in input_values
          const processedInputValues = { ...nodeData.input_values };
          
          // Process all string fields for variable substitution
          Object.entries(processedInputValues).forEach(([key, value]) => {
            if (typeof value === 'string' && value.includes('{')) {
              Object.entries(allVars).forEach(([varKey, varValue]) => {
                const regex = new RegExp(`\\{${varKey}\\}`, 'g');
                const valueStr = typeof varValue === 'object' ? JSON.stringify(varValue) : String(varValue);
                processedInputValues[key] = value.replace(regex, valueStr);
              });
            }
          });
          
          console.log('Universal variable substitution applied:', { 
            component_type: nodeData.template?.component_type,
            original: nodeData.input_values, 
            processed: processedInputValues, 
            variables: allVars 
          });
          
          outputData = {
            result: 'Executed ' + (nodeData.template?.display_name || 'component'),
            status: 'success',
            processed_config: processedInputValues,
            applied_variables: allVars
          };
          console.log('Default output data:', outputData);
      }

      // Update node status to completed with output data
      console.log('Updating node status to completed...');
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

      console.log(`✅ Node ${nodeId} execution completed with output:`, outputData);

      message.success(`Node ${node.data.display_name || node.data.template?.display_name} executed successfully`);
    } catch (error) {
      console.error('Node execution error:', error);
      // Update node status to failed
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, execution_status: 'failed', error_message: String(error) } }
          : n
      ));
      message.error(`Node execution failed: ${error}`);
    } finally {
      setExecutingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  }, [getNodes, getEdges, setNodes]);

  // Node freeze toggle handler
  const handleNodeFreezeToggle = useCallback((nodeId: string, frozen: boolean) => {
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              is_frozen: frozen, 
              execution_status: frozen ? 'frozen' : 'idle'
            } 
          }
        : n
    ));
    
    message.info(`Node ${frozen ? 'frozen' : 'unfrozen'}`);
  }, [setNodes]);

  // Node preview handler
  const handleNodePreview = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // For now, just show a message. This can be expanded to show actual preview
    message.info(`Preview for ${node.data.display_name || node.data.template?.display_name}`);
    
    // Could also open node config panel with preview enabled
    setSelectedNodeId(nodeId);
    setShowConfigPanel(true);
  }, [nodes]);

  // Create stable node types with memoized callbacks - remove dependencies to prevent recreation
  const nodeTypes = useMemo((): NodeTypes => ({
    langflowNode: (props: any) => (
      <LangflowStyleNode
        {...props}
        onConfigClick={handleNodeConfig}
        onExecuteClick={handleNodeExecute}
        onFreezeToggle={handleNodeFreezeToggle}
        onPreviewClick={handleNodePreview}
      />
    ),
  }), []); // Empty dependency array to prevent recreation

  // Load component templates on component mount
  useEffect(() => {
    loadComponentTemplates();
  }, []);

  // Validate flow whenever nodes or edges change
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const result = FlowValidator.validateFlow(nodes, edges);
      setValidationResult(result);
      
      if (result.errors.length > 0) {
        console.warn('Flow validation errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.warn('Flow validation warnings:', result.warnings);
      }
    } else {
      setValidationResult(null);
    }
  }, [nodes, edges]);

  const loadComponentTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAxiosInstance().get('/component_templates');
      
      if (response.data) {
        setComponentTemplates(response.data);
        message.success(`Loaded ${response.data.length} component templates`);
      }
    } catch (error: any) {
      console.error('Error loading component templates:', error);
      message.error('Failed to load component templates');
    } finally {
      setLoading(false);
    }
  };

  const loadFlowData = async (flowId: string) => {
    try {
      setLoading(true);
      const response = await apiService.getAxiosInstance().get(`/flows/${flowId}/data`);
      
      if (response.data) {
        const flowData: FlowData = response.data;
        
        // Convert flow components to ReactFlow nodes
        const flowNodes: Node[] = flowData.components.map((component: any) => ({
          id: component.id,
          type: 'langflowNode',
          position: { x: component.position_x, y: component.position_y },
          data: {
            ...component,
            template: componentTemplates.find(t => t.id === component.template_id)
          },
        }));

        // Convert flow connections to ReactFlow edges
        const flowEdges: Edge[] = flowData.connections.map((connection: any) => ({
          id: connection.id,
          source: connection.source_component_id,
          target: connection.target_component_id,
          sourceHandle: connection.source_handle,
          targetHandle: connection.target_handle,
          type: 'customEdge',
          data: {
            sourceHandleId: connection.source_handle,
            targetHandleId: connection.target_handle,
            onDelete: handleDeleteEdge
          }
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        setSelectedFlowId(flowId);
        
        message.success(`Loaded flow: ${flowData.name}`);
      }
    } catch (error: any) {
      console.error('Error loading flow data:', error);
      message.error('Failed to load flow data');
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('Connecting:', params);
      
      // Find source and target nodes
      const sourceNode = getNodes().find((n: any) => n.id === params.source);
      const targetNode = getNodes().find((n: any) => n.id === params.target);
      
      if (!sourceNode || !targetNode) {
        console.error('Source or target node not found');
        return;
      }
      
      // Check if this is a single output port connection with multiple variables
      const sourceTemplate = sourceNode.data?.template as any;
      const targetTemplate = targetNode.data?.template as any;
      
      // Define components that provide multiple variables
      const multiVariableComponents = ['text_input', 'chat_input', 'prompt_template'];
      const isMultiVariableSource = multiVariableComponents.includes(sourceTemplate?.component_type);
      
      const isMultiVariableOutput = params.sourceHandle === 'output' && 
                                   isMultiVariableSource &&
                                   (sourceTemplate?.output_schema?.properties?.output?.properties ||
                                    sourceTemplate?.output_schema?.properties);
      
      if (isMultiVariableOutput) {
        // Extract available variables from the output schema
        let outputProperties;
        
        if (sourceTemplate.component_type === 'prompt_template') {
          // For Prompt Template, provide multiple output variables
          outputProperties = {
            prompt: { type: 'string', description: 'Rendered prompt with variables substituted' },
            template_used: { type: 'string', description: 'Original template before variable substitution' },
            variables_applied: { type: 'object', description: 'Variables that were applied to the template' },
            template_variables: { type: 'array', description: 'List of variables found in the template' }
          };
        } else {
          // For other components, use existing logic
          outputProperties = sourceTemplate.output_schema.properties.output?.properties || 
                           sourceTemplate.output_schema.properties;
        }
        
        const availableVariables = Object.entries(outputProperties).map(([name, schema]: [string, any]) => ({
          name,
          type: schema.type || 'string',
          description: schema.description || `${name} output from ${sourceTemplate.display_name}`
        }));
        
        // Check if target is Ollama LLM node - use special modal
        const isOllamaTarget = targetTemplate?.component_type === 'ollama_llm';
        
        if (isOllamaTarget) {
          // Show Ollama-specific variable selection modal
          setSourceNodeVariables(availableVariables);
          setPendingConnection(params);
          setShowOllamaVariableModal(true);
        } else {
          // Show regular variable selection modal
          setSourceNodeVariables(availableVariables);
          setPendingConnection(params);
          setShowVariableModal(true);
        }
      } else {
        // Direct connection for legacy multi-port or simple connections
        setEdges((eds) => addEdge({
          ...params,
          type: 'customEdge',
          data: {
            sourceHandleId: params.sourceHandle,
            targetHandleId: params.targetHandle,
            onDelete: handleDeleteEdge
          }
        }, eds));
      }
    },
    [setEdges, getNodes]
  );

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  // Variable connection modal handlers
  const handleVariableConnectionConfirm = useCallback((mappings: VariableMapping[]) => {
    if (!pendingConnection) return;
    
    // Create a single edge that contains all the variable mappings
    const edgeId = `${pendingConnection.source}-${pendingConnection.target}-variables`;
    
    const newEdge = {
      id: edgeId,
      source: pendingConnection.source!,
      target: pendingConnection.target!,
      sourceHandle: 'output', // Keep the main output handle
      targetHandle: pendingConnection.targetHandle || 'variables', // Use a generic target handle
      type: 'customEdge',
      data: {
        sourceHandleId: 'output',
        targetHandleId: pendingConnection.targetHandle || 'variables',
        onDelete: handleDeleteEdge,
        variableMappings: mappings, // Store all mappings in one edge
        isMultiVariableConnection: true // Flag to identify this type of connection
      }
    };
    
    setEdges((eds) => addEdge(newEdge, eds));
    setShowVariableModal(false);
    setPendingConnection(null);
    setSourceNodeVariables([]);
    
    message.success(`Connected ${mappings.length} variable${mappings.length !== 1 ? 's' : ''}`);
  }, [pendingConnection, setEdges, handleDeleteEdge]);

  const handleVariableConnectionCancel = useCallback(() => {
    setShowVariableModal(false);
    setPendingConnection(null);
    setSourceNodeVariables([]);
  }, []);

  // Ollama Variable connection modal handlers
  const handleOllamaVariableConnectionConfirm = useCallback((mappings: OllamaVariableMapping[]) => {
    if (!pendingConnection) return;
    
    // Create a single edge that contains all the Ollama variable mappings
    const edgeId = `${pendingConnection.source}-${pendingConnection.target}-ollama-variables`;
    
    const newEdge = {
      id: edgeId,
      source: pendingConnection.source!,
      target: pendingConnection.target!,
      sourceHandle: 'output',
      targetHandle: pendingConnection.targetHandle || 'variables',
      type: 'customEdge',
      data: {
        sourceHandleId: 'output',
        targetHandleId: pendingConnection.targetHandle || 'variables',
        onDelete: handleDeleteEdge,
        ollamaVariableMappings: mappings, // Store Ollama-specific mappings
        isOllamaConnection: true // Flag to identify Ollama connections
      }
    };
    
    setEdges((eds) => addEdge(newEdge, eds));
    setShowOllamaVariableModal(false);
    setPendingConnection(null);
    setSourceNodeVariables([]);
    
    message.success(`Connected ${mappings.length} variable${mappings.length !== 1 ? 's' : ''} to Ollama LLM`);
  }, [pendingConnection, setEdges, handleDeleteEdge]);

  const handleOllamaVariableConnectionCancel = useCallback(() => {
    setShowOllamaVariableModal(false);
    setPendingConnection(null);
    setSourceNodeVariables([]);
  }, []);

  const handleFlowChange = useCallback((flowId: string, flowName: string) => {
    setSelectedFlowId(flowId);
    setSelectedFlowName(flowName);
  }, []);

  const handleNewFlow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedFlowId(null);
    setSelectedFlowName('Untitled Flow');
    setSelectedNodeId(null);
    setShowConfigPanel(false);
  }, [setNodes, setEdges]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setShowConfigPanel(true);
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedNodeId(null);
    setShowConfigPanel(false);
  }, []);

  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    // Edge 클릭 시 삭제 확인 후 삭제
    if (confirm('이 연결을 삭제하시겠습니까?')) {
      handleDeleteEdge(edge.id);
    }
  }, [handleDeleteEdge]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = (event.target as Element).getBoundingClientRect();
      const templateData = event.dataTransfer.getData('application/reactflow');

      if (typeof templateData === 'undefined' || !templateData) {
        return;
      }

      const template: ComponentTemplate = JSON.parse(templateData);
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `${template.component_type}-${Date.now()}`,
        type: 'langflowNode',
        position,
        data: {
          template,
          component_key: `${template.component_type}-${Date.now()}`,
          display_name: template.display_name,
          config_data: {},
          input_values: {},
          execution_status: 'idle',
          execution_progress: 0,
          is_frozen: false,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  // Handle flow test - open Chat Test page
  const handleTestFlow = useCallback(() => {
    if (!selectedFlowId) {
      message.warning('Please save the flow first');
      return;
    }

    // Get current flow data
    const nodes = getNodes();
    const edges = getEdges();
    
    // Check if flow has chat input nodes
    const chatInputNodes = nodes.filter(node => 
      node.data?.template?.component_type === 'chat_input'
    );

    if (chatInputNodes.length === 0) {
      message.warning('This flow does not contain any Chat Input nodes. Add a Chat Input node to enable testing.');
      return;
    }

    // Save current flow data and navigate to Chat Test page
    const flowData = {
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    // Navigate to Chat Test page with flow ID
    window.open(`/chat-test?flowId=${selectedFlowId}`, '_blank');
  }, [selectedFlowId, getNodes, getEdges]);

  return (
    <Layout style={{ height: '100vh' }}>
        {/* Flow Toolbar */}
        <FlowToolbar
          currentFlowId={selectedFlowId}
          currentFlowName={selectedFlowName}
          onFlowChange={handleFlowChange}
          onNewFlow={handleNewFlow}
          validationResult={validationResult}
          onShowExecution={() => setShowExecutionPanel(true)}
          onTestFlow={handleTestFlow}
        />

        <Layout>
          {/* Component Library Sidebar */}
          <Sider 
            width={320} 
            style={{ 
              background: '#fff', 
              borderRight: '1px solid #e8e8e8',
              overflow: 'auto'
            }}
          >
          <div style={{ padding: '16px' }}>
            <Title level={4} style={{ margin: '0 0 16px 0' }}>
              Component Library
            </Title>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="large" />
              </div>
            ) : (
              <LangflowStyleLibrary 
                templates={componentTemplates}
                onTemplateSelect={(template) => console.log('Selected:', template)}
              />
            )}
          </div>
        </Sider>

        {/* Main Canvas */}
        <Content style={{ background: '#fafafa' }}>
          <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handleCanvasClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{
                type: 'customEdge',
                animated: true,
              }}
              proOptions={{ hideAttribution: true }}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </Content>

        {/* Node Configuration Panel */}
        {showConfigPanel && !showExecutionPanel && (
          <Sider 
            width={400} 
            style={{ 
              background: '#fff', 
              borderLeft: '1px solid #e8e8e8',
              overflow: 'hidden'
            }}
          >
            <NodeConfigPanel
              selectedNodeId={selectedNodeId}
              onClose={() => {
                setSelectedNodeId(null);
                setShowConfigPanel(false);
              }}
            />
          </Sider>
        )}

        {/* Execution Panel */}
        {showExecutionPanel && (
          <Sider 
            width={450} 
            style={{ 
              background: '#fff', 
              borderLeft: '1px solid #e8e8e8',
              overflow: 'hidden'
            }}
          >
            <ExecutionPanel
              currentFlowId={selectedFlowId}
              onClose={() => setShowExecutionPanel(false)}
            />
          </Sider>
        )}
        </Layout>

        {/* Variable Connection Modal */}
        <VariableConnectionModal
          visible={showVariableModal}
          sourceNodeName={
            pendingConnection ? 
            getNodes().find(n => n.id === pendingConnection.source)?.data?.template?.display_name || 'Source Node' 
            : 'Source Node'
          }
          targetNodeName={
            pendingConnection ? 
            getNodes().find(n => n.id === pendingConnection.target)?.data?.template?.display_name || 'Target Node'
            : 'Target Node'
          }
          availableVariables={sourceNodeVariables}
          onConfirm={handleVariableConnectionConfirm}
          onCancel={handleVariableConnectionCancel}
        />

        {/* Ollama Variable Connection Modal */}
        <OllamaVariableConnectionModal
          visible={showOllamaVariableModal}
          sourceNodeName={
            pendingConnection ? 
            getNodes().find(n => n.id === pendingConnection.source)?.data?.template?.display_name || 'Source Node' 
            : 'Source Node'
          }
          targetNodeName={
            pendingConnection ? 
            getNodes().find(n => n.id === pendingConnection.target)?.data?.template?.display_name || 'Target Node'
            : 'Target Node'
          }
          availableVariables={sourceNodeVariables}
          onConfirm={handleOllamaVariableConnectionConfirm}
          onCancel={handleOllamaVariableConnectionCancel}
        />
      </Layout>
  );
};

// Wrapper component with ReactFlowProvider
const FlowEditorPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FlowEditorContent />
    </ReactFlowProvider>
  );
};

export default FlowEditorPage;