/**
 * Standardized Loading State Hook
 * Provides consistent loading patterns across all components
 */

import { useState, useCallback, createContext, useContext } from 'react';

export interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
  error?: string | Error | null;
}

export interface UseLoadingStateReturn extends LoadingState {
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: string | Error | null) => void;
  clearError: () => void;
  withLoading: <T>(
    fn: () => Promise<T>,
    message?: string
  ) => Promise<T>;
  reset: () => void;
}

/**
 * Hook for managing loading states with consistent patterns
 */
export function useLoadingState(
  initialMessage?: string
): UseLoadingStateReturn {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    ...(initialMessage !== undefined ? { loadingMessage: initialMessage } : {}),
    error: null,
  });

  const setLoading = useCallback((loading: boolean, message?: string) => {
    setState(prev => {
      const next: LoadingState = {
        ...prev,
        isLoading: loading,
        error: loading ? null : (prev.error ?? null), // Clear error when starting new load
      };
      if (message !== undefined) {
        next.loadingMessage = message;
      }
      return next;
    });
  }, []);

  const setError = useCallback((error: string | Error | null) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>, message?: string): Promise<T> => {
      try {
        setLoading(true, message);
        const result = await fn();
        setLoading(false);
        return result;
      } catch (error) {
        setError(error as Error);
        throw error;
      }
    },
    [setLoading, setError]
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      ...(initialMessage !== undefined ? { loadingMessage: initialMessage } : {}),
      error: null,
    });
  }, [initialMessage]);

  return {
    ...state,
    setLoading,
    setError,
    clearError,
    withLoading,
    reset,
  };
}

/**
 * Specialized loading states for common scenarios
 */

// Authentication loading states
export function useAuthLoadingState() {
  return useLoadingState('Authenticating...');
}

// Character loading states
export function useCharacterLoadingState() {
  return useLoadingState('Loading character...');
}

// Game session loading states
export function useGameLoadingState() {
  return useLoadingState('Connecting to game...');
}

// Campaign loading states
export function useCampaignLoadingState() {
  return useLoadingState('Loading campaign...');
}

// File upload loading states
export function useUploadLoadingState() {
  return useLoadingState('Uploading file...');
}

// API request loading states
export function useApiLoadingState(operation?: string) {
  return useLoadingState(operation ? `${operation}...` : 'Loading...');
}

/**
 * Loading state context for sharing across component tree
 */
export interface LoadingContextValue {
  globalLoading: LoadingState;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  setGlobalError: (error: string | Error | null) => void;
}

export const LoadingContext = createContext<LoadingContextValue | null>(null);

export function useGlobalLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useGlobalLoading must be used within LoadingProvider');
  }
  return context;
}
