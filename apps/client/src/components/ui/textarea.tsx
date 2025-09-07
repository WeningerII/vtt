/**
 * Textarea Component - Multi-line text input with consistent styling
 */
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const textareaVariants = cva(
  [
    'flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm',
    'placeholder:text-gray-500 focus:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'resize-y transition-colors duration-200'
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-white/5 border-white/10 text-white',
          'focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
        ],
        destructive: [
          'bg-red-500/5 border-red-500/20 text-white',
          'focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
        ],
        ghost: [
          'bg-transparent border-transparent text-white',
          'focus:bg-white/5 focus:border-white/10'
        ]
      },
      size: {
        sm: 'min-h-[60px] px-2 py-1 text-xs',
        default: 'min-h-[80px] px-3 py-2 text-sm',
        lg: 'min-h-[120px] px-4 py-3 text-base'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
