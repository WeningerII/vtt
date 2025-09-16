/**
 * Accessibility Debug Panel
 * Lightweight a11y testing for development
 */

import React, { useState, useCallback } from 'react';
import { Eye, Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useAccessibilityTester, gamingAccessibilityTester } from '../../utils/accessibilityTester';
import { logger } from '@vtt/logging';

interface AccessibilityPanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function AccessibilityPanel({ isVisible, onToggle }: AccessibilityPanelProps) {
  const { runTests, quickCheck } = useAccessibilityTester();
  const [isRunning, setIsRunning] = useState(false);
  const [lastReport, setLastReport] = useState<any>(null);
  const [quickStatus, setQuickStatus] = useState(quickCheck());

  const handleRunTests = useCallback(async () => {
    setIsRunning(true);
    try {
      const report = await runTests();
      setLastReport(report);
      setQuickStatus(quickCheck());
    } catch (error) {
      logger.error('Accessibility test failed:', error as any);
    } finally {
      setIsRunning(false);
    }
  }, [runTests, quickCheck]);

  const handleQuickCheck = useCallback(() => {
    setQuickStatus(quickCheck());
  }, [quickCheck]);

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-16 right-4 bg-bg-tertiary border border-border-primary rounded-lg p-2 text-text-secondary hover:text-text-primary transition-colors z-40"
        aria-label="Show accessibility panel"
      >
        <Eye className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-16 right-4 bg-bg-secondary border border-border-primary rounded-lg p-4 shadow-xl z-40 min-w-[300px] max-h-[400px] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent-primary" />
          <span className="font-medium text-text-primary">Accessibility</span>
        </div>
        <button
          onClick={onToggle}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Hide accessibility panel"
        >
          ×
        </button>
      </div>

      {/* Quick Status */}
      <div className={`flex items-center gap-2 mb-3 p-2 rounded text-sm ${
        quickStatus.score > 80 
          ? 'bg-color-success/10 text-color-success' 
          : quickStatus.score > 60
          ? 'bg-warning/10 text-warning'
          : 'bg-error/10 text-error'
      }`}>
        {quickStatus.score > 80 ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>Score: {quickStatus.score}/100</span>
        {quickStatus.criticalIssues > 0 && (
          <span>({quickStatus.criticalIssues} issues)</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleQuickCheck}
          className="flex-1 bg-bg-tertiary hover:bg-bg-quaternary text-text-primary px-3 py-2 rounded text-sm transition-colors"
        >
          Quick Check
        </button>
        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="flex-1 bg-accent-primary hover:bg-accent-secondary text-text-primary px-3 py-2 rounded text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Testing...
            </>
          ) : (
            'Full Test'
          )}
        </button>
      </div>

      {/* Test Results */}
      {lastReport && (
        <div className="space-y-2 text-sm border-t border-border-secondary pt-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">Passed:</span>
            <span className="text-color-success">{lastReport.passed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Failed:</span>
            <span className="text-error">{lastReport.failed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Warnings:</span>
            <span className="text-warning">{lastReport.warnings}</span>
          </div>
          
          {/* Top Issues */}
          {lastReport.issues.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-text-tertiary mb-1">Top Issues:</div>
              {lastReport.issues.slice(0, 3).map((issue: any, index: number) => (
                <div key={index} className="text-xs mb-1">
                  <span className={
                    issue.severity === 'error' ? 'text-error' : 
                    issue.severity === 'warning' ? 'text-warning' : 'text-text-tertiary'
                  }>
                    • {issue.message}
                  </span>
                </div>
              ))}
              {lastReport.issues.length > 3 && (
                <div className="text-xs text-text-tertiary">
                  +{lastReport.issues.length - 3} more issues
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Gaming-Specific Checks */}
      <div className="mt-3 pt-3 border-t border-border-secondary">
        <div className="text-xs text-text-tertiary mb-2">Gaming Components:</div>
        <button
          onClick={() => {
            const diceIssues = gamingAccessibilityTester.checkDiceRollerA11y();
            const charIssues = gamingAccessibilityTester.checkCharacterSheetA11y();
            logger.info('Dice accessibility:', diceIssues);
            logger.info('Character sheet accessibility:', charIssues);
          }}
          className="w-full bg-bg-tertiary hover:bg-bg-quaternary text-text-primary px-3 py-1 rounded text-xs transition-colors"
        >
          Check Gaming A11y
        </button>
      </div>
    </div>
  );
}
