/**
 * VTT Loading Screen Component
 * Displays loading states for different scenarios
 */

import React from 'react';

interface LoadingScreenProps {
  message: string;
  showSpinner?: boolean;
  children?: React.ReactNode;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message, 
  showSpinner = true,
  children 
}) => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="text-center">
        {showSpinner && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
        )}
        <p className="text-lg mb-4">{message}</p>
        {children}
      </div>
    </div>
  );
};
