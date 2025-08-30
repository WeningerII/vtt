/**
 * Accessible Button Component with proper ARIA attributes and keyboard support
 */

import React, { forwardRef } from 'react';
import { generateAriaLabel } from '../utils/accessibility';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  action: string; // Required for accessibility
  target?: string; // Context for aria-label
  state?: string; // Current state for aria-label
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    action,
    target,
    state,
    children,
    className = '',
    disabled,
    'aria-label': ariaLabel,
    ...props
  }, ref) => {
    const isDisabled = disabled || loading;
    
    const contextObj: { target?: string; state?: string; value?: string } = {};
    if (target) contextObj.target = target;
    if (loading) contextObj.state = 'loading';
    else if (state) contextObj.state = state;
    
    const generatedAriaLabel = ariaLabel || generateAriaLabel('button', action, contextObj);

    const baseClasses = [
      'btn',
      `btn-${variant}`,
      `btn-${size}`,
      fullWidth && 'btn-full-width',
      loading && 'btn-loading',
      className
    ].filter(Boolean).join(' ');

    const buttonContent = (
      <>
        {loading && (
          <span className="btn-spinner" aria-hidden="true">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
        
        {icon && iconPosition === 'left' && !loading && (
          <span className="btn-icon btn-icon-left" aria-hidden="true">
            {icon}
          </span>
        )}
        
        <span className="btn-text">
          {loading && loadingText ? loadingText : children}
        </span>
        
        {icon && iconPosition === 'right' && !loading && (
          <span className="btn-icon btn-icon-right" aria-hidden="true">
            {icon}
          </span>
        )}
        
        {loading && (
          <span className="sr-only">
            {loadingText || `${action} in progress`}
          </span>
        )}
      </>
    );

    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={isDisabled}
        aria-label={generatedAriaLabel}
        aria-busy={loading}
        {...props}
       >
        {buttonContent}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;
