/**
 * Specific error boundary components for different parts of the VTT application
 * Provides context-specific error handling and recovery
 */

import React, { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

// Character-specific error boundary
export const CharacterErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="character"
    onError={(error, errorInfo) => {
      // Log character-specific error details
      console.error("Character error:", { error, errorInfo });
    }}
    fallback={
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <div className="flex items-center">
          <span className="text-red-500 text-lg mr-2">🎭</span>
          <h3 className="text-red-800 font-medium">Character Loading Error</h3>
        </div>
        <p className="text-red-700 mt-2">
          There was a problem loading your character data. Please try refreshing the page.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Map/Battle Map error boundary
export const MapErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="map"
    onError={(error, errorInfo) => {
      console.error("Map error:", { error, errorInfo });
    }}
    fallback={
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="flex items-center">
          <span className="text-yellow-600 text-lg mr-2">🗺️</span>
          <h3 className="text-yellow-800 font-medium">Battle Map Error</h3>
        </div>
        <p className="text-yellow-700 mt-2">
          The battle map encountered an error. Combat features may be limited until you refresh.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Combat-specific error boundary
export const CombatErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="combat"
    onError={(error, errorInfo) => {
      console.error("Combat error:", { error, errorInfo });
    }}
    fallback={
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-md">
        <div className="flex items-center">
          <span className="text-orange-600 text-lg mr-2">⚔️</span>
          <h3 className="text-orange-800 font-medium">Combat System Error</h3>
        </div>
        <p className="text-orange-700 mt-2">
          There was an issue with the combat system. Manual dice rolling is still available.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// AI Assistant error boundary
export const AIErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="ai"
    onError={(error, errorInfo) => {
      console.error("AI service error:", { error, errorInfo });
    }}
    fallback={
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-center">
          <span className="text-blue-600 text-lg mr-2">🤖</span>
          <h3 className="text-blue-800 font-medium">AI Assistant Unavailable</h3>
        </div>
        <p className="text-blue-700 mt-2">
          The AI assistant is temporarily unavailable. You can continue playing without AI features.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Network/API error boundary
export const NetworkErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="network"
    onError={(error, errorInfo) => {
      console.error("Network error:", { error, errorInfo });
    }}
    fallback={
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <div className="flex items-center">
          <span className="text-red-500 text-lg mr-2">🌐</span>
          <h3 className="text-red-800 font-medium">Connection Error</h3>
        </div>
        <p className="text-red-700 mt-2">
          Unable to connect to the game servers. Please check your internet connection.
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);
