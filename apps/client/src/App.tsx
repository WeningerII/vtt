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
import { I18nProvider } from "@vtt/i18n";

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
          serverUrl: import.meta.env?.VITE_SERVER_URL || "http://localhost:3001",
          wsUrl: import.meta.env?.VITE_WS_URL || "ws://localhost:3001",
          version: import.meta.env?.VITE_APP_VERSION || "1.0.0",
          environment: import.meta.env?.MODE === "production" ? "production" : "development",
        };

        // Global error handlers
        window.addEventListener("error", (event) => {
          logger.error("Global error:", event.error);
        });

        window.addEventListener("unhandledrejection", (event) => {
          logger.error("Unhandled promise rejection:", event.reason);
        });

        // Performance monitoring in development
        if (appConfig.environment === "development") {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              logger.info("Performance:", entry.name, entry.duration + "ms");
            }
          });
          observer.observe({ entryTypes: ["measure", "navigation"] });
        }

        setConfig(appConfig);
      } catch (error) {
        logger.error("Failed to initialize application:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
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
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
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
    </ErrorBoundary>
  );
}
