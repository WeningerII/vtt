/**
 * Main VTT Application Component
 * Modern, production-ready Virtual Tabletop interface
 */

import React, { useEffect, useState } from "react";
import { logger } from "@vtt/logging";
import { AuthProvider } from "./providers/AuthProvider";
import { WebSocketProvider } from "./providers/WebSocketProvider";
import { GameProvider } from "./providers/GameProvider";
import { Router } from "./components/Router";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { ErrorBoundary } from "./components/ErrorBoundary";
// import { Toaster } from 'react-hot-toast';

// Import global styles
import "./styles/globals.css";
import "./styles/theme.css";
import "./styles/utilities.css";
// import { I18nProvider } from "@vtt/i18n";
// TODO: Implement i18n integration - using fallback provider for now
const I18nProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

interface AppConfig {
  serverUrl: string;
  wsUrl: string;
  version: string;
  environment: "development" | "production";
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize application configuration
    const initializeApp = async () => {
      try {
        // Load configuration from environment variables
        const appConfig: AppConfig = {
          serverUrl: (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:8080",
          wsUrl: (import.meta as any).env?.VITE_WS_URL || "ws://localhost:8080/ws",
          version: (import.meta as any).env?.VITE_APP_VERSION || "1.0.0",
          environment: (import.meta as any).env?.MODE === "production" ? "production" : "development",
        };

        setConfig(appConfig);
      } catch (error) {
        logger.error("Failed to initialize application:", error as any);
      } finally {
        setIsLoading(false);
      }
    };

    // Global error handlers
    const handleError = (event: ErrorEvent) => {
      // Never log empty objects - they crash React
      const error = event.error;
      if (error instanceof Error) {
        logger.error("Global error:", error);
      } else if (error && typeof error === 'object' && Object.keys(error).length > 0) {
        logger.error("Global error:", { message: error.message || 'Unknown error', details: error });
      } else {
        logger.error("Global error:", { message: event.message || 'Unknown global error' });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Never log empty objects - they crash React
      const reason = event.reason;
      if (reason instanceof Error) {
        logger.error("Unhandled promise rejection:", reason);
      } else if (reason && typeof reason === 'object' && Object.keys(reason).length > 0) {
        logger.error("Unhandled promise rejection:", { message: reason.message || 'Unknown rejection', details: reason });
      } else {
        logger.error("Unhandled promise rejection:", { message: String(reason) || 'Unknown promise rejection' });
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Performance monitoring in development
    let observer: PerformanceObserver | null = null;
    if ((import.meta as any).env?.MODE !== "production") {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.info(`Performance: ${entry.name} ${entry.duration}ms`);
        }
      });
      observer.observe({ entryTypes: ["measure", "navigation"] });
    }

    initializeApp();

    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <I18nProvider>
        <div className="app-loading">
          <LoadingSpinner
            size="2xl"
            variant="primary"
            showLabel
            label="Initializing VTT Platform..."
          />
        </div>
      </I18nProvider>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-error mb-4">Configuration Error</h1>
          <p className="text-text-secondary">
            Failed to load application configuration. Please check your environment settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider serverUrl={config.serverUrl}>
          <WebSocketProvider wsUrl={config.wsUrl}>
            <GameProvider>
              <div className="app">
                <Router />

              {/* Development info footer */}
              {config.environment === "development" && (
                <div className="dev-info">
                  VTT v{config.version} | {config.environment} | Server: {config.serverUrl} |
                  WebSocket: {config.wsUrl}
                </div>
              )}
              </div>

              {/* Toast notifications - will be implemented later */}
            </GameProvider>
          </WebSocketProvider>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
