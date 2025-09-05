/**
 * Advanced Touch Gesture Hook for VTT Battle Map
 * Provides comprehensive touch gesture recognition and handling
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

export interface TouchPoint {
  x: number;
  y: number;
  id: number;
}

export interface GestureState {
  // Pan gesture
  isPanning: boolean;
  panDelta: { x: number; y: number };
  panVelocity: { x: number; y: number };
  
  // Pinch gesture
  isPinching: boolean;
  pinchScale: number;
  pinchCenter: { x: number; y: number };
  
  // Tap gestures
  isDoubleTap: boolean;
  tapCount: number;
  lastTapTime: number;
  
  // Long press
  isLongPress: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

export interface TouchGestureCallbacks {
  onPanStart?: (point: TouchPoint) => void;
  onPanMove?: (delta: { x: number; y: number }, velocity: { x: number; y: number }) => void;
  onPanEnd?: (velocity: { x: number; y: number }) => void;
  
  onPinchStart?: (center: { x: number; y: number }, initialScale: number) => void;
  onPinchMove?: (scale: number, center: { x: number; y: number }) => void;
  onPinchEnd?: (finalScale: number) => void;
  
  onTap?: (point: TouchPoint) => void;
  onDoubleTap?: (point: TouchPoint) => void;
  onLongPress?: (point: TouchPoint) => void;
}

const DOUBLE_TAP_DELAY = 300; // ms
const LONG_PRESS_DELAY = 500; // ms
const MIN_PINCH_DISTANCE = 10; // pixels
const MOMENTUM_DECAY = 0.95;
const VELOCITY_THRESHOLD = 0.1;

export const useTouchGestures = (callbacks: TouchGestureCallbacks = {}) => {
  const [gestureState, setGestureState] = useState<GestureState>({
    isPanning: false,
    panDelta: { x: 0, y: 0 },
    panVelocity: { x: 0, y: 0 },
    isPinching: false,
    pinchScale: 1,
    pinchCenter: { x: 0, y: 0 },
    isDoubleTap: false,
    tapCount: 0,
    lastTapTime: 0,
    isLongPress: false,
    longPressTimer: null,
  });

  const touchStartRef = useRef<TouchPoint[]>([]);
  const lastTouchRef = useRef<TouchPoint[]>([]);
  const lastTimestampRef = useRef<number>(0);
  const initialPinchDistanceRef = useRef<number>(0);
  const momentumAnimationRef = useRef<number | null>(null);

  // Helper functions
  const getTouchPoint = useCallback((touch: React.Touch): TouchPoint => ({
    x: touch.clientX,
    y: touch.clientY,
    id: touch.identifier,
  }), []);

  const getTouchDistance = useCallback((point1: TouchPoint, point2: TouchPoint): number => {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  }, []);

  const getTouchCenter = useCallback((points: TouchPoint[]): { x: number; y: number } => {
    if (points.length === 0) {return { x: 0, y: 0 };}
    
    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );
    
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }, []);

  const calculateVelocity = useCallback((
    current: TouchPoint[],
    previous: TouchPoint[],
    deltaTime: number
  ): { x: number; y: number } => {
    if (current.length === 0 || previous.length === 0 || deltaTime === 0) {
      return { x: 0, y: 0 };
    }

    const currentCenter = getTouchCenter(current);
    const previousCenter = getTouchCenter(previous);
    
    return {
      x: (currentCenter.x - previousCenter.x) / deltaTime,
      y: (currentCenter.y - previousCenter.y) / deltaTime,
    };
  }, [getTouchCenter]);

  const clearLongPressTimer = useCallback(() => {
    if (gestureState.longPressTimer) {
      clearTimeout(gestureState.longPressTimer);
      setGestureState(prev => ({ ...prev, longPressTimer: null }));
    }
  }, [gestureState.longPressTimer]);

  const startMomentumAnimation = useCallback((velocity: { x: number; y: number }) => {
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
    }

    const currentVelocity = { ...velocity };

    const animate = () => {
      if (Math.abs(currentVelocity.x) < VELOCITY_THRESHOLD && 
          Math.abs(currentVelocity.y) < VELOCITY_THRESHOLD) {
        momentumAnimationRef.current = null;
        return;
      }

      callbacks.onPanMove?.(currentVelocity, currentVelocity);
      
      currentVelocity.x *= MOMENTUM_DECAY;
      currentVelocity.y *= MOMENTUM_DECAY;
      
      momentumAnimationRef.current = requestAnimationFrame(animate);
    };

    momentumAnimationRef.current = requestAnimationFrame(animate);
  }, [callbacks]);

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    e.preventDefault();
    
    const touches = Array.from(e.touches).map((touch) => getTouchPoint(touch));
    const now = Date.now();
    
    touchStartRef.current = touches;
    lastTouchRef.current = touches;
    lastTimestampRef.current = now;

    // Clear any existing momentum
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
      momentumAnimationRef.current = null;
    }

    if (touches.length === 1) {
      // Single touch - potential pan, tap, or long press
      const touch = touches[0]!;
      
      // Handle double tap detection
      const timeSinceLastTap = now - gestureState.lastTapTime;
      if (timeSinceLastTap < DOUBLE_TAP_DELAY && gestureState.tapCount === 1) {
        setGestureState(prev => ({
          ...prev,
          isDoubleTap: true,
          tapCount: 2,
        }));
        callbacks.onDoubleTap?.(touch);
        clearLongPressTimer();
      } else {
        setGestureState(prev => ({
          ...prev,
          tapCount: 1,
          lastTapTime: now,
          isDoubleTap: false,
        }));
        
        // Start long press timer
        const timer = setTimeout(() => {
          setGestureState(prev => ({ ...prev, isLongPress: true }));
          callbacks.onLongPress?.(touch);
        }, LONG_PRESS_DELAY);
        
        setGestureState(prev => ({ ...prev, longPressTimer: timer as ReturnType<typeof setTimeout> }));
      }
      
      callbacks.onPanStart?.(touch);
    } else if (touches.length === 2) {
      // Two touches - pinch gesture
      clearLongPressTimer();
      
      const distance = getTouchDistance(touches[0]!, touches[1]!);
      const center = getTouchCenter(touches);
      
      if (distance > MIN_PINCH_DISTANCE) {
        initialPinchDistanceRef.current = distance;
        
        setGestureState(prev => ({
          ...prev,
          isPinching: true,
          pinchScale: 1,
          pinchCenter: center,
          isPanning: false,
        }));
        
        callbacks.onPinchStart?.(center, 1);
      }
    }
  }, [callbacks, gestureState.lastTapTime, gestureState.tapCount, getTouchPoint, getTouchDistance, getTouchCenter, clearLongPressTimer]);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    e.preventDefault();
    
    const touches = Array.from(e.touches).map((touch) => getTouchPoint(touch));
    const now = Date.now();
    const deltaTime = now - lastTimestampRef.current;
    
    if (touches.length === 1 && !gestureState.isPinching) {
      // Single touch panning
      const current = touches[0]!;
      const start = touchStartRef.current[0];
      
      if (start) {
        const delta = {
          x: current.x - start.x,
          y: current.y - start.y,
        };
        
        const velocity = calculateVelocity(touches, lastTouchRef.current, deltaTime);
        
        // Clear long press if moving
        if (Math.abs(delta.x) > 10 || Math.abs(delta.y) > 10) {
          clearLongPressTimer();
          
          if (!gestureState.isPanning) {
            setGestureState(prev => ({ ...prev, isPanning: true }));
          }
        }
        
        setGestureState(prev => ({
          ...prev,
          panDelta: delta,
          panVelocity: velocity,
        }));
        
        callbacks.onPanMove?.(delta, velocity);
      }
    } else if (touches.length === 2 && gestureState.isPinching) {
      // Two touch pinch
      const currentDistance = getTouchDistance(touches[0]!, touches[1]!);
      const center = getTouchCenter(touches);
      
      if (initialPinchDistanceRef.current > 0) {
        const scale = currentDistance / initialPinchDistanceRef.current;
        
        setGestureState(prev => ({
          ...prev,
          pinchScale: scale,
          pinchCenter: center,
        }));
        
        callbacks.onPinchMove?.(scale, center);
      }
    }
    
    lastTouchRef.current = touches;
    lastTimestampRef.current = now;
  }, [callbacks, gestureState.isPinching, gestureState.isPanning, getTouchPoint, getTouchDistance, getTouchCenter, calculateVelocity, clearLongPressTimer]);

  const handleTouchEnd = useCallback((e: ReactTouchEvent) => {
    e.preventDefault();
    
    const touches = Array.from(e.touches).map((touch) => getTouchPoint(touch));
    const now = Date.now();
    
    // Handle tap if no movement and not long press
    if (touches.length === 0 && touchStartRef.current.length === 1 && 
        !gestureState.isPanning && !gestureState.isLongPress) {
      const startTouch = touchStartRef.current[0];
      if (startTouch && !gestureState.isDoubleTap) {
        callbacks.onTap?.(startTouch);
      }
    }
    
    // Handle pan end with momentum
    if (gestureState.isPanning && touches.length === 0) {
      const velocity = gestureState.panVelocity;
      callbacks.onPanEnd?.(velocity);
      
      // Start momentum animation if velocity is significant
      if (Math.abs(velocity.x) > VELOCITY_THRESHOLD || Math.abs(velocity.y) > VELOCITY_THRESHOLD) {
        startMomentumAnimation(velocity);
      }
    }
    
    // Handle pinch end
    if (gestureState.isPinching && touches.length < 2) {
      callbacks.onPinchEnd?.(gestureState.pinchScale);
    }
    
    // Reset gesture state
    if (touches.length === 0) {
      clearLongPressTimer();
      setGestureState(prev => ({
        ...prev,
        isPanning: false,
        isPinching: false,
        isLongPress: false,
        panDelta: { x: 0, y: 0 },
        panVelocity: { x: 0, y: 0 },
      }));
      
      touchStartRef.current = [];
    }
    
    lastTouchRef.current = touches;
    lastTimestampRef.current = now;
  }, [callbacks, gestureState, getTouchPoint, clearLongPressTimer, startMomentumAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer();
      if (momentumAnimationRef.current) {
        cancelAnimationFrame(momentumAnimationRef.current);
      }
    };
  }, [clearLongPressTimer]);

  return {
    gestureState,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
};

export default useTouchGestures;
