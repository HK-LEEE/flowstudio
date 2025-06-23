/**
 * Hook for detecting node connections and extracting available input fields
 */
import { useEffect, useState, useMemo } from 'react';
import { useReactFlow, Node } from '@xyflow/react';

interface InputField {
  name: string;
  type: string;
  description?: string;
  sourceNode?: string;
  sourcePort?: string;
}

export const useNodeConnections = (nodeId: string, targetPortId?: string) => {
  const { getEdges, getNodes } = useReactFlow();
  const [inputFields, setInputFields] = useState<InputField[]>([]);

  const connectedInputData = useMemo(() => {
    const edges = getEdges();
    const nodes = getNodes();
    
    // Find edges connected to this node's input ports
    const incomingEdges = edges.filter(edge => {
      if (edge.target !== nodeId) return false;
      // If specific port specified, filter by that port
      if (targetPortId && edge.targetHandle !== targetPortId) return false;
      return true;
    });

    const fields: InputField[] = [];

    incomingEdges.forEach(edge => {
      // Find source node
      const sourceNode = nodes.find(node => node.id === edge.source);
      if (!sourceNode) return;

      // Check if this is a multi-variable connection
      const edgeData = edge.data as any;
      if (edgeData?.isMultiVariableConnection && edgeData?.variableMappings) {
        // Add fields from variable mappings (regular connections)
        edgeData.variableMappings.forEach((mapping: any) => {
          fields.push({
            name: mapping.targetVariable,
            type: mapping.dataType || 'string',
            description: mapping.description || '',
            sourceNode: sourceNode.id,
            sourcePort: edge.sourceHandle || 'output'
          });
        });
      } else if (edgeData?.isOllamaConnection && edgeData?.ollamaVariableMappings) {
        // Add fields from Ollama-specific variable mappings
        edgeData.ollamaVariableMappings.forEach((mapping: any) => {
          fields.push({
            name: mapping.targetVariable,
            type: mapping.dataType || 'string',
            description: mapping.description || '',
            sourceNode: sourceNode.id,
            sourcePort: edge.sourceHandle || 'output'
          });
        });
      } else {
        // Extract output schema from source node (legacy approach)
        const outputSchema = extractNodeOutputSchema(sourceNode, edge.sourceHandle || undefined);
        
        // Use the output schema for all node types
        if (outputSchema?.properties && typeof outputSchema.properties === 'object') {
          Object.entries(outputSchema.properties).forEach(([fieldName, fieldDef]: [string, any]) => {
            if (fieldName && fieldDef) {
              fields.push({
                name: fieldName,
                type: fieldDef.type || 'string',
                description: fieldDef.description || '',
                sourceNode: sourceNode.id,
                sourcePort: edge.sourceHandle || 'default'
              });
            }
          });
        }
      }
    });

    return fields;
  }, [nodeId, targetPortId, getEdges, getNodes]);

  useEffect(() => {
    setInputFields(connectedInputData);
  }, [connectedInputData]);

  return {
    inputFields,
    hasConnections: inputFields.length > 0,
    getFieldsBySourceNode: (sourceNodeId: string) => 
      inputFields.filter(field => field.sourceNode === sourceNodeId)
  };
};

/**
 * Extract variables from template string
 */
const extractVariablesFromTemplate = (template: string): string[] => {
  const matches = template.match(/\{([^}]+)\}/g);
  return matches ? matches.map(match => match.slice(1, -1)).filter(Boolean) : [];
};

/**
 * Extract output schema from a node
 */
const extractNodeOutputSchema = (node: Node, portId?: string) => {
  try {
    // Get component template from node data
    const template = node.data?.template as any;
    if (!template?.output_schema) return null;

    // Check if this is a single output port with nested variables
    if (portId === 'output' && template.output_schema?.properties?.output?.properties) {
      // Return the nested properties as the schema
      return {
        properties: template.output_schema.properties.output.properties
      };
    }
    
    // Check if this is a variable reference (e.g., "output.text")
    if (portId && portId.includes('.') && portId.startsWith('output.')) {
      const varName = portId.split('.', 1)[1];
      const outputProps = template.output_schema?.properties?.output?.properties;
      if (outputProps && varName in outputProps) {
        return {
          properties: {
            [varName]: outputProps[varName]
          }
        };
      }
    }

    // Always return the full output schema - all output fields are available
    // The portId is used for connection validation, not for limiting available fields
    return template.output_schema;
  } catch (error) {
    console.warn('Failed to extract output schema from node:', node.id, error);
    return null;
  }
};

/**
 * Hook specifically for Prompt Template input data detection
 */
export const usePromptTemplateInputs = (nodeId: string) => {
  const { inputFields, hasConnections } = useNodeConnections(nodeId, 'input_data');
  
  return {
    availableInputFields: inputFields.map(field => field?.name).filter(Boolean),
    inputFields,
    hasConnections,
    // Helper to get default variable mappings
    getDefaultMappings: () => inputFields
      .filter(field => field?.name)
      .map(field => ({
        input_field: field.name,
        variable_name: field.name, // Default: use same name
        default_value: ''
      }))
  };
};