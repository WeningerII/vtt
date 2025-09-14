/**
 * Performance Debug Panel
 * Lightweight performance monitoring for development
 */

import React, { useState, useEffect } from 'react';
import { Activity, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { usePerformanceMonitor } from '../../utils/performanceMonitor';

interface PerformancePanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function PerformancePanel({ isVisible, onToggle }: PerformancePanelProps) {
  const { getStats, getHealthStatus } = usePerformanceMonitor();
  const [stats, setStats] = useState(getStats());
  const [health, setHealth] = useState(getHealthStatus());

  useEffect(() => {
    if (!isVisible) {return;}

    const interval = setInterval(() => {
      setStats(getStats());
      setHealth(getHealthStatus());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [isVisible, getStats, getHealthStatus]);

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-bg-tertiary border border-border-primary rounded-lg p-2 text-text-secondary hover:text-text-primary transition-colors z-40"
        aria-label="Show performance panel"
      >
        <Activity className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-bg-secondary border border-border-primary rounded-lg p-4 shadow-xl z-40 min-w-[300px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent-primary" />
          <span className="font-medium text-text-primary">Performance</span>
        </div>
        <button
          onClick={onToggle}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Hide performance panel"
        >
          ×
        </button>
      </div>

      {/* Health Status */}
      <div className={`flex items-center gap-2 mb-3 p-2 rounded text-sm ${
        health.isHealthy 
          ? 'bg-color-success/10 text-color-success' 
          : 'bg-error/10 text-error'
      }`}>
        {health.isHealthy ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>{health.isHealthy ? 'Performance Good' : 'Issues Detected'}</span>
      </div>

      {/* Performance Metrics */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Dice Rolls:</span>
          <span className="text-text-primary">{stats.avgDiceRollTime}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Character Load:</span>
          <span className="text-text-primary">{stats.avgCharacterLoadTime}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Map Render:</span>
          <span className="text-text-primary">{stats.avgMapRenderTime}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Memory:</span>
          <span className="text-text-primary">{Math.round(stats.currentMemoryUsage)}MB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Metrics:</span>
          <span className="text-text-primary">{stats.totalMetrics}</span>
        </div>
      </div>

      {/* Issues */}
      {health.issues.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-secondary">
          <div className="text-xs text-text-tertiary mb-1">Issues:</div>
          {health.issues.map((issue, index) => (
            <div key={index} className="text-xs text-error">
              • {issue}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
