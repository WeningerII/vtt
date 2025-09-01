/**
 * Production-Grade Error Boundary System
 * Provides graceful error handling and recovery for VTT components
 */

import React, { Component, ErrorInfo, ReactNode, PropsWithChildren } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { AlertTriangle, RotateCcw, Home, Settings } from './Icons';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  showDetails?: boolean;
  allowRetry?: boolean;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  level?: 'page' | 'section' | 'component';
  name?: string;
}

interface ErrorDetailsProps {
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  onToggle: () => void;
  isOpen: boolean;
}

const ErrorDetails: React.FC<ErrorDetailsProps> = ({ 
  error, 
  errorInfo, 
  errorId, 
  onToggle, 
  isOpen 
}) => (
  <div className="mt-4 space-y-3">
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="flex items-center gap-2 text-text-secondary"
    >
      <Bug className="h-4 w-4" />
      {isOpen ? 'Hide Details' : 'Show Technical Details'}
    </Button>
    
    {isOpen && (
      <Card className="border-border-error bg-bg-error/10 p-4">
        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium text-text-error mb-1">Error ID</h4>
            <code className="text-xs bg-bg-secondary px-2 py-1 rounded font-mono">
              {errorId}
            </code>
          </div>
          
          <div>
            <h4 className="font-medium text-text-error mb-1">Error Message</h4>
            <code className="text-xs bg-bg-secondary px-2 py-1 rounded font-mono block">
              {error.message}
            </code>
          </div>
          
          <div>
            <h4 className="font-medium text-text-error mb-1">Stack Trace</h4>
            <pre className="text-xs bg-bg-secondary px-3 py-2 rounded overflow-auto max-h-32 font-mono">
              {error.stack}
            </pre>
          </div>
          
          {errorInfo.componentStack && (
            <div>
              <h4 className="font-medium text-text-error mb-1">Component Stack</h4>
              <pre className="text-xs bg-bg-secondary px-3 py-2 rounded overflow-auto max-h-32 font-mono">
                {errorInfo.componentStack}
              </pre>
            </div>
          )}
        </div>
      </Card>
    )}
  </div>
);

const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const logErrorToService = (error: Error, errorInfo: ErrorInfo, errorId: string, level: string, name?: string) => {
  // In production, send to error tracking service (Sentry, LogRocket, etc.)
  const errorData = {
    errorId,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    level,
    component: name,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  console.group(`🚨 Error Boundary [${level}${name ? `: ${name}` : ''}]`);
  console.error('Error ID:', errorId);
  console.error('Error:', error);
  console.error('Component Stack:', errorInfo.componentStack);
  console.error('Full Error Data:', errorData);
  console.groupEnd();

  // TODO: Integrate with error tracking service
  // errorTrackingService.captureException(error, { extra: errorData });
};

export class ErrorBoundary extends Component<
  PropsWithChildren<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component', name } = this.props;
    const errorId = this.state.errorId || generateErrorId();

    this.setState({
      errorInfo,
      errorId,
    });

    // Log error to monitoring service
    logErrorToService(error, errorInfo, errorId, level, name);

    // Call custom error handler
    onError?.(error, errorInfo, errorId);
  }

  componentDidUpdate(prevProps: PropsWithChildren<ErrorBoundaryProps>) {
    const { resetOnPropsChange, children } = this.props;
    const { hasError } = this.state;

    // Auto-reset on props change if enabled
    if (hasError && resetOnPropsChange && prevProps.children !== children) {
      this.handleReset();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: '',
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { 
      hasError, 
      error, 
      errorInfo, 
      errorId, 
      retryCount 
    } = this.state;
    
    const {
      fallback,
      showDetails = process.env.NODE_ENV === 'development',
      allowRetry = true,
      maxRetries = 3,
      level = 'component',
      name,
      children,
    } = this.props;

    if (hasError && error && errorInfo) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      const canRetry = allowRetry && retryCount < maxRetries;
      const [showDetailsOpen, setShowDetailsOpen] = React.useState(false);

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
          <Card className="max-w-lg w-full border-border-error">
            <div className="p-6 space-y-4">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="p-3 bg-bg-error/20 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-text-error" />
                </div>
              </div>

              {/* Error Message */}
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-text-primary">
                  {level === 'page' ? 'Page Error' : 
                   level === 'section' ? 'Section Unavailable' : 
                   'Something went wrong'}
                </h2>
                
                <p className="text-text-secondary">
                  {level === 'page' 
                    ? 'The page encountered an error and could not be displayed.'
                    : level === 'section'
                    ? 'This section is temporarily unavailable due to an error.'
                    : 'A component error occurred. The rest of the application should continue working.'
                  }
                </p>

                {name && (
                  <p className="text-sm text-text-muted">
                    Component: {name}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {canRetry && (
                  <Button
                    onClick={this.handleRetry}
                    variant="primary"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again {retryCount > 0 && `(${retryCount}/${maxRetries})`}
                  </Button>
                )}

                {level === 'page' && (
                  <Button
                    onClick={this.handleGoHome}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                )}

                {level !== 'page' && (
                  <Button
                    onClick={() => window.location.reload()}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>
                )}
              </div>

              {/* Error Details */}
              {showDetails && (
                <ErrorDetails
                  error={error}
                  errorInfo={errorInfo}
                  errorId={errorId}
                  onToggle={() => setShowDetailsOpen(!showDetailsOpen)}
                  isOpen={showDetailsOpen}
                />
              )}

              {/* Retry Limit Message */}
              {!canRetry && allowRetry && (
                <div className="text-sm text-text-warning bg-bg-warning/10 px-3 py-2 rounded border border-border-warning">
                  Maximum retry attempts reached. Please reload the page.
                </div>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return <>{children}</>;
  }
}

// Higher-order component for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Specialized error boundaries for different use cases
export const PageErrorBoundary: React.FC<PropsWithChildren<Omit<ErrorBoundaryProps, 'level'>>> = (props) => (
  <ErrorBoundary {...props} level="page" />
);

export const SectionErrorBoundary: React.FC<PropsWithChildren<Omit<ErrorBoundaryProps, 'level'>>> = (props) => (
  <ErrorBoundary {...props} level="section" />
);

export const ComponentErrorBoundary: React.FC<PropsWithChildren<Omit<ErrorBoundaryProps, 'level'>>> = (props) => (
  <ErrorBoundary {...props} level="component" />
);

export default ErrorBoundary;
