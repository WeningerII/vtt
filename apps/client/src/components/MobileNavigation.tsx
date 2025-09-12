/**
 * Enhanced Mobile Navigation Component for VTT
 * Provides touch-friendly panel navigation with gesture support
 * Features: Swipe navigation, haptic feedback, visual indicators
 */

import React, { memo, useCallback } from 'react';
import { Map, MessageSquare, Users, User, Dice6, ChevronLeft, ChevronRight } from 'lucide-react';
import { useVTTLayout } from '../hooks/useVTTLayout';
import { useGestureNavigation } from '../hooks/useGestureNavigation';
import { cn } from '../lib/utils';

interface MobileNavigationProps {
  className?: string;
  enableGestures?: boolean;
  showSwipeIndicators?: boolean;
}

export const MobileNavigation = memo<MobileNavigationProps>(function MobileNavigation({ 
  className = '',
  enableGestures = true,
  showSwipeIndicators = true 
}) {
  const { 
    layoutState, 
    togglePanel, 
    getPanelProps,
    isMobile,
    activePanel 
  } = useVTTLayout();

  const {
    gestureRef,
    gestureState,
    getDirectionIndicator,
    isGestureActive
  } = useGestureNavigation({
    enableHaptics: true,
    enableSounds: true,
    threshold: 100,
    velocityThreshold: 0.5
  });

  const directionIndicator = getDirectionIndicator();

  const handlePanelToggle = useCallback((panelId: string) => {
    togglePanel(panelId as any);
  }, [togglePanel]);

  if (!isMobile) {return null;}

  const navItems = [
    {
      id: 'map' as const,
      label: 'Map',
      icon: Map,
      shortLabel: 'Map'
    },
    {
      id: 'chat' as const,
      label: 'Chat',
      icon: MessageSquare,
      shortLabel: 'Chat'
    },
    {
      id: 'tokens' as const,
      label: 'Tokens',
      icon: Users,
      shortLabel: 'Token'
    },
    {
      id: 'character' as const,
      label: 'Character',
      icon: User,
      shortLabel: 'Char'
    },
    {
      id: 'dice' as const,
      label: 'Dice',
      icon: Dice6,
      shortLabel: 'Dice'
    }
  ];

  return (
    <>
      {/* Gesture Navigation Area */}
      {enableGestures && (
        <div 
          ref={gestureRef}
          className={cn(
            "fixed inset-0 z-10 pointer-events-none",
            isGestureActive && "pointer-events-auto"
          )}
          style={{ 
            background: isGestureActive 
              ? 'rgba(0, 0, 0, 0.1)' 
              : 'transparent',
            transition: 'background 0.2s ease'
          }}
        >
          {/* Swipe Direction Indicators */}
          {showSwipeIndicators && directionIndicator.isVisible && (
            <>
              {directionIndicator.direction === 'left' && (
                <div 
                  className="fixed left-4 top-1/2 -translate-y-1/2 z-20"
                  style={{
                    opacity: directionIndicator.intensity,
                    transform: `translateY(-50%) translateX(${-20 + directionIndicator.progress * 20}px)`
                  }}
                >
                  <div className="bg-primary-600 text-white p-3 rounded-full shadow-lg">
                    <ChevronLeft className="h-6 w-6" />
                  </div>
                </div>
              )}
              {directionIndicator.direction === 'right' && (
                <div 
                  className="fixed right-4 top-1/2 -translate-y-1/2 z-20"
                  style={{
                    opacity: directionIndicator.intensity,
                    transform: `translateY(-50%) translateX(${20 - directionIndicator.progress * 20}px)`
                  }}
                >
                  <div className="bg-primary-600 text-white p-3 rounded-full shadow-lg">
                    <ChevronRight className="h-6 w-6" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className={cn(
        "panel-nav",
        "fixed bottom-0 left-0 right-0",
        "h-16 bg-surface-elevated/95 backdrop-blur-md",
        "border-t border-border-subtle",
        "flex items-center justify-around",
        "px-safe-area-inset-x pb-safe-area-inset-bottom",
        "z-50",
        className
      )}>
        {navItems.map((item, index) => {
          const panelProps = getPanelProps(item.id);
          const isActive = panelProps.isActive || activePanel === item.id;
          
          const IconComponent = item.icon;
          
          return (
            <button
              key={item.id}
              className={cn(
                "mobile-nav-item",
                "flex flex-col items-center gap-1",
                "px-3 py-2 min-h-[44px] min-w-[44px]",
                "rounded-lg transition-all duration-200",
                "text-text-secondary hover:text-text-primary",
                "touch-manipulation select-none",
                isActive && [
                  "mobile-nav-item--active",
                  "bg-surface-accent text-color-accent-primary",
                  "transform -translate-y-0.5 shadow-md"
                ]
              )}
              onClick={() => handlePanelToggle(item.id)}
              aria-label={`Toggle ${item.label} panel`}
              aria-pressed={isActive}
              data-gesture-target={item.id}
            >
              <IconComponent className={cn(
                "mobile-nav-icon h-5 w-5 transition-transform duration-200",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "mobile-nav-label text-xs font-medium",
                "transition-all duration-200",
                isActive && "font-semibold"
              )}>
                {item.shortLabel}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-color-accent-primary rounded-full" />
              )}
            </button>
          );
        })}

        {/* Gesture hint */}
        {enableGestures && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-surface-overlay text-text-secondary text-xs rounded-full opacity-60">
            Swipe to navigate
          </div>
        )}
      </nav>
    </>
  );
});

export default MobileNavigation;
