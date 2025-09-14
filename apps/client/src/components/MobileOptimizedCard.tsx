/**
 * Mobile Optimized Card Component
 * Enhanced card component with touch-friendly interactions and gaming features
 */

import React, { memo, useState, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { MoreHorizontal, Star, Heart, Shield, Sword, Zap } from 'lucide-react';
import { Button } from './ui/Button';

const cardVariants = cva(
  [
    'relative rounded-xl border transition-all duration-300',
    'bg-surface-primary border-border-subtle',
    'touch-manipulation' // Enable touch optimizations
  ],
  {
    variants: {
      variant: {
        default: 'hover:shadow-md hover:border-border-primary',
        elevated: 'shadow-lg hover:shadow-xl',
        gaming: [
          'bg-gradient-to-br from-surface-elevated to-surface-secondary',
          'border-primary-500/30 shadow-[0_0_20px_rgba(var(--primary-500),0.15)]',
          'hover:shadow-[0_0_30px_rgba(var(--primary-500),0.25)]'
        ],
        character: [
          'bg-gradient-to-br from-purple-900/10 to-indigo-900/20', 
          'border-indigo-500/30',
          'hover:border-indigo-400/50'
        ],
        item: [
          'bg-gradient-to-br from-amber-900/10 to-yellow-900/20',
          'border-amber-500/30',
          'hover:border-amber-400/50'
        ],
        spell: [
          'bg-gradient-to-br from-purple-900/10 to-violet-900/20',
          'border-violet-500/30', 
          'hover:border-violet-400/50'
        ]
      },
      size: {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        // Mobile-optimized sizes
        'mobile-sm': 'p-3 min-h-[80px]',
        'mobile-md': 'p-4 min-h-[120px]', 
        'mobile-lg': 'p-6 min-h-[160px]'
      },
      interactive: {
        true: 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
        false: ''
      },
      selectable: {
        true: 'ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary-500',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      interactive: false,
      selectable: false
    }
  }
);

interface CardAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  shortcut?: string;
}

interface MobileCardProps extends VariantProps<typeof cardVariants> {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  image?: string;
  badge?: string | number;
  actions?: CardAction[];
  onTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  selected?: boolean;
  loading?: boolean;
  // Gaming-specific props
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stats?: Record<string, number>;
  tags?: string[];
  favorite?: boolean;
  onFavoriteToggle?: () => void;
}

export const MobileOptimizedCard = memo<MobileCardProps>(({
  children,
  className,
  variant,
  size,
  interactive,
  selectable,
  title,
  subtitle,
  description,
  image,
  badge,
  actions = [],
  onTap,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  selected = false,
  loading = false,
  rarity,
  stats,
  tags = [],
  favorite = false,
  onFavoriteToggle,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, time: 0 });

  // Touch event handlers for mobile interactions
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) {return;}
    
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    setIsPressed(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) {return;}
    
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // Only consider horizontal swipes
    if (Math.abs(deltaX) > 50 && deltaY < 30) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
    }
  }, [touchStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchTime = Date.now() - touchStart.time;
    const touch = e.changedTouches[0];
    if (!touch) {return;}
    
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    setIsPressed(false);
    
    // Long press detection (500ms+)
    if (touchTime > 500 && Math.abs(deltaX) < 10 && deltaY < 10) {
      onLongPress?.();
      // Haptic feedback for long press
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 25, 50]);
      }
      return;
    }
    
    // Swipe detection
    if (Math.abs(deltaX) > 80 && deltaY < 50) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
      // Haptic feedback for swipe
      if ('vibrate' in navigator) {
        navigator.vibrate(25);
      }
      return;
    }
    
    // Regular tap
    if (touchTime < 500 && Math.abs(deltaX) < 10 && deltaY < 10) {
      onTap?.();
      // Haptic feedback for tap
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
    
    setSwipeDirection(null);
  }, [touchStart, onTap, onLongPress, onSwipeLeft, onSwipeRight]);

  // Rarity-based styling
  const getRarityStyles = () => {
    if (!rarity) {return '';}
    
    const rarityStyles = {
      common: 'border-gray-400/30',
      uncommon: 'border-green-400/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]',
      rare: 'border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]', 
      epic: 'border-purple-400/30 shadow-[0_0_20px_rgba(147,51,234,0.4)]',
      legendary: 'border-orange-400/30 shadow-[0_0_25px_rgba(249,115,22,0.5)] animate-pulse'
    };
    
    return rarityStyles[rarity];
  };

  const StatIcon = ({ stat }: { stat: string }) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      attack: Sword,
      defense: Shield,
      health: Heart,
      magic: Star,
      speed: Zap
    };
    const Icon = icons[stat.toLowerCase()] || Star;
    return <Icon className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <div className={cn(cardVariants({ variant, size, interactive: false }), 'animate-pulse', className)}>
        <div className="space-y-3">
          <div className="h-4 bg-surface-subtle rounded w-3/4"></div>
          <div className="h-3 bg-surface-subtle rounded w-1/2"></div>
          <div className="h-20 bg-surface-subtle rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        cardVariants({ variant, size, interactive: Boolean(onTap), selectable }),
        getRarityStyles(),
        selected && 'ring-2 ring-primary-500 bg-primary-500/5',
        isPressed && 'scale-95',
        swipeDirection && `translate-x-${swipeDirection === 'right' ? '2' : '-2'}`,
        'mobile-card',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}  
      onTouchEnd={handleTouchEnd}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      {...props}
    >
      {/* Image */}
      {image && (
        <div className="relative mb-3 overflow-hidden rounded-lg">
          <img 
            src={image} 
            alt={title || 'Card image'}
            className="w-full h-32 object-cover"
            loading="lazy"
          />
          {badge && (
            <div className="absolute top-2 right-2 bg-primary-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              {badge}
            </div>
          )}
          {favorite !== undefined && (
            <button
              className={cn(
                'absolute top-2 left-2 p-1.5 rounded-full transition-all',
                favorite ? 'bg-red-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle?.();
              }}
              aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={cn('h-4 w-4', favorite && 'fill-current')} />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        {/* Title and subtitle */}
        {(title || subtitle) && (
          <div className="space-y-1">
            {title && (
              <h3 className="text-base font-semibold text-text-primary truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-text-secondary truncate">
                {subtitle}  
              </p>
            )}
          </div>
        )}

        {/* Rarity indicator */}
        {rarity && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400" />
            <span className="text-xs font-medium capitalize text-text-secondary">
              {rarity}
            </span>
          </div>
        )}

        {/* Stats */}
        {stats && Object.keys(stats).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats).map(([stat, value]) => (
              <div key={stat} className="flex items-center gap-1 bg-surface-elevated px-2 py-1 rounded">
                <StatIcon stat={stat} />
                <span className="text-xs font-mono">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span 
                key={tag}
                className="inline-block px-2 py-0.5 bg-surface-subtle text-text-tertiary text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-text-tertiary">+{tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-text-secondary line-clamp-2">
            {description}
          </p>
        )}

        {/* Custom children */}
        {children}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-subtle">
          <div className="flex gap-2 flex-1">
            {actions.slice(0, 2).map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant === 'destructive' ? 'destructive' : action.variant === 'primary' ? 'primary' : 'ghost'}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  title={action.shortcut ? `Shortcut: ${action.shortcut}` : undefined}
                >
                  {Icon && <Icon className="h-3 w-3 mr-1" />}
                  {action.label}
                </Button>
              );
            })}
          </div>
          
          {actions.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Swipe indicators */}
      {(onSwipeLeft || onSwipeRight) && (
        <>
          {onSwipeLeft && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30">
              <div className="flex items-center text-red-400">
                <span className="text-xs">←</span>
              </div>
            </div>
          )}
          {onSwipeRight && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30">
              <div className="flex items-center text-green-400">
                <span className="text-xs">→</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default MobileOptimizedCard;
