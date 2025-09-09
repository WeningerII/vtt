/**
 * Streamlined Error Boundary for Production VTT
 */

import React, { Component, ReactNode, PropsWithChildren } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { AlertTriangle, RotateCcw } from './Icons';

interface Props {
  fallback?: ReactNode;
  onError?: (error: Error) => void;
  name: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SimpleErrorBoundary extends Component<PropsWithChildren<Props>, State> {
  constructor(props: PropsWithChildren<Props>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error) {
    // Error logged: ErrorBoundary [${this.props.name}]
    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6 text-center border-red-200 bg-red-50">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-4">
            The {this.props.name} component encountered an error.
          </p>
          <Button onClick={this.handleRetry} variant="primary" className="flex items-center gap-2 mx-auto">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}

export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  name?: string
) => {
  const WithErrorBoundaryComponent = (props: P) => (
    <SimpleErrorBoundary name={name || WrappedComponent.displayName || WrappedComponent.name || 'Unknown'}>
      <WrappedComponent {...props} />
    </SimpleErrorBoundary>
  );
  
  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  return WithErrorBoundaryComponent;
};

export default SimpleErrorBoundary;
