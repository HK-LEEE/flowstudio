export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  created_at?: string;
  is_active?: boolean;
  is_admin?: boolean;
  is_verified?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}