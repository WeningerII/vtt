/**
 * Mobile Bottom Sheet Component
 * Optimized sliding panel for mobile VTT interactions
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { ChevronDown, GripHorizontal } from 'lucide-react';

const sheetVariants = cva(
  [
    'fixed bottom-0 left-0 right-0 z-50',
    'bg-surface-primary border-t border-border-subtle',
    'transform transition-transform duration-300 ease-out',
    'touch-none' // Prevent default touch behaviors
  ],
  {
    variants: {
      size: {
        sm: 'max-h-[30vh]',
        md: 'max-h-[50vh]',
        lg: 'max-h-[80vh]',
        full: 'max-h-[95vh]'
      },
      variant: {
        default: 'rounded-t-xl shadow-xl',
        gaming: [
          'rounded-t-2xl shadow-2xl',
          'bg-gradient-to-t from-surface-primary to-surface-elevated',
          'border-primary-500/30'
        ],
        modal: 'rounded-t-none shadow-2xl bg-surface-elevated'
      }
    },
    defaultVariants: {
      size: 'md',
      variant: 'default'
    }
  }
);

interface BottomSheetProps extends VariantProps<typeof sheetVariants> {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  dragToClose?: boolean;
  showHandle?: boolean;
  backdrop?: boolean;
  snapPoints?: number[]; // Percentage heights for snapping
  onSnapChange?: (snapIndex: number) => void;
  initialSnap?: number;
}

export const MobileBottomSheet = memo<BottomSheetProps>(({
  isOpen,
  onClose,
  children,
  title,
  description,
  className,
  size,
  variant,
  dragToClose = true,
  showHandle = true,
  backdrop = true,
  snapPoints = [25, 50, 80],
  onSnapChange,
  initialSnap = 1
}) => {
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate current height based on snap point
  const getCurrentHeight = useCallback(() => {
    if (snapPoints && snapPoints[currentSnap] !== undefined) {
      return `${snapPoints[currentSnap]}vh`;
    }
    return '50vh';
  }, [snapPoints, currentSnap]);

  // Handle drag start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!dragToClose) {return;}
    
    const touch = e.touches?.[0];
    if (!touch) {return;}
    setStartY(touch.clientY);
    setCurrentY(touch.clientY);
    setIsDragging(true);
  }, [dragToClose]);

  // Handle drag move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !dragToClose) {return;}
    
    e.preventDefault();
    const touch = e.touches?.[0];
    if (!touch) {return;}
    const deltaY = touch.clientY - startY;
    
    setCurrentY(touch.clientY);
    
    if (sheetRef.current) {
      // Only allow dragging down
      if (deltaY > 0) {
        sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      }
    }
  }, [isDragging, dragToClose, startY]);

  // Handle drag end
  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !dragToClose) {return;}
    
    setIsDragging(false);
    
    if (sheetRef.current) {
      const deltaY = currentY - startY;
      const sheetHeight = sheetRef.current.offsetHeight;
      
      // If dragged down more than 30% of sheet height, close
      if (deltaY > sheetHeight * 0.3) {
        onClose();
      } else if (snapPoints && snapPoints.length > 1) {
        // Find closest snap point
        const currentPercent = ((window.innerHeight - currentY) / window.innerHeight) * 100;
        let closestSnap = 0;
        let minDistance = Infinity;
        
        snapPoints.forEach((point, index) => {
          const distance = Math.abs(point - currentPercent);
          if (distance < minDistance) {
            minDistance = distance;
            closestSnap = index;
          }
        });
        
        setCurrentSnap(closestSnap);
        onSnapChange?.(closestSnap);
      }
      
      // Reset transform
      sheetRef.current.style.transform = '';
    }
  }, [isDragging, dragToClose, currentY, startY, snapPoints, onClose, onSnapChange]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {return null;}

  const sheet = (
    <>
      {/* Backdrop */}
      {backdrop && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(sheetVariants({ size, variant }), className)}
        style={{ 
          maxHeight: getCurrentHeight(),
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
        aria-describedby={description ? 'sheet-description' : undefined}
      >
        {/* Handle */}
        {showHandle && (
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 bg-border-secondary rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || description) && (
          <div className="px-4 py-2 border-b border-border-subtle">
            {title && (
              <h2 id="sheet-title" className="text-lg font-semibold text-text-primary">
                {title}
              </h2>
            )}
            {description && (
              <p id="sheet-description" className="text-sm text-text-secondary mt-1">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ 
            maxHeight: `calc(${getCurrentHeight()} - ${title || description ? '80px' : '40px'})` 
          }}
        >
          {children}
        </div>

        {/* Snap point indicators */}
        {snapPoints && snapPoints.length > 1 && (
          <div className="absolute right-4 top-4">
            <div className="flex flex-col gap-1">
              {snapPoints.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    index === currentSnap ? 'bg-primary-500' : 'bg-border-secondary'
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(sheet, document.body);
});

// Gaming-specific bottom sheets
interface DiceRollSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onRoll: (dice: string) => void;
}

export const DiceRollSheet = memo<DiceRollSheetProps>(({
  isOpen,
  onClose,
  onRoll
}) => {
  const diceTypes = [
    { label: 'd4', value: '1d4' },
    { label: 'd6', value: '1d6' },
    { label: 'd8', value: '1d8' },
    { label: 'd10', value: '1d10' },
    { label: 'd12', value: '1d12' },
    { label: 'd20', value: '1d20' },
    { label: 'd100', value: '1d100' }
  ];

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Roll Dice"
      description="Select dice to roll"
      variant="gaming"
      size="sm"
    >
      <div className="grid grid-cols-4 gap-3">
        {diceTypes.map((dice) => (
          <button
            key={dice.value}
            className={cn(
              'aspect-square rounded-xl border border-border-subtle',
              'bg-surface-elevated hover:bg-surface-hover',
              'text-center font-mono font-semibold',
              'transition-all duration-200 touch-manipulation',
              'hover:border-primary-400 hover:shadow-md',
              'active:scale-95'
            )}
            onClick={() => {
              onRoll(dice.value);
              if ('vibrate' in navigator) {
                navigator.vibrate(25);
              }
            }}
          >
            {dice.label}
          </button>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <p className="text-xs text-text-tertiary text-center">
          Tap a die to roll • Long press for custom rolls
        </p>
      </div>
    </MobileBottomSheet>
  );
});

interface QuickActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  actions: Array<{
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'destructive';
  }>;
}

export const QuickActionsSheet = memo<QuickActionsSheetProps>(({
  isOpen,
  onClose,
  actions
}) => {
  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Actions"
      variant="gaming"
      size="sm"
    >
      <div className="space-y-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={index}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg',
                'text-left transition-all duration-200 touch-manipulation',
                'hover:bg-surface-hover active:scale-98',
                action.variant === 'destructive' && 'text-error hover:bg-error/10',
                action.variant === 'primary' && 'text-primary-400 hover:bg-primary-500/10'
              )}
              onClick={() => {
                action.onClick();
                onClose();
                if ('vibrate' in navigator) {
                  navigator.vibrate(20);
                }
              }}
            >
              {Icon && <Icon className="h-5 w-5 shrink-0" />}
              <span className="font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>
    </MobileBottomSheet>
  );
});

export default MobileBottomSheet;
