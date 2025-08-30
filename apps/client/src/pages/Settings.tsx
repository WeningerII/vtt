/**
 * Settings Page - User preferences and application configuration
 */

import React from "react";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

interface SettingsProps {
  router: {
    navigate: (_path: string) => void;
    currentPath: string;
  };
}

export function Settings({ router }: SettingsProps) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Settings</h1>
          <p className="text-text-secondary mb-6">
            User settings and preferences will be implemented in future development phases.
          </p>
          <LoadingSpinner size="lg" showLabel label="Loading settings..." />
        </div>
      </div>
    </div>
  );
}
