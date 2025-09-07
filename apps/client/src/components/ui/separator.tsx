/**
 * Separator Component - Visual divider for organizing content
 */
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const separatorVariants = cva(
  'shrink-0 bg-white/10',
  {
    variants: {
      orientation: {
        horizontal: 'h-[1px] w-full',
        vertical: 'w-[1px] h-full'
      },
      variant: {
        default: 'bg-white/10',
        muted: 'bg-white/5',
        strong: 'bg-white/20'
      }
    },
    defaultVariants: {
      orientation: 'horizontal',
      variant: 'default'
    }
  }
);

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof separatorVariants> {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}

const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', variant, decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={orientation}
      className={cn(separatorVariants({ orientation, variant }), className)}
      {...props}
    />
  )
);
Separator.displayName = 'Separator';

export { Separator, separatorVariants };
