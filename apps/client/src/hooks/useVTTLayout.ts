/**
 * VTT Layout Management Hook
 * Handles responsive layouts and touch interactions for VTT gameplay
 */

import { useState, useEffect, useCallback } from 'react';

export type VTTLayoutMode = 'desktop' | 'tablet' | 'mobile';
export type VTTPanelState = 'hidden' | 'collapsed' | 'expanded';

interface VTTLayoutState {
  mode: VTTLayoutMode;
  panelStates: {
    character: VTTPanelState;
    dice: VTTPanelState;
    chat: VTTPanelState;
    tokens: VTTPanelState;
    map: VTTPanelState;
  };
  activePanel: string | null;
  isFullscreen: boolean;
}

interface TouchGesture {
  type: 'swipe' | 'pinch' | 'tap' | 'long-press';
  direction?: 'up' | 'down' | 'left' | 'right';
  scale?: number;
  target: string;
}

export function useVTTLayout() {
  const [layoutState, setLayoutState] = useState<VTTLayoutState>({
    mode: 'desktop',
    panelStates: {
      character: 'collapsed',
      dice: 'collapsed',
      chat: 'expanded',
      tokens: 'expanded',
      map: 'expanded'
    },
    activePanel: null,
    isFullscreen: false
  });

  // Detect layout mode based on screen size
  const updateLayoutMode = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    let newMode: VTTLayoutMode = 'desktop';
    
    if (width < 768) {
      newMode = 'mobile';
    } else if (width < 1200 || (width < 1400 && height < 800)) {
      newMode = 'tablet';
    }

    setLayoutState(prev => {
      if (prev.mode === newMode) {return prev;}
      
      // Adjust panel states based on new mode
      let newPanelStates = { ...prev.panelStates };
      
      if (newMode === 'mobile') {
        // Mobile: Only one panel active at a time
        newPanelStates = {
          character: 'hidden',
          dice: 'hidden',
          chat: 'hidden',
          tokens: 'hidden',
          map: 'expanded'
        };
      } else if (newMode === 'tablet') {
        // Tablet: Reduced panels
        newPanelStates = {
          character: 'collapsed',
          dice: 'collapsed',
          chat: 'expanded',
          tokens: 'collapsed',
          map: 'expanded'
        };
      } else {
        // Desktop: All panels available
        newPanelStates = {
          character: 'collapsed',
          dice: 'collapsed',
          chat: 'expanded',
          tokens: 'expanded',
          map: 'expanded'
        };
      }
      
      return {
        ...prev,
        mode: newMode,
        panelStates: newPanelStates,
        activePanel: newMode === 'mobile' ? 'map' : null
      };
    });
  }, []);

  // Initialize and listen for resize events
  useEffect(() => {
    updateLayoutMode();
    
    const handleResize = () => {
      updateLayoutMode();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateLayoutMode]);

  // Panel management functions
  const togglePanel = useCallback((panelName: keyof VTTLayoutState['panelStates']) => {
    setLayoutState(prev => {
      const currentState = prev.panelStates[panelName];
      let newState: VTTPanelState;
      
      if (prev.mode === 'mobile') {
        // Mobile: Toggle between hidden and expanded
        newState = currentState === 'expanded' ? 'hidden' : 'expanded';
        
        // Hide other panels on mobile
        const newPanelStates = { ...prev.panelStates };
        if (newState === 'expanded') {
          Object.keys(newPanelStates).forEach(key => {
            if (key !== panelName) {
              newPanelStates[key as keyof typeof newPanelStates] = 'hidden';
            }
          });
          newPanelStates[panelName] = 'expanded';
        }
        
        return {
          ...prev,
          panelStates: newPanelStates,
          activePanel: newState === 'expanded' ? panelName : null
        };
      } else {
        // Desktop/Tablet: Cycle through states
        switch (currentState) {
          case 'hidden':
            newState = 'collapsed';
            break;
          case 'collapsed':
            newState = 'expanded';
            break;
          case 'expanded':
            newState = 'collapsed';
            break;
          default:
            newState = 'collapsed';
        }
        
        return {
          ...prev,
          panelStates: {
            ...prev.panelStates,
            [panelName]: newState
          }
        };
      }
    });
  }, []);

  const setPanelState = useCallback((panelName: keyof VTTLayoutState['panelStates'], state: VTTPanelState) => {
    setLayoutState(prev => ({
      ...prev,
      panelStates: {
        ...prev.panelStates,
        [panelName]: state
      }
    }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setLayoutState(prev => ({
      ...prev,
      isFullscreen: !prev.isFullscreen
    }));
  }, []);

  // Touch gesture handling
  const handleGesture = useCallback((gesture: TouchGesture) => {
    switch (gesture.type) {
      case 'swipe':
        if (layoutState.mode === 'mobile') {
          switch (gesture.direction) {
            case 'up':
              // Swipe up to show panels
              if (layoutState.activePanel === 'map') {
                togglePanel('chat');
              }
              break;
            case 'down':
              // Swipe down to hide panels
              if (layoutState.activePanel !== 'map') {
                togglePanel('map');
              }
              break;
            case 'left':
              // Swipe left to next panel
              cyclePanels('next');
              break;
            case 'right':
              // Swipe right to previous panel
              cyclePanels('prev');
              break;
          }
        }
        break;
        
      case 'pinch':
        if (gesture.target === 'map' && gesture.scale) {
          // Handle map zoom via pinch gesture
          handleMapZoom(gesture.scale);
        }
        break;
        
      case 'long-press':
        if (gesture.target === 'dice') {
          // Long press on dice for advantage/disadvantage
          handleDiceLongPress();
        }
        break;
    }
  }, [layoutState, togglePanel]);

  const cyclePanels = useCallback((direction: 'next' | 'prev') => {
    const panelOrder = ['map', 'chat', 'tokens', 'character', 'dice'];
    const currentIndex = layoutState.activePanel ? 
      panelOrder.indexOf(layoutState.activePanel) : 0;
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % panelOrder.length;
    } else {
      nextIndex = (currentIndex - 1 + panelOrder.length) % panelOrder.length;
    }
    
    const nextPanel = panelOrder[nextIndex] as keyof VTTLayoutState['panelStates'];
    togglePanel(nextPanel);
  }, [layoutState.activePanel, togglePanel]);

  const handleMapZoom = useCallback((scale: number) => {
    // Emit map zoom event
    window.dispatchEvent(new CustomEvent('vtt:map-zoom', { 
      detail: { scale } 
    }));
  }, []);

  const handleDiceLongPress = useCallback(() => {
    // Emit dice long press event
    window.dispatchEvent(new CustomEvent('vtt:dice-long-press'));
  }, []);

  // Get CSS classes for current layout
  const getLayoutClasses = useCallback(() => {
    const classes = [`vtt-layout-${layoutState.mode}`];
    
    if (layoutState.isFullscreen) {
      classes.push('vtt-fullscreen');
    }
    
    if (layoutState.mode === 'mobile' && layoutState.activePanel) {
      classes.push(`vtt-active-${layoutState.activePanel}`);
    }
    
    return classes.join(' ');
  }, [layoutState]);

  // Get panel visibility and size
  const getPanelProps = useCallback((panelName: keyof VTTLayoutState['panelStates']) => {
    const state = layoutState.panelStates[panelName];
    const isActive = layoutState.activePanel === panelName;
    
    return {
      state,
      isActive,
      isVisible: state !== 'hidden',
      isExpanded: state === 'expanded',
      isCollapsed: state === 'collapsed',
      className: `vtt-panel vtt-panel-${panelName} vtt-panel-${state} ${isActive ? 'vtt-panel-active' : ''}`
    };
  }, [layoutState]);

  return {
    layoutState,
    mode: layoutState.mode,
    isFullscreen: layoutState.isFullscreen,
    activePanel: layoutState.activePanel,
    
    // Actions
    togglePanel,
    setPanelState,
    toggleFullscreen,
    handleGesture,
    cyclePanels,
    
    // Utilities
    getLayoutClasses,
    getPanelProps,
    
    // Layout queries
    isMobile: layoutState.mode === 'mobile',
    isTablet: layoutState.mode === 'tablet',
    isDesktop: layoutState.mode === 'desktop',
    isTouchDevice: layoutState.mode === 'mobile' || layoutState.mode === 'tablet'
  };
}

// Touch gesture detection hook
export function useTouchGestures(elementRef: React.RefObject<HTMLElement>, onGesture: (gesture: TouchGesture) => void) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) {return;}

    let touchStart: { x: number; y: number; time: number } | null = null;
    let touchEnd: { x: number; y: number; time: number } | null = null;
    let longPressTimer: NodeJS.Timeout | null = null;
    let initialDistance = 0;
    let currentScale = 1;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) {return;}
      
      touchStart = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };

      // Handle pinch gesture
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        if (touch1 && touch2) {
          initialDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );
        }
      }

      // Start long press timer
      longPressTimer = setTimeout(() => {
        if (touchStart) {
          onGesture({
            type: 'long-press',
            target: element.dataset.gestureTarget || 'unknown'
          });
        }
      }, 500);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Cancel long press on move
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      // Handle pinch gesture
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2!.clientX - touch1!.clientX,
          touch2!.clientY - touch1!.clientY
        );
        
        if (initialDistance > 0) {
          const scale = distance / initialDistance;
          if (Math.abs(scale - currentScale) > 0.1) {
            currentScale = scale;
            onGesture({
              type: 'pinch',
              scale,
              target: element.dataset.gestureTarget || 'unknown'
            });
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (!touchStart) {return;}

      const touch = e.changedTouches[0];
      if (!touch) {return;}
      
      touchEnd = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };

      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = touchEnd.y - touchStart.y;
      const deltaTime = touchEnd.time - touchStart.time;
      const distance = Math.hypot(deltaX, deltaY);

      // Detect tap
      if (distance < 10 && deltaTime < 300) {
        onGesture({
          type: 'tap',
          target: element.dataset.gestureTarget || 'unknown'
        });
        return;
      }

      // Detect swipe
      if (distance > 50 && deltaTime < 500) {
        let direction: 'up' | 'down' | 'left' | 'right';
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }

        onGesture({
          type: 'swipe',
          direction,
          target: element.dataset.gestureTarget || 'unknown'
        });
      }

      touchStart = null;
      touchEnd = null;
      initialDistance = 0;
      currentScale = 1;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [elementRef, onGesture]);
}
