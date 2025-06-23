import { Node, Edge } from '@xyflow/react';

export interface ValidationError {
  type: 'error' | 'warning';
  nodeId?: string;
  edgeId?: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class FlowValidator {
  static validateFlow(nodes: Node[], edges: Edge[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate nodes
    nodes.forEach(node => {
      const nodeErrors = this.validateNode(node, nodes, edges);
      errors.push(...nodeErrors.filter(e => e.type === 'error'));
      warnings.push(...nodeErrors.filter(e => e.type === 'warning'));
    });

    // Validate edges
    edges.forEach(edge => {
      const edgeErrors = this.validateEdge(edge, nodes);
      errors.push(...edgeErrors.filter(e => e.type === 'error'));
      warnings.push(...edgeErrors.filter(e => e.type === 'warning'));
    });

    // Validate flow structure
    const structuralErrors = this.validateFlowStructure(nodes, edges);
    errors.push(...structuralErrors.filter(e => e.type === 'error'));
    warnings.push(...structuralErrors.filter(e => e.type === 'warning'));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateNode(node: Node, allNodes: Node[], allEdges: Edge[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const template = node.data?.template;

    if (!template) {
      errors.push({
        type: 'error',
        nodeId: node.id,
        message: 'Node is missing template data',
        code: 'MISSING_TEMPLATE',
      });
      return errors;
    }

    // Validate required inputs
    Object.entries(template.input_schema || {}).forEach(([key, schema]) => {
      if (schema.required && !schema.is_handle) {
        const value = node.data.input_values?.[key];
        if (value === undefined || value === null || value === '') {
          errors.push({
            type: 'error',
            nodeId: node.id,
            message: `Required field "${schema.display_name}" is empty`,
            code: 'REQUIRED_FIELD_EMPTY',
          });
        }
      }

      // Validate connected inputs
      if (schema.is_handle && schema.required) {
        const hasConnection = allEdges.some(edge => 
          edge.target === node.id && edge.targetHandle === key
        );
        if (!hasConnection) {
          errors.push({
            type: 'warning',
            nodeId: node.id,
            message: `Required input "${schema.display_name}" is not connected`,
            code: 'REQUIRED_INPUT_NOT_CONNECTED',
          });
        }
      }
    });

    // Validate node name
    if (!node.data.display_name?.trim()) {
      errors.push({
        type: 'warning',
        nodeId: node.id,
        message: 'Node display name is empty',
        code: 'EMPTY_DISPLAY_NAME',
      });
    }

    // Check for duplicate names
    const duplicateNames = allNodes.filter(n => 
      n.id !== node.id && 
      n.data.display_name === node.data.display_name
    );
    if (duplicateNames.length > 0) {
      errors.push({
        type: 'warning',
        nodeId: node.id,
        message: `Duplicate node name: "${node.data.display_name}"`,
        code: 'DUPLICATE_NODE_NAME',
      });
    }

    return errors;
  }

  private static validateEdge(edge: Edge, allNodes: Node[]): ValidationError[] {
    const errors: ValidationError[] = [];

    const sourceNode = allNodes.find(n => n.id === edge.source);
    const targetNode = allNodes.find(n => n.id === edge.target);

    if (!sourceNode) {
      errors.push({
        type: 'error',
        edgeId: edge.id,
        message: 'Edge source node not found',
        code: 'SOURCE_NODE_NOT_FOUND',
      });
    }

    if (!targetNode) {
      errors.push({
        type: 'error',
        edgeId: edge.id,
        message: 'Edge target node not found',
        code: 'TARGET_NODE_NOT_FOUND',
      });
    }

    if (sourceNode && targetNode) {
      // Validate handle compatibility
      const sourceSchema = sourceNode.data?.template?.output_schema?.[edge.sourceHandle || ''];
      const targetSchema = targetNode.data?.template?.input_schema?.[edge.targetHandle || ''];

      if (!sourceSchema) {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message: 'Invalid source handle',
          code: 'INVALID_SOURCE_HANDLE',
        });
      }

      if (!targetSchema) {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message: 'Invalid target handle',
          code: 'INVALID_TARGET_HANDLE',
        });
      }

      // Type compatibility check
      if (sourceSchema && targetSchema) {
        if (!this.areTypesCompatible(sourceSchema.type, targetSchema.type)) {
          errors.push({
            type: 'warning',
            edgeId: edge.id,
            message: `Type mismatch: ${sourceSchema.type} → ${targetSchema.type}`,
            code: 'TYPE_MISMATCH',
          });
        }
      }
    }

    return errors;
  }

  private static validateFlowStructure(nodes: Node[], edges: Edge[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for circular dependencies
    const circularPaths = this.findCircularDependencies(nodes, edges);
    circularPaths.forEach(path => {
      errors.push({
        type: 'error',
        message: `Circular dependency detected: ${path.join(' → ')}`,
        code: 'CIRCULAR_DEPENDENCY',
      });
    });

    // Check for isolated nodes
    const isolatedNodes = nodes.filter(node => {
      const hasIncoming = edges.some(edge => edge.target === node.id);
      const hasOutgoing = edges.some(edge => edge.source === node.id);
      const isInputNode = node.data?.template?.category === 'Inputs';
      const isOutputNode = node.data?.template?.category === 'Outputs';
      
      return !hasIncoming && !hasOutgoing && !isInputNode && !isOutputNode;
    });

    isolatedNodes.forEach(node => {
      errors.push({
        type: 'warning',
        nodeId: node.id,
        message: 'Node is not connected to any other nodes',
        code: 'ISOLATED_NODE',
      });
    });

    // Check for missing output nodes
    const hasOutputNode = nodes.some(node => node.data?.template?.category === 'Outputs');
    if (nodes.length > 0 && !hasOutputNode) {
      errors.push({
        type: 'warning',
        message: 'Flow has no output nodes',
        code: 'NO_OUTPUT_NODES',
      });
    }

    return errors;
  }

  private static findCircularDependencies(nodes: Node[], edges: Edge[]): string[][] {
    const circularPaths: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          circularPaths.push(path.slice(cycleStart).concat([nodeId]));
        }
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      for (const edge of outgoingEdges) {
        if (dfs(edge.target, [...path, nodeId])) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    });

    return circularPaths;
  }

  private static areTypesCompatible(sourceType: string, targetType: string): boolean {
    // Exact match
    if (sourceType === targetType) {
      return true;
    }

    // Generic type can accept anything
    if (targetType === 'Generic') {
      return true;
    }

    // String types are compatible with Text
    if ((sourceType === 'string' && targetType === 'Text') ||
        (sourceType === 'Text' && targetType === 'string')) {
      return true;
    }

    // Dict and list types are compatible with Dataframe
    if ((sourceType === 'dict' || sourceType === 'list') && targetType === 'Dataframe') {
      return true;
    }

    // Numbers are compatible
    if (sourceType === 'number' && targetType === 'number') {
      return true;
    }

    return false;
  }

  static getNodeValidationStatus(nodeId: string, validationResult: ValidationResult): {
    hasErrors: boolean;
    hasWarnings: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  } {
    const errors = validationResult.errors.filter(e => e.nodeId === nodeId);
    const warnings = validationResult.warnings.filter(w => w.nodeId === nodeId);

    return {
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errors,
      warnings,
    };
  }
}