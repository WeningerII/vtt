/**
 * VTT Loading Screen Component
 * Displays loading states for different scenarios with design system integration
 */

import React from 'react';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface LoadingScreenProps {
  message: string;
  showSpinner?: boolean;
  variant?: 'fullscreen' | 'overlay' | 'inline';
  children?: React.ReactNode;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message, 
  showSpinner = true,
  variant = 'fullscreen',
  children 
}) => {
  const baseClasses = "flex items-center justify-center";
  
  const variantClasses = {
    fullscreen: "h-screen bg-bg-primary text-text-primary",
    overlay: "fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 text-text-primary",
    inline: "py-8 text-text-secondary"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      <div className="text-center space-y-4">
        {showSpinner && (
          <LoadingSpinner 
            variant="primary" 
            size={variant === 'fullscreen' ? 'lg' : 'md'} 
          />
        )}
        <p className={`${variant === 'fullscreen' ? 'text-lg' : 'text-base'} font-medium`}>
          {message}
        </p>
        {children}
      </div>
    </div>
  );
};
