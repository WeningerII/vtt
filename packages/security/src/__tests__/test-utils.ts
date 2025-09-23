/**
 * Test Utilities for Timer Cleanup
 * Automatically tracks and cleans up instances with timers to prevent Jest hangs
 */

import {
  RateLimiter,
  TokenBucketRateLimiter,
  AdaptiveRateLimiter,
  RateLimiterManager,
} from "../RateLimiter";
import { AuthenticationManager } from "../AuthenticationManager";

// Import afterEach from Jest for auto-cleanup
declare const afterEach: (fn: () => void) => void;

// Registry to track all instances that need cleanup
const instanceRegistry = new Set<unknown>();

/**
 * Wrapper for RateLimiter that automatically tracks instances
 */
export class TestRateLimiter extends RateLimiter {
  constructor(...args: ConstructorParameters<typeof RateLimiter>) {
    super(...args);
    instanceRegistry.add(this);
  }
}

/**
 * Wrapper for TokenBucketRateLimiter that automatically tracks instances
 */
export class TestTokenBucketRateLimiter extends TokenBucketRateLimiter {
  constructor(...args: ConstructorParameters<typeof TokenBucketRateLimiter>) {
    super(...args);
    instanceRegistry.add(this);
  }
}

/**
 * Wrapper for AdaptiveRateLimiter that automatically tracks instances
 */
export class TestAdaptiveRateLimiter extends AdaptiveRateLimiter {
  constructor(...args: ConstructorParameters<typeof AdaptiveRateLimiter>) {
    super(...args);
    instanceRegistry.add(this);
  }
}

/**
 * Wrapper for RateLimiterManager that automatically tracks instances
 */
export class TestRateLimiterManager extends RateLimiterManager {
  constructor(...args: ConstructorParameters<typeof RateLimiterManager>) {
    super(...args);
    instanceRegistry.add(this);
  }
}

/**
 * Wrapper for AuthenticationManager that automatically tracks instances
 */
export class TestAuthenticationManager extends AuthenticationManager {
  constructor(...args: ConstructorParameters<typeof AuthenticationManager>) {
    super(...args);
    instanceRegistry.add(this);
  }
}

/**
 * Clean up all tracked instances - called automatically by Jest afterEach
 */
export function cleanupAllInstances(): void {
  instanceRegistry.forEach(instance => {
    if (instance.destroy && typeof instance.destroy === 'function') {
      try {
        instance.destroy();
      } catch (error) {
        console.warn('Error destroying instance:', error);
      }
    }
  });
  instanceRegistry.clear();
}

/**
 * Get count of tracked instances (for debugging)
 */
export function getTrackedInstanceCount(): number {
  return instanceRegistry.size;
}

// Auto-cleanup after each test
afterEach(() => {
  cleanupAllInstances();
});

// Export original classes for type compatibility
export { AuthenticationManager };
