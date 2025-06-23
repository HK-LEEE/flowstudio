/**
 * Ollama Service for dynamic model loading and server interaction
 */

export interface OllamaModel {
  name: string;
  size?: number;
  digest?: string;
  modified_at?: string;
  details?: Record<string, any>;
}

export interface OllamaServerInfo {
  url: string;
  status: 'connected' | 'error' | 'disconnected';
  models: string[];
  error?: string;
}

export interface ConnectionTestResult {
  status: 'success' | 'error';
  message: string;
  server_url: string;
  model_count?: number;
  response_time?: number;
  error_details?: string;
  suggestion?: string;
}

export interface OllamaGenerateRequest {
  base_url: string;
  model: string;
  prompt: string;
  system_message?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  repeat_penalty?: number;
  stream?: boolean;
}

export interface OllamaGenerateResponse {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaService {
  private static baseApiUrl = '/api/ollama';
  
  /**
   * Get authentication headers
   */
  private static getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }
  
  /**
   * Test connection to Ollama server
   */
  static async testConnection(baseUrl: string): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(
        `${this.baseApiUrl}/test-connection?base_url=${encodeURIComponent(baseUrl)}`,
        {
          method: 'POST',
          headers: this.getAuthHeaders()
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Connection test failed:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection test failed',
        server_url: baseUrl
      };
    }
  }
  
  /**
   * Get available models from Ollama server
   */
  static async getAvailableModels(baseUrl: string): Promise<OllamaServerInfo> {
    try {
      const response = await fetch(
        `${this.baseApiUrl}/models?base_url=${encodeURIComponent(baseUrl)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return {
        url: baseUrl,
        status: 'error',
        models: [],
        error: error instanceof Error ? error.message : 'Failed to fetch models'
      };
    }
  }
  
  /**
   * Get detailed model information
   */
  static async getDetailedModels(baseUrl: string): Promise<OllamaModel[]> {
    try {
      const response = await fetch(
        `${this.baseApiUrl}/models/detailed?base_url=${encodeURIComponent(baseUrl)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch detailed models:', error);
      return [];
    }
  }
  
  /**
   * Check health of Ollama server (no auth required)
   */
  static async checkHealth(baseUrl: string): Promise<{
    status: 'healthy' | 'unhealthy';
    server_url: string;
    response_time_ms?: number;
    model_count?: number;
    api_version?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.baseApiUrl}/health?base_url=${encodeURIComponent(baseUrl)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        server_url: baseUrl,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }
  
  /**
   * Auto-discover local Ollama instances
   */
  static async discoverLocalInstances(): Promise<string[]> {
    const commonPorts = [11434, 11435, 11436];
    const commonHosts = ['localhost', '127.0.0.1'];
    const discovered: string[] = [];
    
    const checkPromises = commonHosts.flatMap(host =>
      commonPorts.map(async port => {
        const url = `http://${host}:${port}`;
        try {
          const health = await this.checkHealth(url);
          if (health.status === 'healthy') {
            discovered.push(url);
          }
        } catch {
          // Ignore failed checks
        }
      })
    );
    
    await Promise.allSettled(checkPromises);
    return discovered;
  }
  
  /**
   * Get model recommendations based on use case
   */
  static getModelRecommendations(useCase: 'chat' | 'code' | 'creative' | 'analysis'): {
    recommended: string[];
    description: string;
  } {
    switch (useCase) {
      case 'chat':
        return {
          recommended: ['llama2', 'mistral', 'vicuna', 'openchat'],
          description: 'Best for conversational AI and general Q&A'
        };
      case 'code':
        return {
          recommended: ['codellama', 'codellama:13b', 'phind-codellama', 'wizardcoder'],
          description: 'Optimized for code generation and programming tasks'
        };
      case 'creative':
        return {
          recommended: ['mistral', 'mixtral', 'neural-chat', 'starling-lm'],
          description: 'Great for creative writing and storytelling'
        };
      case 'analysis':
        return {
          recommended: ['mixtral:8x7b', 'llama2:70b', 'qwen:14b'],
          description: 'Powerful models for complex analysis and reasoning'
        };
      default:
        return {
          recommended: ['llama2', 'mistral'],
          description: 'General purpose models'
        };
    }
  }
  
  /**
   * Get model performance info
   */
  static getModelPerformanceInfo(modelName: string): {
    size: string;
    speed: 'fast' | 'medium' | 'slow';
    quality: 'good' | 'better' | 'best';
    use_case: string[];
  } {
    const name = modelName.toLowerCase();
    
    // Extract model size if specified
    const sizeMatch = name.match(/:(\d+)b/);
    const parameterSize = sizeMatch ? parseInt(sizeMatch[1]) : null;
    
    if (name.includes('codellama')) {
      return {
        size: parameterSize ? `${parameterSize}B` : '7B',
        speed: parameterSize && parameterSize > 13 ? 'slow' : 'medium',
        quality: parameterSize && parameterSize > 13 ? 'best' : 'better',
        use_case: ['code', 'programming', 'debugging']
      };
    }
    
    if (name.includes('mixtral')) {
      return {
        size: '8x7B',
        speed: 'slow',
        quality: 'best',
        use_case: ['analysis', 'reasoning', 'creative']
      };
    }
    
    if (name.includes('mistral')) {
      return {
        size: '7B',
        speed: 'fast',
        quality: 'better',
        use_case: ['chat', 'creative', 'general']
      };
    }
    
    if (name.includes('llama2')) {
      const size = parameterSize || 7;
      return {
        size: `${size}B`,
        speed: size > 13 ? 'slow' : size > 7 ? 'medium' : 'fast',
        quality: size > 13 ? 'best' : size > 7 ? 'better' : 'good',
        use_case: ['chat', 'general', 'analysis']
      };
    }
    
    if (name.includes('orca-mini')) {
      return {
        size: '3B',
        speed: 'fast',
        quality: 'good',
        use_case: ['chat', 'quick responses']
      };
    }
    
    if (name.includes('phi')) {
      return {
        size: '2.7B',
        speed: 'fast',
        quality: 'good',
        use_case: ['chat', 'mobile', 'edge']
      };
    }
    
    // Default for unknown models
    return {
      size: 'Unknown',
      speed: 'medium',
      quality: 'good',
      use_case: ['general']
    };
  }
  
  /**
   * Validate Ollama server URL format
   */
  static validateServerUrl(url: string): {
    isValid: boolean;
    error?: string;
    suggestion?: string;
  } {
    try {
      const urlObj = new URL(url);
      
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          isValid: false,
          error: 'URL must use HTTP or HTTPS protocol',
          suggestion: `Try: http://${url.replace(/^.*:\/\//, '')}`
        };
      }
      
      if (!urlObj.hostname) {
        return {
          isValid: false,
          error: 'Invalid hostname',
          suggestion: 'Example: http://localhost:11434'
        };
      }
      
      // Common Ollama port
      if (!urlObj.port && urlObj.hostname === 'localhost') {
        return {
          isValid: true,
          suggestion: 'Consider adding port :11434 for clarity'
        };
      }
      
      return { isValid: true };
    } catch {
      return {
        isValid: false,
        error: 'Invalid URL format',
        suggestion: 'Example: http://localhost:11434'
      };
    }
  }
  
  /**
   * Get cached models (with simple localStorage caching)
   */
  static getCachedModels(baseUrl: string): string[] | null {
    try {
      const cached = localStorage.getItem(`ollama_models_${baseUrl}`);
      if (cached) {
        const { models, timestamp } = JSON.parse(cached);
        // Cache for 5 minutes
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return models;
        }
      }
    } catch {
      // Ignore cache errors
    }
    return null;
  }
  
  /**
   * Cache models
   */
  static cacheModels(baseUrl: string, models: string[]): void {
    try {
      localStorage.setItem(`ollama_models_${baseUrl}`, JSON.stringify({
        models,
        timestamp: Date.now()
      }));
    } catch {
      // Ignore cache errors
    }
  }
  
  /**
   * Get models with caching
   */
  static async getModelsWithCache(baseUrl: string): Promise<string[]> {
    // Try cache first
    const cached = this.getCachedModels(baseUrl);
    if (cached) {
      return cached;
    }
    
    // Fetch from server
    const serverInfo = await this.getAvailableModels(baseUrl);
    if (serverInfo.status === 'connected') {
      this.cacheModels(baseUrl, serverInfo.models);
      return serverInfo.models;
    }
    
    return [];
  }
  
  /**
   * Generate response using Ollama LLM
   */
  static async generateResponse(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    try {
      const response = await fetch(`${this.baseApiUrl}/generate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ollama generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate response with variable substitution
   */
  static async generateWithVariables(
    baseUrl: string,
    model: string,
    promptTemplate: string,
    systemTemplate?: string,
    variables: Record<string, any> = {},
    options: {
      temperature?: number;
      top_p?: number;
      top_k?: number;
      num_predict?: number;
      repeat_penalty?: number;
      stream?: boolean;
    } = {}
  ): Promise<OllamaGenerateResponse> {
    // Apply variable substitution to prompt
    let finalPrompt = promptTemplate;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      finalPrompt = finalPrompt.replace(regex, valueStr);
    });
    
    // Apply variable substitution to system message
    let finalSystemMessage = systemTemplate;
    if (systemTemplate) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        finalSystemMessage = finalSystemMessage?.replace(regex, valueStr) || '';
      });
    }
    
    const request: OllamaGenerateRequest = {
      base_url: baseUrl,
      model,
      prompt: finalPrompt,
      system_message: finalSystemMessage,
      temperature: options.temperature || 0.7,
      top_p: options.top_p || 0.9,
      top_k: options.top_k || 40,
      num_predict: options.num_predict || 1000,
      repeat_penalty: options.repeat_penalty || 1.1,
      stream: options.stream || false
    };
    
    return await this.generateResponse(request);
  }
}

export default OllamaService;