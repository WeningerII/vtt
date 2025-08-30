// Platform detection and cross-platform support
export { PlatformDetection } from './PlatformDetection';
export type {
  PlatformInfo,
  FeatureSupport
} from './PlatformDetection';

export { CrossPlatformAdapter } from './CrossPlatformAdapter';
export type {
  PlatformAdapter,
  PerformanceMetrics,
  AdaptiveSettings
} from './CrossPlatformAdapter';

// Utility functions for common platform checks
export function isMobileDevice(): boolean {
  const detection = new PlatformDetection();
  return detection.isMobile();
}

export function isHighPerformanceDevice(): boolean {
  const detection = new PlatformDetection();
  return detection.isHighPerformance();
}

export function getOptimalSettings(): AdaptiveSettings {
  const adapter = new CrossPlatformAdapter();
  return adapter.getAdaptiveSettings();
}

export function generateCompatibilityReport(): string {
  const detection = new PlatformDetection();
  return detection.generateCompatibilityReport();
}
