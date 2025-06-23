import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiService } from '@/services/api';
import type { LoginRequest, TokenPair, User } from '@/types/auth';

// Authentication state type
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

// Authentication actions type
interface AuthActions {
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  setTokens: (tokens: TokenPair) => void;
  clearError: () => void;
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Combined auth store type
type AuthStore = AuthState & AuthActions;

// Initial authentication state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
};

// Create Zustand store with persistence
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Login action
      login: async (credentials: LoginRequest): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.login(credentials);

          if (response.success && response.data) {
            const { access_token, refresh_token, token_type, user } = response.data;

            // Store tokens in localStorage
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);

            set({
              isAuthenticated: true,
              accessToken: access_token,
              refreshToken: refresh_token,
              user: user, // Set user data directly from login response
              isLoading: false,
              error: null,
            });

            return true;
          } else {
            set({
              isLoading: false,
              error: response.error || 'Login failed',
            });
            return false;
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'An error occurred during login',
          });
          return false;
        }
      },

      // Logout action
      logout: async (): Promise<void> => {
        set({ isLoading: true });

        try {
          await apiService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear local state
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');

          set({
            ...initialState,
            isLoading: false,
          });
        }
      },

      // Set tokens action
      setTokens: (tokens: TokenPair): void => {
        const { access_token, refresh_token } = tokens;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        set({
          isAuthenticated: true,
          accessToken: access_token,
          refreshToken: refresh_token,
        });
      },

      // Clear error action
      clearError: (): void => {
        set({ error: null });
      },

      // Initialize authentication state
      initializeAuth: async (): Promise<void> => {
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');

        if (accessToken && refreshToken) {
          set({
            isAuthenticated: true,
            accessToken,
            refreshToken,
          });

          // Skip user refresh on initialization to avoid auth server errors
          // User data will be set during login or can be refreshed manually if needed
        } else {
          set({ isAuthenticated: false });
        }
      },

      // Refresh user information (optional - only call when needed)
      refreshUser: async (): Promise<void> => {
        // Skip this for now to avoid auth server schema issues
        // User data is already set during login
        console.log('User refresh skipped - using login data');
      },
    }),
    {
      name: 'flowstudio-auth-storage',
      // Exclude tokens from persist (stored separately in localStorage)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Convenience selector for authentication state
export const useAuth = () => {
  const store = useAuthStore();
  return {
    isAuthenticated: store.isAuthenticated,
    user: store.user,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    clearError: store.clearError,
    initializeAuth: store.initializeAuth,
  };
};

// Authenticated user selector
export const useAuthenticatedUser = () => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    throw new Error('User is not authenticated');
  }

  return user;
};

export default useAuthStore;