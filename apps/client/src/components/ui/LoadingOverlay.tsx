/**
 * Loading Overlay Component
 * Standardized loading overlay for components with consistent styling
 */

import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  variant?: 'overlay' | 'inline' | 'absolute';
  backdrop?: boolean;
  children?: React.ReactNode;
}

export function LoadingOverlay({
  isLoading,
  message = 'Loading...',
  variant = 'overlay',
  backdrop = true,
  children
}: LoadingOverlayProps) {
  if (!isLoading) {
    return <>{children}</>;
  }

  const baseClasses = "flex items-center justify-center";
  
  const variantClasses = {
    overlay: "fixed inset-0 z-50",
    inline: "w-full py-8",
    absolute: "absolute inset-0 z-10"
  };

  const backdropClasses = backdrop ? "bg-bg-overlay backdrop-blur-sm" : "";

  return (
    <>
      {children}
      <div className={`${baseClasses} ${variantClasses[variant]} ${backdropClasses}`}>
        <div className="text-center space-y-3 p-6">
          <LoadingSpinner variant="primary" size="md" />
          <p className="text-text-secondary font-medium">
            {message}
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Inline Loading Component
 * For loading states within component content
 */
interface InlineLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  showSpinner?: boolean;
}

export function InlineLoading({ 
  message = 'Loading...', 
  size = 'md',
  showSpinner = true 
}: InlineLoadingProps) {
  return (
    <div className="flex items-center justify-center py-8 space-x-3">
      {showSpinner && <LoadingSpinner variant="primary" size={size} />}
      <p className="text-text-secondary font-medium">
        {message}
      </p>
    </div>
  );
}

/**
 * Button Loading State
 * For buttons with loading states
 */
interface ButtonLoadingProps {
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function ButtonLoading({ 
  isLoading, 
  loadingText, 
  children 
}: ButtonLoadingProps) {
  return (
    <span className="flex items-center justify-center space-x-2">
      {isLoading && (
        <LoadingSpinner variant="primary" size="sm" className="text-current" />
      )}
      <span>{isLoading && loadingText ? loadingText : children}</span>
    </span>
  );
}
