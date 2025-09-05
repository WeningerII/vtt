/**
 * Comprehensive error boundary components for the VTT application
 * Provides user-friendly error messages and fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string; // Context for better error messages
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorType {
  title: string;
  message: string;
  icon: string;
  recoverable: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error:", error, errorInfo);
    
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportErrorToService(error, errorInfo);
    }
  }

  private reportErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // This would integrate with your monitoring service (e.g., Sentry, LogRocket)
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Send to monitoring service
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData)
    }).catch(() => {
      // Silently fail if error reporting fails
    });
  };

  private getErrorType = (): ErrorType => {
    const error = this.state.error;
    if (!error) {return this.getDefaultErrorType();}

    const errorMessage = error.message.toLowerCase();

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return {
        title: "Connection Error",
        message: "Unable to connect to the game servers. Please check your internet connection and try again.",
        icon: "🌐",
        recoverable: true,
      };
    }

    // WebSocket errors
    if (errorMessage.includes('websocket') || errorMessage.includes('ws://')) {
      return {
        title: "Real-time Connection Lost",
        message: "Lost connection to the game. Attempting to reconnect...",
        icon: "⚡",
        recoverable: true,
      };
    }

    // Character/Campaign related errors
    if (this.props.context?.includes('character') || errorMessage.includes('character')) {
      return {
        title: "Character Error",
        message: "There was a problem loading or updating your character. Your progress has been saved.",
        icon: "🎭",
        recoverable: true,
      };
    }

    // Map/Combat related errors
    if (this.props.context?.includes('map') || this.props.context?.includes('combat')) {
      return {
        title: "Battle Map Error",
        message: "There was a problem with the battle map. You can continue playing, but some features may be limited.",
        icon: "🗺️",
        recoverable: true,
      };
    }

    // AI/Generation errors
    if (errorMessage.includes('ai') || errorMessage.includes('generation') || errorMessage.includes('openai')) {
      return {
        title: "AI Service Unavailable",
        message: "The AI assistant is temporarily unavailable. You can continue playing without AI features.",
        icon: "🤖",
        recoverable: true,
      };
    }

    return this.getDefaultErrorType();
  };

  private getDefaultErrorType = (): ErrorType => ({
    title: "Unexpected Error",
    message: "Something unexpected happened. The game is still running, but you may need to refresh the page.",
    icon: "⚠️",
    recoverable: true,
  });

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorType = this.getErrorType();

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <div className="max-w-md w-full p-6 bg-gray-800 rounded-lg shadow-xl border border-gray-700">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3" role="img" aria-label="Error icon">
                {errorType.icon}
              </span>
              <h1 className="text-xl font-bold text-red-400">
                {errorType.title}
              </h1>
            </div>
            
            <p className="mb-6 text-gray-300 leading-relaxed">
              {errorType.message}
            </p>

            <div className="flex gap-3 mb-6">
              {errorType.recoverable && (
                <button
                  onClick={this.handleReset}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors font-medium"
                  aria-label="Try again after error"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={this.handleRefresh}
                className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors font-medium"
                aria-label="Refresh page"
              >
                Refresh Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mb-4 text-xs text-gray-400 bg-gray-900 rounded p-3">
                <summary className="cursor-pointer hover:text-gray-300 font-medium">
                  Error Details (Development Only)
                </summary>
                <div className="mt-3 space-y-2">
                  <div>
                    <strong>Error:</strong>
                    <pre className="mt-1 text-red-300 overflow-auto whitespace-pre-wrap">
                      {this.state.error?.toString()}
                    </pre>
                  </div>
                  {this.state.error?.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <p className="text-xs text-gray-500 text-center">
              Error ID: {Date.now().toString(36)}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
