import React, { useState, useEffect, useRef } from 'react';
import { logger } from '@vtt/logging';

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  renderCalls: number;
  tokenCount: number;
  networkLatency: number;
  spellEffects: number;
  physicsObjects: number;
}

interface PerformanceMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ isVisible, onToggle }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    renderCalls: 0,
    tokenCount: 0,
    networkLatency: 0,
    spellEffects: 0,
    physicsObjects: 0
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number>(null);

  // Performance monitoring loop
  useEffect(() => {
    const updateMetrics = () => {
      const now = performance.now();
      const deltaTime = now - lastTimeRef.current;
      
      frameCountRef.current++;
      
      // Calculate FPS every second
      if (deltaTime >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / deltaTime);
        const frameTime = deltaTime / frameCountRef.current;
        
        // Update FPS history for smoothing
        fpsHistoryRef.current.push(fps);
        if (fpsHistoryRef.current.length > 10) {
          fpsHistoryRef.current.shift();
        }
        
        const smoothedFps = fpsHistoryRef.current.reduce((acc, val) => acc + val, 0) / fpsHistoryRef.current.length;
        
        // Get memory usage if available
        const memoryUsage = (performance as any).memory 
          ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
          : 0;

        // Get network timing if available
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const networkLatency = navigation ? Math.round(navigation.responseEnd - navigation.requestStart) : 0;

        setMetrics(prev => ({
          ...prev,
          fps: Math.round(smoothedFps),
          frameTime: Math.round(frameTime * 100) / 100,
          memoryUsage,
          networkLatency,
          // These would be updated by the actual game systems
          renderCalls: prev.renderCalls,
          tokenCount: prev.tokenCount,
          spellEffects: prev.spellEffects,
          physicsObjects: prev.physicsObjects
        }));
        
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      animationFrameRef.current = requestAnimationFrame(updateMetrics);
    };

    if (isVisible) {
      animationFrameRef.current = requestAnimationFrame(updateMetrics);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible]);

  // Update game-specific metrics from global state
  useEffect(() => {
    const updateGameMetrics = () => {
      // In a real implementation, these would come from the game state
      const gameState = (window as any).__VTT_GAME_STATE__;
      if (gameState) {
        setMetrics(prev => ({
          ...prev,
          tokenCount: gameState.tokens?.length || 0,
          spellEffects: gameState.activeSpellEffects?.size || 0,
          physicsObjects: gameState.physicsObjects?.length || 0,
          renderCalls: gameState.lastFrameRenderCalls || 0
        }));
      }
    };

    const interval = setInterval(updateGameMetrics, 1000);
    return () => clearInterval(interval);
  }, []);

  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMemoryColor = (mb: number) => {
    if (mb < 100) return 'text-green-400';
    if (mb < 200) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg z-50 min-w-64">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-lg text-blue-400">Performance Monitor</h3>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-white text-xl leading-none"
         aria-label="Close" >
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        {/* Core Performance */}
        <div className="border-b border-gray-700 pb-2">
          <div className="font-semibold text-purple-400 mb-1">Core Performance</div>
          <div className="grid grid-cols-2 gap-2">
            <div>FPS: <span className={getPerformanceColor(metrics.fps, { good: 55, warning: 30 })}>{metrics.fps}</span></div>
            <div>Frame: <span className="text-cyan-400">{metrics.frameTime}ms</span></div>
            <div>Memory: <span className={getMemoryColor(metrics.memoryUsage)}>{metrics.memoryUsage}MB</span></div>
            <div>Latency: <span className="text-orange-400">{metrics.networkLatency}ms</span></div>
          </div>
        </div>

        {/* Game Systems */}
        <div className="border-b border-gray-700 pb-2">
          <div className="font-semibold text-green-400 mb-1">Game Systems</div>
          <div className="grid grid-cols-2 gap-2">
            <div>Tokens: <span className="text-yellow-400">{metrics.tokenCount}</span></div>
            <div>Renders: <span className="text-blue-400">{metrics.renderCalls}</span></div>
            <div>Spells: <span className="text-purple-400">{metrics.spellEffects}</span></div>
            <div>Physics: <span className="text-red-400">{metrics.physicsObjects}</span></div>
          </div>
        </div>

        {/* Performance Indicators */}
        <div>
          <div className="font-semibold text-orange-400 mb-1">Status</div>
          <div className="space-y-1">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${metrics.fps >= 55 ? 'bg-green-400' : metrics.fps >= 30 ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
              <span className="text-xs">Rendering: {metrics.fps >= 55 ? 'Excellent' : metrics.fps >= 30 ? 'Good' : 'Poor'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${metrics.memoryUsage < 100 ? 'bg-green-400' : metrics.memoryUsage < 200 ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
              <span className="text-xs">Memory: {metrics.memoryUsage < 100 ? 'Optimal' : metrics.memoryUsage < 200 ? 'Moderate' : 'High'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${metrics.networkLatency < 100 ? 'bg-green-400' : metrics.networkLatency < 300 ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
              <span className="text-xs">Network: {metrics.networkLatency < 100 ? 'Fast' : metrics.networkLatency < 300 ? 'Moderate' : 'Slow'}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t border-gray-700 pt-2">
          <div className="flex space-x-2">
            <button 
              className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
              onClick={() => {
                if ((performance as any).memory) {
                  logger.info('Memory Details:', (performance as any).memory);
                }
              }}
            >
              Log Memory
            </button>
            <button 
              className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
              onClick={() => {
                const gameState = (window as any).__VTT_GAME_STATE__;
                logger.info('Game State:', gameState);
              }}
            >
              Log State
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
