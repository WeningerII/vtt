/**
 * VTT Application Header Component
 * Displays scene name, user info, and connection status
 */

import React from 'react';

interface VTTHeaderProps {
  sceneName: string;
  userDisplayName: string;
  isGM: boolean;
  isConnected: boolean;
}

export const VTTHeader: React.FC<VTTHeaderProps> = ({
  sceneName,
  userDisplayName,
  isGM,
  isConnected,
}) => {
  return (
    <header className="bg-gray-800 p-4 border-b border-gray-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">{sceneName}</h1>
          <p className="text-sm text-gray-400">
            Connected as {userDisplayName} {isGM && "(GM)"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
            aria-label={isConnected ? "Connected" : "Disconnected"}
          />
          <span className="text-sm">{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>
    </header>
  );
};
