/**
 * Campaign Browser Page - Browse and manage campaigns
 */

import React from "react";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

interface CampaignBrowserProps {
  campaignId?: string;
  router: {
    navigate: (path: string, replace?: boolean) => void;
    currentPath: string;
  };
}

export function CampaignBrowser({ campaignId, router }: CampaignBrowserProps) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4">
            Campaign Browser
            {campaignId && ` - ${campaignId}`}
          </h1>
          <p className="text-text-secondary mb-6">
            Campaign management features will be implemented in future development phases.
          </p>
          <LoadingSpinner size="lg" showLabel label="Loading campaigns..." />
        </div>
      </div>
    </div>
  );
}
