import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="max-w-md p-8 bg-gray-800 rounded-lg shadow-xl">
            <h1 className="text-2xl font-bold mb-4 text-red-500">Something went wrong</h1>
            <p className="mb-4 text-gray-300">
              The game encountered an error. Please try refreshing the page.
            </p>
            <details className="mb-4 text-sm text-gray-400">
              <summary>Error details</summary>
              <pre className="mt-2 overflow-auto">{this.state.error?.toString()}</pre>
            </details>
            <button
              onClick={this.handleReset}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              aria-label="Try again after error"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
