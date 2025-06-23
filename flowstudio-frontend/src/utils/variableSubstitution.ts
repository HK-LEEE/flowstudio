/**
 * Universal Variable Substitution Utilities
 * Provides consistent variable substitution across all components
 */

export interface VariableContext {
  connectedData: Record<string, any>;
  manualVariables: Record<string, any>;
  nodeInputValues: Record<string, any>;
}

/**
 * Extract variables from a text string
 * @param text - Text containing {variable} placeholders
 * @returns Array of variable names found in the text
 */
export function extractVariables(text: string): string[] {
  if (typeof text !== 'string') return [];
  const matches = text.match(/\{([^}]+)\}/g);
  return matches ? matches.map(match => match.slice(1, -1)) : [];
}

/**
 * Apply variable substitution to a text string
 * @param text - Text containing {variable} placeholders
 * @param variables - Object containing variable values
 * @returns Text with variables substituted
 */
export function substituteVariables(text: string, variables: Record<string, any>): string {
  if (typeof text !== 'string' || !text.includes('{')) return text;
  
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    result = result.replace(regex, valueStr);
  });
  
  return result;
}

/**
 * Process all string fields in an object for variable substitution
 * @param obj - Object containing fields to process
 * @param variables - Object containing variable values
 * @param excludeKeys - Keys to exclude from processing
 * @returns New object with variables substituted
 */
export function processObjectFields(
  obj: Record<string, any>, 
  variables: Record<string, any>,
  excludeKeys: string[] = ['manual_variables']
): Record<string, any> {
  const result: Record<string, any> = {};
  
  Object.entries(obj).forEach(([key, value]) => {
    if (excludeKeys.includes(key)) {
      result[key] = value;
    } else if (typeof value === 'string') {
      result[key] = substituteVariables(value, variables);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = processObjectFields(value, variables, excludeKeys);
    } else {
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * Create a comprehensive variable context from node data and connections
 * @param nodeData - Current node's data
 * @param connectedNodesData - Array of output data from connected nodes
 * @returns Combined variable context
 */
export function createVariableContext(
  nodeData: any,
  connectedNodesData: Record<string, any>[] = []
): VariableContext {
  // Combine all connected node data
  const connectedData: Record<string, any> = {};
  connectedNodesData.forEach(data => {
    Object.assign(connectedData, data);
  });
  
  // Get manual variables from node input values
  const manualVariables = nodeData.input_values?.manual_variables || {};
  
  // Get all node input values (excluding manual variables to avoid recursion)
  const { manual_variables, ...nodeInputValues } = nodeData.input_values || {};
  
  return {
    connectedData,
    manualVariables,
    nodeInputValues
  };
}

/**
 * Get all available variables from a context
 * @param context - Variable context
 * @returns Combined object of all available variables
 */
export function getAllVariables(context: VariableContext): Record<string, any> {
  return {
    ...context.connectedData,
    ...context.manualVariables
  };
}

/**
 * Analyze variable usage in a text
 * @param text - Text to analyze
 * @param availableVariables - Object of available variables
 * @returns Analysis results
 */
export function analyzeVariableUsage(text: string, availableVariables: Record<string, any>) {
  const usedVariables = extractVariables(text);
  const availableKeys = Object.keys(availableVariables);
  
  const mappedVariables = usedVariables.filter(v => availableKeys.includes(v));
  const unmappedVariables = usedVariables.filter(v => !availableKeys.includes(v));
  const hasRealData = mappedVariables.some(v => availableVariables[v] !== undefined);
  
  return {
    usedVariables,
    mappedVariables,
    unmappedVariables,
    hasRealData,
    totalVariables: usedVariables.length,
    mappedCount: mappedVariables.length,
    unmappedCount: unmappedVariables.length
  };
}

/**
 * Universal component execution with variable substitution
 * @param componentType - Type of component
 * @param inputValues - Component input values
 * @param context - Variable context
 * @returns Processed output data
 */
export function executeComponentWithVariables(
  componentType: string,
  inputValues: Record<string, any>,
  context: VariableContext
): Record<string, any> {
  const allVariables = getAllVariables(context);
  
  switch (componentType) {
    case 'text_input':
    case 'chat_input':
      const textValue = substituteVariables(
        inputValues.text || inputValues.default_value || 'Default text',
        allVariables
      );
      return {
        text: textValue,
        message: textValue
      };
      
    case 'prompt_template':
      const template = inputValues.template || 'Hello {input}!';
      const renderedPrompt = substituteVariables(template, allVariables);
      return {
        prompt: renderedPrompt,
        template_used: template,
        variables_applied: allVariables
      };
      
    case 'openai_llm':
    case 'claude_llm':
      const promptValue = substituteVariables(
        inputValues.prompt || inputValues.input || context.connectedData.prompt || context.connectedData.text || 'Default prompt',
        allVariables
      );
      return {
        response: `Simulated AI response to: "${promptValue.substring(0, 100)}${promptValue.length > 100 ? '...' : ''}"`,
        model_used: inputValues.model || 'default-model',
        token_usage: { prompt_tokens: 25, completion_tokens: 15, total_tokens: 40 },
        input_prompt: promptValue
      };
      
    default:
      // Universal processing for all other components
      const processedConfig = processObjectFields(inputValues, allVariables);
      return {
        result: `Executed ${componentType}`,
        status: 'success',
        processed_config: processedConfig,
        applied_variables: allVariables
      };
  }
}

/**
 * Check if a field supports variable substitution based on its properties
 * @param fieldName - Name of the field
 * @param fieldSchema - Schema definition of the field
 * @returns True if the field supports variables
 */
export function supportsVariableSubstitution(fieldName: string, fieldSchema: any): boolean {
  // Explicit support flag in schema
  if (fieldSchema?.supports_variables !== undefined) {
    return fieldSchema.supports_variables;
  }
  
  // Auto-detect based on field type and name
  if (fieldSchema?.type === 'string') {
    const variableSupportedFields = [
      'template', 'prompt', 'message', 'text', 'content', 
      'input', 'system_message', 'description', 'title'
    ];
    
    return variableSupportedFields.some(field => 
      fieldName.toLowerCase().includes(field)
    );
  }
  
  return false;
}