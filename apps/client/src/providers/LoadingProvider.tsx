/**
 * Loading Provider Component
 * Manages global loading states across the VTT application
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { LoadingScreen } from '../components/vtt/LoadingScreen';

interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
  error?: string | Error | null;
}

interface LoadingContextValue {
  globalLoading: LoadingState;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  setGlobalError: (error: string | Error | null) => void;
  clearGlobalError: () => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

interface LoadingProviderProps {
  children: React.ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [globalLoading, setGlobalLoadingState] = useState<LoadingState>({
    isLoading: false,
    error: null,
  });

  const setGlobalLoading = useCallback((loading: boolean, message?: string) => {
    setGlobalLoadingState(prev => {
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

  const setGlobalError = useCallback((error: string | Error | null) => {
    setGlobalLoadingState(prev => ({
      ...prev,
      isLoading: false,
      error,
    }));
  }, []);

  const clearGlobalError = useCallback(() => {
    setGlobalLoadingState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  const contextValue: LoadingContextValue = {
    globalLoading,
    setGlobalLoading,
    setGlobalError,
    clearGlobalError,
  };

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
      
      {/* Global loading overlay */}
      {globalLoading.isLoading && (
        <LoadingScreen
          message={globalLoading.loadingMessage || 'Loading...'}
          variant="overlay"
          showSpinner
        />
      )}
      
      {/* Global error overlay */}
      {globalLoading.error && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-6 max-w-md mx-4 text-center space-y-4">
            <div className="text-error text-xl font-semibold">Error</div>
            <p className="text-text-secondary">
              {globalLoading.error instanceof Error 
                ? globalLoading.error.message 
                : globalLoading.error}
            </p>
            <button
              onClick={clearGlobalError}
              className="bg-accent-primary hover:bg-accent-secondary text-text-primary px-4 py-2 rounded-lg transition-colors gaming-touch-target"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useGlobalLoading must be used within LoadingProvider');
  }
  return context;
}
