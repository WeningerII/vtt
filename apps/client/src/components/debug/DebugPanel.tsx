/**
 * Combined Debug Panel
 * Lightweight development tools for performance and accessibility monitoring
 */

import React, { useState } from 'react';
import { PerformancePanel } from './PerformancePanel';
import { AccessibilityPanel } from './AccessibilityPanel';

export function DebugPanel() {
  const [showPerformance, setShowPerformance] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);

  // Only show in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <>
      <PerformancePanel 
        isVisible={showPerformance}
        onToggle={() => setShowPerformance(!showPerformance)}
      />
      <AccessibilityPanel 
        isVisible={showAccessibility}
        onToggle={() => setShowAccessibility(!showAccessibility)}
      />
    </>
  );
}
