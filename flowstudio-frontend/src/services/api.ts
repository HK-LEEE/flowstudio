import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import type { ApiResponse, TokenPair, LoginRequest } from '@/types/auth';

class ApiService {
  private axiosInstance: AxiosInstance;
  private authAxiosInstance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    // FlowStudio business logic API (via proxy to port 8003)
    this.axiosInstance = axios.create({
      baseURL: '/api/fs',  // Vite proxy will route to localhost:8003
      timeout: 30000,  // Increased timeout to 30 seconds for component templates loading
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Authentication API (via proxy to port 8000)
    this.authAxiosInstance = axios.create({
      baseURL: '/api/auth',  // Vite proxy will route to localhost:8000
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - automatically add access token (FlowStudio API)
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Request interceptor - automatically add access token (Auth API)
    this.authAxiosInstance.interceptors.request.use(
      (config) => {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh (disabled for FlowStudio)
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        // Skip automatic token refresh to avoid auth server issues
        // FlowStudio uses tokens from login response only
        console.warn('API request failed:', error.response?.status, error.response?.data);
        
        if (error.response?.status === 401) {
          console.warn('Unauthorized access - redirecting to login');
          this.clearTokens();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });

    this.failedQueue = [];
  }

  private async refreshAccessToken(refreshToken: string): Promise<AxiosResponse<TokenPair>> {
    // Disabled to avoid auth server schema issues
    throw new Error('Token refresh disabled for FlowStudio');
  }

  private clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete this.axiosInstance.defaults.headers.common.Authorization;
    delete this.authAxiosInstance.defaults.headers.common.Authorization;
  }

  // Authentication endpoints (using authAxiosInstance via proxy)
  async login(credentials: LoginRequest): Promise<ApiResponse<TokenPair>> {
    try {
      const response = await this.authAxiosInstance.post('/login', {  // baseURL already includes /api/auth
        email: credentials.email,
        password: credentials.password,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Login failed',
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authAxiosInstance.post('/logout');  // baseURL already includes /api/auth
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    // Skip API call to avoid schema validation errors
    // User data is already available from login response
    return {
      success: false,
      error: 'getCurrentUser disabled - using login data instead',
    };
  }

  // FlowStudio business logic endpoints (using axiosInstance via proxy)
  async getFlows(): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.axiosInstance.get('/flows');  // baseURL already includes /api/fs
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async createFlow(flow: { name: string; description?: string }): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post('/flows', flow);  // baseURL already includes /api/fs
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async getFlow(flowId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.get(`/flows/${flowId}`);  // baseURL already includes /api/fs
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async saveFlow(flowId: string, flowData: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.put(`/flows/${flowId}`, {  // baseURL already includes /api/fs
        flow_data: flowData,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async deleteFlow(flowId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.delete(`/flows/${flowId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async publishFlow(flowId: string, publishData?: { version?: string; is_public?: boolean }): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post(`/flows/${flowId}/publish`, publishData || {});
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async createFlowVersion(flowId: string, version?: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post(`/flows/${flowId}/publish`, {
        version: version || undefined
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  async duplicateFlow(flowId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.axiosInstance.post(`/flows/${flowId}/duplicate`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  // Get raw axios instance for advanced usage
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;