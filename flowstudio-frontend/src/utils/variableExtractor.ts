/**
 * Variable Extraction Utility
 * Provides comprehensive variable detection and management for template-based components
 */

export interface VariableInfo {
  name: string;
  startIndex: number;
  endIndex: number;
  fullMatch: string;
  isValid: boolean;
}

export interface VariableAnalysis {
  variables: VariableInfo[];
  uniqueVariables: string[];
  invalidVariables: string[];
  totalVariables: number;
  hasVariables: boolean;
}

export interface VariableMapping {
  inputField: string;
  variableName: string;
  defaultValue?: string;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'title_case' | 'trim';
  source?: 'connected_node' | 'manual' | 'fallback';
  sourceNode?: string;
}

export interface VariableSubstitution {
  template: string;
  variables: Record<string, any>;
  mappings?: VariableMapping[];
}

export interface SubstitutionResult {
  result: string;
  appliedVariables: Record<string, any>;
  unmappedVariables: string[];
  substitutionLog: Array<{
    variable: string;
    originalValue: any;
    finalValue: string;
    wasTransformed: boolean;
    source: string;
  }>;
}

/**
 * Extract variables from template string
 * Supports {variable} syntax with nested braces and validation
 */
export function extractVariables(template: string): VariableAnalysis {
  if (!template || typeof template !== 'string') {
    return {
      variables: [],
      uniqueVariables: [],
      invalidVariables: [],
      totalVariables: 0,
      hasVariables: false
    };
  }

  const variableRegex = /\{([^{}]*)\}/g;
  const variables: VariableInfo[] = [];
  const uniqueNames = new Set<string>();
  const invalidVariables: string[] = [];
  let match;

  while ((match = variableRegex.exec(template)) !== null) {
    const fullMatch = match[0];
    const variableName = match[1];
    const isValid = isValidVariableName(variableName);
    
    if (!isValid) {
      invalidVariables.push(variableName);
    }
    
    variables.push({
      name: variableName,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      fullMatch,
      isValid
    });
    
    if (isValid) {
      uniqueNames.add(variableName);
    }
  }

  return {
    variables,
    uniqueVariables: Array.from(uniqueNames),
    invalidVariables,
    totalVariables: variables.length,
    hasVariables: variables.length > 0
  };
}

/**
 * Validate variable name
 * Checks for valid identifier patterns
 */
export function isValidVariableName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  // Allow alphanumeric, underscore, and dots for nested access
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
  return validPattern.test(name.trim());
}

/**
 * Apply variable transformations
 */
export function applyTransform(value: any, transform?: string): string {
  const stringValue = String(value ?? '');
  
  switch (transform) {
    case 'uppercase':
      return stringValue.toUpperCase();
    case 'lowercase':
      return stringValue.toLowerCase();
    case 'title_case':
      return stringValue.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    case 'trim':
      return stringValue.trim();
    default:
      return stringValue;
  }
}

/**
 * Substitute variables in template with provided values
 */
export function substituteVariables(substitution: VariableSubstitution): SubstitutionResult {
  const { template, variables, mappings = [] } = substitution;
  
  if (!template) {
    return {
      result: '',
      appliedVariables: {},
      unmappedVariables: [],
      substitutionLog: []
    };
  }

  const analysis = extractVariables(template);
  const appliedVariables: Record<string, any> = {};
  const substitutionLog: SubstitutionResult['substitutionLog'] = [];
  let result = template;

  // Process each unique variable
  for (const variableName of analysis.uniqueVariables) {
    let finalValue = '';
    let originalValue: any = undefined;
    let wasTransformed = false;
    let source = 'not_found';

    // Check if variable has a mapping
    const mapping = mappings.find(m => m.variableName === variableName);
    
    if (mapping) {
      // Use mapping to get value
      if (mapping.inputField && variables.hasOwnProperty(mapping.inputField)) {
        originalValue = variables[mapping.inputField];
        source = mapping.source || 'mapped';
      } else if (mapping.defaultValue !== undefined) {
        originalValue = mapping.defaultValue;
        source = 'default';
      }
      
      // Apply transformation if specified
      if (originalValue !== undefined) {
        finalValue = applyTransform(originalValue, mapping.transform);
        wasTransformed = mapping.transform !== 'none' && mapping.transform !== undefined;
      }
    } else {
      // Direct variable lookup
      if (variables.hasOwnProperty(variableName)) {
        originalValue = variables[variableName];
        finalValue = applyTransform(originalValue);
        source = 'direct';
      }
    }

    // Record the substitution
    substitutionLog.push({
      variable: variableName,
      originalValue,
      finalValue,
      wasTransformed,
      source
    });

    if (finalValue !== '') {
      appliedVariables[variableName] = finalValue;
      
      // Replace all instances of this variable
      const regex = new RegExp(`\\{${escapeRegExp(variableName)}\\}`, 'g');
      result = result.replace(regex, finalValue);
    }
  }

  // Find unmapped variables
  const unmappedVariables = analysis.uniqueVariables.filter(
    name => !appliedVariables.hasOwnProperty(name)
  );

  return {
    result,
    appliedVariables,
    unmappedVariables,
    substitutionLog
  };
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate suggested variable mappings based on available input fields
 */
export function generateSuggestedMappings(
  templateVariables: string[],
  availableFields: string[]
): VariableMapping[] {
  const mappings: VariableMapping[] = [];
  
  for (const variable of templateVariables) {
    // Try to find exact match first
    let matchedField = availableFields.find(field => 
      field.toLowerCase() === variable.toLowerCase()
    );
    
    // Try partial matches
    if (!matchedField) {
      matchedField = availableFields.find(field => 
        field.toLowerCase().includes(variable.toLowerCase()) ||
        variable.toLowerCase().includes(field.toLowerCase())
      );
    }
    
    mappings.push({
      inputField: matchedField || '',
      variableName: variable,
      defaultValue: '',
      transform: 'none',
      source: matchedField ? 'connected_node' : 'manual'
    });
  }
  
  return mappings;
}

/**
 * Validate variable mappings
 */
export function validateMappings(
  mappings: VariableMapping[],
  availableFields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const mapping of mappings) {
    if (!mapping.variableName) {
      errors.push('Variable name is required');
      continue;
    }
    
    if (!isValidVariableName(mapping.variableName)) {
      errors.push(`Invalid variable name: ${mapping.variableName}`);
    }
    
    if (mapping.inputField && !availableFields.includes(mapping.inputField)) {
      errors.push(`Input field "${mapping.inputField}" is not available`);
    }
    
    if (!mapping.inputField && !mapping.defaultValue) {
      errors.push(`Variable "${mapping.variableName}" needs either an input field or default value`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extract field type hints from schema for better variable suggestions
 */
export function extractFieldTypeHints(schema: any): Record<string, string> {
  const hints: Record<string, string> = {};
  
  if (schema?.properties && typeof schema.properties === 'object') {
    Object.entries(schema.properties).forEach(([key, definition]: [string, any]) => {
      if (definition && typeof definition === 'object') {
        hints[key] = definition.type || 'unknown';
      }
    });
  }
  
  return hints;
}

/**
 * Check if a field is likely to contain template variables
 */
export function isTemplateField(fieldName: string, fieldSchema: any): boolean {
  const templateKeywords = ['template', 'prompt', 'message', 'content', 'text', 'format'];
  const fieldNameLower = fieldName.toLowerCase();
  
  // Check field name
  if (templateKeywords.some(keyword => fieldNameLower.includes(keyword))) {
    return true;
  }
  
  // Check field type and format
  if (fieldSchema?.type === 'string' && fieldSchema?.format !== 'password') {
    return true;
  }
  
  // Check description
  if (fieldSchema?.description?.toLowerCase().includes('template')) {
    return true;
  }
  
  return false;
}