/**
 * Card Component - Flexible container with consistent styling and spacing
 */
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const cardVariants = cva(
  [
    'rounded-xl bg-white transition-all duration-200',
    'border border-neutral-200'
  ],
  {
    variants: {
      variant: {
        default: 'shadow-sm hover:shadow-md',
        elevated: 'shadow-lg hover:shadow-xl',
        outline: 'border-2 shadow-none hover:border-neutral-300',
        ghost: 'border-none shadow-none bg-transparent'
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10'
      },
      interactive: {
        true: 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
      interactive: false
    }
  }
);

const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(_({ className, _variant, _padding, _interactive, _...props }, _ref) => (
  <div
    ref={ref}
    className={cn(cardVariants({ variant, padding, interactive }), className)}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(_({ className, _...props }, _ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(_({ className, _children, _...props }, _ref) => (
  <h3
    ref={ref}
    className={cn('font-semibold text-xl text-neutral-900 leading-none tracking-tight', className)}
    {...props}
  >
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(_({ className, _...props }, _ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-neutral-600 leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(_({ className, _...props }, _ref) => (
  <div ref={ref} className={cn('space-y-4', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(_({ className, _...props }, _ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-between pt-6', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants
};
