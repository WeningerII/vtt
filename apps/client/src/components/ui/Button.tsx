/**
 * Button Component - Versatile, accessible button with multiple variants and sizes
 */
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  // Base styles - consistent across all variants
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-all duration-200 ease-in-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'relative overflow-hidden'
  ],
  {
    variants: {
      variant: {
        // Primary - Main call-to-action button
        primary: [
          'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg',
          'hover:from-primary-700 hover:to-primary-800 hover:shadow-xl hover:-translate-y-0.5',
          'active:from-primary-800 active:to-primary-900 active:translate-y-0',
          'focus-visible:ring-primary-500'
        ],
        
        // Secondary - Less prominent actions
        secondary: [
          'bg-white text-neutral-900 border border-neutral-300 shadow-sm',
          'hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-md',
          'active:bg-neutral-100',
          'focus-visible:ring-neutral-500'
        ],
        
        // Destructive - Delete, remove, dangerous actions
        destructive: [
          'bg-gradient-to-r from-error-600 to-error-700 text-white shadow-lg',
          'hover:from-error-700 hover:to-error-800 hover:shadow-xl hover:-translate-y-0.5',
          'active:from-error-800 active:to-error-900 active:translate-y-0',
          'focus-visible:ring-error-500'
        ],
        
        // Ghost - Minimal styling, text-like
        ghost: [
          'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
          'active:bg-neutral-200',
          'focus-visible:ring-neutral-500'
        ],
        
        // Link - Looks like a text link
        link: [
          'text-primary-600 underline-offset-4 hover:underline',
          'active:text-primary-700',
          'focus-visible:ring-primary-500'
        ],
        
        // Success - Positive actions
        success: [
          'bg-gradient-to-r from-success-600 to-success-700 text-white shadow-lg',
          'hover:from-success-700 hover:to-success-800 hover:shadow-xl hover:-translate-y-0.5',
          'active:from-success-800 active:to-success-900 active:translate-y-0',
          'focus-visible:ring-success-500'
        ]
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10 rounded-full'
      },
      fullWidth: {
        true: 'w-full'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, variant, 
    size, fullWidth,
    loading = false, leftIcon,
    rightIcon, disabled,
    children,
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;
    
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props} >
        {/* Loading spinner */}
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        
        {/* Left icon (hidden when loading) */}
        {!loading && leftIcon && (
          <span className="inline-flex shrink-0">
            {leftIcon}
          </span>
        )}
        
        {/* Button text */}
        <span className={cn(
          'inline-flex items-center',
          loading && 'opacity-70'
        )}>
          {children}
        </span>
        
        {/* Right icon (hidden when loading) */}
        {!loading && rightIcon && (
          <span className="inline-flex shrink-0">
            {rightIcon}
          </span>
        )}
        
        {/* Ripple effect overlay */}
        <span className="absolute inset-0 -z-10 rounded-lg bg-white/20 opacity-0 transition-opacity duration-200 hover:opacity-100" />
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
