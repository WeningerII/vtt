/**
 * Authentication Provider - Manages user authentication state and flows
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { logger } from '@vtt/logging';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  role: 'admin' | 'moderator' | 'gamemaster' | 'player' | 'guest';
  permissions: string[];
  subscription: 'free' | 'basic' | 'premium' | 'enterprise';
  isEmailVerified: boolean;
  lastLogin: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (_email: string, _password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  loginWithProvider: (_provider: 'discord' | 'google') => void;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  displayName?: string;
  avatarUrl?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
  serverUrl: string;
}

export function AuthProvider({ children, serverUrl }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setUser = useCallback((user: User | null) => {
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null
    }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(`${serverUrl}/auth/me`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData.user);
        } else {
          // Clear any stale tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
        }
      } catch (error) {
        logger.error('Auth check failed:', error);
        setUser(null);
      }
    };

    checkAuthStatus();
  }, [serverUrl, setUser]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    clearError();

    try {
      const response = await fetch(`${serverUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store tokens
      if (data.tokens) {
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
      }

      setUser(data.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    }
  }, [serverUrl, setLoading, clearError, setError, setUser]);

  const register = useCallback(async (data: RegisterData) => {
    setLoading(true);
    clearError();

    try {
      const response = await fetch(`${serverUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, acceptTerms: true })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      // Auto-login after successful registration
      if (result.tokens) {
        localStorage.setItem('accessToken', result.tokens.accessToken);
        localStorage.setItem('refreshToken', result.tokens.refreshToken);
        setUser(result.user);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
    }
  }, [serverUrl, setLoading, clearError, setError, setUser]);

  const logout = useCallback(async () => {
    setLoading(true);

    try {
      await fetch(`${serverUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        }
      });
    } catch (error) {
      logger.error('Logout request failed:', error);
    } finally {
      // Clear local state regardless of server response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  }, [serverUrl, setLoading, setUser]);

  const loginWithProvider = useCallback((provider: 'discord' | 'google') => {
    // Redirect to OAuth provider
    window.location.href = `${serverUrl}/auth/${provider}`;
  }, [serverUrl]);

  const refreshAuth = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      setUser(null);
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();

      if (response.ok && data.tokens) {
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        
        // Fetch updated user data
        const userResponse = await fetch(`${serverUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.tokens.accessToken}`
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.user);
        }
      } else {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      }
    } catch (error) {
      logger.error('Token refresh failed:', error);
      setUser(null);
    }
  }, [serverUrl, setUser]);

  // Set up token refresh interval
  useEffect(() => {
    if (state.isAuthenticated) {
      const interval = setInterval(() => {
        refreshAuth();
      }, 5 * 60 * 1000); // Refresh every 5 minutes

      return () => clearInterval(interval);
    }
  }, [state.isAuthenticated, refreshAuth]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    register,
    loginWithProvider,
    refreshAuth,
    clearError
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
