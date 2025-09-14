/**
 * Enhanced Gesture Navigation Hook
 * Provides swipe gesture navigation between VTT panels with haptic feedback
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVTTLayout } from './useVTTLayout';

interface GestureState {
  isActive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  velocity: number;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}

interface UseGestureNavigationOptions {
  threshold?: number;
  velocityThreshold?: number;
  enableHaptics?: boolean;
  enableSounds?: boolean;
}

export function useGestureNavigation(options: UseGestureNavigationOptions = {}) {
  const {
    threshold = 100,
    velocityThreshold = 0.5,
    enableHaptics = true,
    enableSounds = true
  } = options;

  const { layoutState, togglePanel, activePanel } = useVTTLayout();

  // Panel navigation order
  const panelOrder = ['map', 'chat', 'tokens', 'character', 'dice'];
  
  const navigateToPanel = useCallback((panelId: string) => {
    togglePanel(panelId as any);
  }, [togglePanel]);
  
  const getNextPanel = useCallback(() => {
    if (!activePanel) {return panelOrder[0];}
    const currentIndex = panelOrder.indexOf(activePanel);
    const nextIndex = (currentIndex + 1) % panelOrder.length;
    return panelOrder[nextIndex];
  }, [activePanel]);
  
  const getPreviousPanel = useCallback(() => {
    if (!activePanel) {return panelOrder[panelOrder.length - 1];}
    const currentIndex = panelOrder.indexOf(activePanel);
    const prevIndex = currentIndex === 0 ? panelOrder.length - 1 : currentIndex - 1;
    return panelOrder[prevIndex];
  }, [activePanel]);
  const gestureRef = useRef<HTMLDivElement>(null);
  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    velocity: 0,
    direction: null
  });

  // Haptic feedback helpers
  const triggerHaptic = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!enableHaptics || !navigator.vibrate) {return;}
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };
    
    navigator.vibrate(patterns[intensity]);
  }, [enableHaptics]);

  // Audio feedback helpers
  const triggerSwipeSound = useCallback((direction: string) => {
    if (!enableSounds) {return;}
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different tones for different directions
      const frequencies = {
        left: 400,
        right: 600,
        up: 800,
        down: 300
      };
      
      oscillator.frequency.setValueAtTime(
        frequencies[direction as keyof typeof frequencies] || 500, 
        audioContext.currentTime
      );
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('Audio feedback not available:', error);
    }
  }, [enableSounds]);

  // Handle gesture start
  const handleGestureStart = useCallback((clientX: number, clientY: number) => {
    setGestureState(prev => ({
      ...prev,
      isActive: true,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      deltaX: 0,
      deltaY: 0,
      velocity: 0,
      direction: null
    }));
    
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Handle gesture move
  const handleGestureMove = useCallback((clientX: number, clientY: number) => {
    setGestureState(prev => {
      if (!prev.isActive) {return prev;}
      
      const deltaX = clientX - prev.startX;
      const deltaY = clientY - prev.startY;
      const velocity = Math.abs(deltaX) / (Date.now() - (prev as any).startTime || 1);
      
      let direction: GestureState['direction'] = null;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      if (absDeltaX > absDeltaY && absDeltaX > 20) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else if (absDeltaY > absDeltaX && absDeltaY > 20) {
        direction = deltaY > 0 ? 'down' : 'up';
      }
      
      // Provide feedback at threshold
      if ((absDeltaX > threshold || absDeltaY > threshold) && prev.direction !== direction) {
        triggerHaptic('medium');
      }
      
      return {
        ...prev,
        currentX: clientX,
        currentY: clientY,
        deltaX,
        deltaY,
        velocity,
        direction
      };
    });
  }, [threshold, triggerHaptic]);

  // Handle gesture end
  const handleGestureEnd = useCallback(() => {
    setGestureState(prev => {
      if (!prev.isActive) {return prev;}
      
      const { deltaX, deltaY, velocity, direction } = prev;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      // Determine if gesture should trigger navigation
      const shouldNavigate = (
        (absDeltaX > threshold && absDeltaX > absDeltaY) ||
        (absDeltaY > threshold && absDeltaY > absDeltaX) ||
        velocity > velocityThreshold
      );
      
      if (shouldNavigate && direction) {
        let targetPanel: string | null = null;
        
        switch (direction) {
          case 'left':
            targetPanel = getNextPanel() || null;
            break;
          case 'right':
            targetPanel = getPreviousPanel() || null;
            break;
          case 'up':
            // Could implement panel minimization
            break;
          case 'down':
            // Could implement panel expansion
            break;
        }
        
        if (targetPanel) {
          navigateToPanel(targetPanel);
          triggerHaptic('heavy');
          triggerSwipeSound(direction);
        }
      }
      
      return {
        ...prev,
        isActive: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        deltaX: 0,
        deltaY: 0,
        velocity: 0,
        direction: null
      };
    });
  }, [threshold, velocityThreshold, navigateToPanel, getNextPanel, getPreviousPanel, triggerHaptic, triggerSwipeSound]);

  // Touch event handlers
  const touchHandlers = {
    onTouchStart: (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (touch) {
          handleGestureStart(touch.clientX, touch.clientY);
        }
      }
    },
    onTouchMove: (e: TouchEvent) => {
      if (e.touches.length === 1 && gestureState.isActive) {
        e.preventDefault(); // Prevent scroll during gesture
        const touch = e.touches[0];
        if (touch) {
          handleGestureMove(touch.clientX, touch.clientY);
        }
      }
    },
    onTouchEnd: () => {
      handleGestureEnd();
    }
  };

  // Mouse event handlers (for desktop testing)
  const mouseHandlers = {
    onMouseDown: (e: MouseEvent) => {
      handleGestureStart(e.clientX, e.clientY);
    },
    onMouseMove: (e: MouseEvent) => {
      if (gestureState.isActive) {
        handleGestureMove(e.clientX, e.clientY);
      }
    },
    onMouseUp: () => {
      handleGestureEnd();
    }
  };

  // Attach event listeners
  useEffect(() => {
    const element = gestureRef.current;
    if (!element) {return;}

    // Touch events
    element.addEventListener('touchstart', touchHandlers.onTouchStart, { passive: false });
    element.addEventListener('touchmove', touchHandlers.onTouchMove, { passive: false });
    element.addEventListener('touchend', touchHandlers.onTouchEnd);

    // Mouse events for desktop
    element.addEventListener('mousedown', mouseHandlers.onMouseDown);
    
    return () => {
      element.removeEventListener('touchstart', touchHandlers.onTouchStart);
      element.removeEventListener('touchmove', touchHandlers.onTouchMove);
      element.removeEventListener('touchend', touchHandlers.onTouchEnd);
      element.removeEventListener('mousedown', mouseHandlers.onMouseDown);
    };
  }, [gestureState.isActive]);

  // Global mouse events
  useEffect(() => {
    if (gestureState.isActive) {
      document.addEventListener('mousemove', mouseHandlers.onMouseMove);
      document.addEventListener('mouseup', mouseHandlers.onMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', mouseHandlers.onMouseMove);
        document.removeEventListener('mouseup', mouseHandlers.onMouseUp);
      };
    }
  }, [gestureState.isActive]);

  // Calculate gesture progress for visual feedback
  const getGestureProgress = useCallback(() => {
    const { deltaX, deltaY, direction } = gestureState;
    
    if (!direction) {return 0;}
    
    const delta = direction === 'left' || direction === 'right' ? Math.abs(deltaX) : Math.abs(deltaY);
    return Math.min(delta / threshold, 1);
  }, [gestureState, threshold]);

  // Get gesture direction indicator
  const getDirectionIndicator = useCallback(() => {
    const { direction } = gestureState;
    const progress = getGestureProgress();
    
    return {
      direction,
      progress,
      isVisible: progress > 0.2,
      intensity: Math.min(progress * 2, 1)
    };
  }, [gestureState, getGestureProgress]);

  return {
    gestureRef,
    gestureState,
    getGestureProgress,
    getDirectionIndicator,
    isGestureActive: gestureState.isActive
  };
}
