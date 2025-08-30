/**
 * Authentication Hook - Manages user authentication state and operations
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { logger } from '@vtt/logging';
// User interface imported from lucide-react conflicts with our User type
import { _apiClient as apiClient } from '../lib/api-client';

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  role: string;
  subscription?: {
    tier: string;
    status: string;
    currentPeriodEnd?: string;
  };
  createdAt: string;
  lastLoginAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  
  // Authentication methods
  login: (_identifier: string, _password: string, _rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  
  // Password management
  requestPasswordReset: (_email: string) => Promise<void>;
  resetPassword: (_token: string, _newPassword: string) => Promise<void>;
  changePassword: (_currentPassword: string, _newPassword: string) => Promise<void>;
  
  // Email verification
  verifyEmail: (_token: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  
  // Profile management
  updateProfile: (data: Partial<User>) => Promise<void>;
  
  // Utility methods
  clearError: () => void;
  isAuthenticated: boolean;
  hasRole: (_role: string) => boolean;
  hasSubscription: (_tier?: string) => boolean;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  timezone?: string;
  acceptedTerms: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clear error helper
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check if user is authenticated
  const isAuthenticated = Boolean(user);

  // Check if user has specific role
  const hasRole = useCallback((role: string) => {
    return user?.role === role;
  }, [user]);

  // Check if user has active subscription
  const hasSubscription = useCallback((tier?: string) => {
    if (!user?.subscription) return false;
    if (user.subscription.status !== 'active') return false;
    if (tier && user.subscription.tier !== tier) return false;
    return true;
  }, [user]);

  // Login function
  const login = useCallback(async (identifier: string, password: string, rememberMe = false) => {
    try {
      setLoading(true);
      clearError();
      
      const response = await apiClient.post('/auth/login', {
        identifier,
        password,
        rememberMe,
      });

      if (response.data?.success && (response as any).data?.user) {
        setUser((response as any).data.user);
        // Store session token if provided
        if ((response as any).data?.session?.token) {
          localStorage.setItem('sessionToken', (response as any).data.session.token);
        }
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Register function
  const register = useCallback(async (data: RegisterData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.post('/auth/register', data);

      if (response.data.success) {
        setUser(response.data.user);
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Registration failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await apiClient.post('/auth/logout');
    } catch (err) {
      logger.error('Logout error:', err);
    } finally {
      setUser(null);
      setError(null);
      setLoading(false);
      localStorage.removeItem('sessionToken');
    }
  }, []);

  // Refresh authentication state
  const refreshAuth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/auth/me');

      if (response.data.success) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      logger.error('Auth refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Request password reset
  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      setLoading(true);
      setError(null);

      await apiClient.post('/auth/reset-password', { email });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Password reset request failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset password with token
  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    try {
      setLoading(true);
      clearError();
      
      const response = await apiClient.post('/auth/reset-password', {
        token,
        newPassword,
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Password reset failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Change password (authenticated user)
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true);
      clearError();
      
      const response = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Password change failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
      refreshAuth();
    }
  }, [refreshAuth]);

  // Verify email with token
  const verifyEmail = useCallback(async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      await apiClient.post('/auth/verify-email', { token });
      
      // Refresh user data to get updated emailVerified status
      await refreshAuth();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Email verification failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [refreshAuth]);

  // Resend email verification
  const resendVerification = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await apiClient.post('/auth/verify-email/resend');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to resend verification email';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (data: Partial<User>) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.put('/auth/me', data);

      if (response.data.success) {
        setUser(response.data.user);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Profile update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Set up axios interceptors for auth
  useEffect(() => {
    // Set up request interceptor to add auth token
    if ('interceptors' in apiClient) {
      (apiClient as any).interceptors.request.use((config: any) => {
        const token = localStorage.getItem('sessionToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      });
    }

    // Set up response interceptor to handle auth errors
    const responseInterceptor = (apiClient as any).interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && user) {
          // Token expired, try to refresh or logout
          setUser(null);
          setError('Session expired. Please log in again.');
        }
        return Promise.reject(error);
      }
      );
    }

    return () => {
      if ('interceptors' in apiClient) {
        (apiClient as any).interceptors.response.eject(responseInterceptor);
      }
    };
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshAuth,
    requestPasswordReset,
    resetPassword,
    changePassword,
    verifyEmail,
    resendVerification,
    updateProfile,
    clearError,
    isAuthenticated,
    hasRole,
    hasSubscription,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { User, RegisterData, AuthContextType };
