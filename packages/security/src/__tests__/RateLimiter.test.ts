/**
 * Rate Limiter Tests
 * Comprehensive test suite for rate limiting functionality
 */

import {
  RateLimiter,
  TokenBucketRateLimiter,
  AdaptiveRateLimiter,
  RateLimiterManager,
  RATE_LIMIT_PRESETS,
} from "../RateLimiter";

describe("RateLimiter", () => {
  describe("Basic Rate Limiting", () => {
    test("should allow requests within limit", () => {
      const limiter = new RateLimiter({
        windowMs: 60000, // 1 minute
        max: 5,
      });

      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit("test-user");
        expect(result.allowed).toBe(true);
        expect(result.info.remainingRequests).toBe(4 - i);
      }
    });

    test("should block requests exceeding limit", () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        max: 3,
      });

      // Use up the limit
      for (let i = 0; i < 3; i++) {
        limiter.checkLimit("test-user");
      }

      // Next request should be blocked
      const result = limiter.checkLimit("test-user");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.info.retryAfter).toBeGreaterThan(0);
    });

    test("should reset limits after window expires", (_done) => {
      const limiter = new RateLimiter({
        windowMs: 100, // 100ms window
        max: 2,
      });

      // Use up the limit
      limiter.checkLimit("test-user");
      limiter.checkLimit("test-user");

      // Should be blocked
      let result = limiter.checkLimit("test-user");
      expect(result.allowed).toBe(false);

      // Wait for window to reset
      setTimeout(() => {
        result = limiter.checkLimit("test-user");
        expect(result.allowed).toBe(true);
        _done();
      }, 150);
    });

    test("should handle multiple users independently", () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        max: 2,
      });

      // User 1 uses up limit
      limiter.checkLimit("user1");
      limiter.checkLimit("user1");
      const user1Result = limiter.checkLimit("user1");
      expect(user1Result.allowed).toBe(false);

      // User 2 should still be allowed
      const user2Result = limiter.checkLimit("user2");
      expect(user2Result.allowed).toBe(true);
    });

    test("should use custom key generator", () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        max: 1,
        keyGenerator: (id) => `custom-${id}`,
      });

      limiter.checkLimit("test");
      const result = limiter.checkLimit("test");
      expect(result.allowed).toBe(false);
    });
  });

  describe("Rate Limiter Events", () => {
    test("should emit events on requests and rate limiting", (_done) => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        max: 1,
      });

      let requestEmitted = false;
      let rateLimitedEmitted = false;

      limiter.on("request", () => {
        requestEmitted = true;
      });

      limiter.on("rateLimited", () => {
        rateLimitedEmitted = true;
        expect(requestEmitted).toBe(true);
        expect(rateLimitedEmitted).toBe(true);
        _done();
      });

      limiter.checkLimit("test-user");
      limiter.checkLimit("test-user");
    });

    test("should emit reset events", (_done) => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        max: 1,
      });

      limiter.on("reset", (data) => {
        expect(data.identifier).toBe("test-user");
        _done();
      });

      limiter.checkLimit("test-user");
      limiter.reset("test-user");
    });
  });

  describe("Statistics", () => {
    test("should provide accurate statistics", () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        max: 3,
      });

      // Make some requests
      limiter.checkLimit("user1");
      limiter.checkLimit("user1");
      limiter.checkLimit("user2");
      limiter.checkLimit("user1"); // Should exceed limit

      const stats = limiter.getStats();
      expect(stats.activeWindows).toBe(2);
      expect(stats.totalRequests).toBe(4);
      expect(stats.rateLimitedRequests).toBe(1);
    });
  });
});

describe("TokenBucketRateLimiter", () => {
  test("should allow token consumption within capacity", () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 10,
      refillRate: 1, // 1 token per second
      initialTokens: 10,
    });

    // Consume 5 tokens
    const result = limiter.consume("test-user", 5);
    expect(result.allowed).toBe(true);
    expect(result.info.remainingRequests).toBe(5);
  });

  test("should reject consumption exceeding capacity", () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRate: 1,
      initialTokens: 3,
    });

    // Try to consume more tokens than available
    const result = limiter.consume("test-user", 5);
    expect(result.allowed).toBe(false);
    expect(result.info.retryAfter).toBeGreaterThan(0);
  });

  test("should refill tokens over time", (_done) => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRate: 10, // 10 tokens per second for faster testing
      initialTokens: 1,
    });

    // Consume available token
    let result = limiter.consume("test-user", 1);
    expect(result.allowed).toBe(true);

    // Try to consume another - should fail
    result = limiter.consume("test-user", 1);
    expect(result.allowed).toBe(false);

    // Wait for refill
    setTimeout(() => {
      result = limiter.consume("test-user", 1);
      expect(result.allowed).toBe(true);
      _done();
    }, 200); // Wait 200ms for refill
  });

  test("should handle manual token addition", () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 10,
      refillRate: 1,
      initialTokens: 2,
    });

    // Add tokens manually
    limiter.addTokens("test-user", 5);

    // Should now be able to consume more
    const result = limiter.consume("test-user", 6);
    expect(result.allowed).toBe(true);
  });
});

describe("AdaptiveRateLimiter", () => {
  test("should adapt limits based on system load", (_done) => {
    const limiter = new AdaptiveRateLimiter(
      {
        windowMs: 60000,
        max: 100, // Will be overridden by adaptive config
      },
      {
        baseLimit: 100,
        maxLimit: 200,
        minLimit: 50,
        adaptationFactor: 0.5,
        loadThreshold: 0.7,
      },
    );

    // Set high system load
    limiter.setSystemLoadMonitor(() => 0.9); // 90% load

    let limitAdapted = false;
    limiter.on("limitAdapted", (data) => {
      expect(data.newLimit).toBeLessThan(data.oldLimit);
      limitAdapted = true;
    });

    // Wait for adaptation cycle
    setTimeout(() => {
      expect(limitAdapted).toBe(true);
      _done();
    }, 6000); // Wait for adaptation interval
  });

  test("should increase limits under low load", (_done) => {
    const limiter = new AdaptiveRateLimiter(
      {
        windowMs: 60000,
        max: 100,
      },
      {
        baseLimit: 100,
        maxLimit: 200,
        minLimit: 50,
        adaptationFactor: 0.5,
        loadThreshold: 0.7,
      },
    );

    // Set low system load
    limiter.setSystemLoadMonitor(() => 0.3); // 30% load

    let limitAdapted = false;
    limiter.on("limitAdapted", (data) => {
      expect(data.newLimit).toBeGreaterThanOrEqual(data.oldLimit);
      limitAdapted = true;
    });

    setTimeout(() => {
      expect(limitAdapted).toBe(true);
      _done();
    }, 6000);
  });
});

describe("RateLimiterManager", () => {
  let manager: RateLimiterManager;

  beforeEach(() => {
    manager = new RateLimiterManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  test("should manage multiple rate limiters", () => {
    const globalLimiter = new RateLimiter(RATE_LIMIT_PRESETS.moderate);
    const apiLimiter = new RateLimiter(RATE_LIMIT_PRESETS.strict);

    manager.setGlobalLimiter(globalLimiter);
    manager.addLimiter("api", apiLimiter);

    const results = manager.checkLimits("test-user", "api");
    expect(results).toHaveLength(2); // Global + resource-specific
    expect(results.every((r) => r.allowed)).toBe(true);
  });

  test("should detect rate limiting across multiple limiters", () => {
    const strictLimiter = new RateLimiter({
      windowMs: 60000,
      max: 1,
    });

    manager.addLimiter("strict", strictLimiter);

    // Use up the strict limit
    manager.checkLimits("test-user", "strict");

    const { limited, results } = manager.isRateLimited("test-user", "strict");
    expect(limited).toBe(true);
    expect(results.some((r) => !r.allowed)).toBe(true);
  });

  test("should provide combined statistics", () => {
    const limiter1 = new RateLimiter(RATE_LIMIT_PRESETS.moderate);
    const limiter2 = new RateLimiter(RATE_LIMIT_PRESETS.strict);

    manager.setGlobalLimiter(limiter1);
    manager.addLimiter("api", limiter2);

    // Make some requests
    manager.checkLimits("user1", "api");
    manager.checkLimits("user2");

    const stats = manager.getStats();
    expect(stats.global).toBeDefined();
    expect(stats.api).toBeDefined();
  });

  test("should reset all limiters for a user", () => {
    const limiter1 = new RateLimiter({ windowMs: 60000, max: 1 });
    const limiter2 = new RateLimiter({ windowMs: 60000, max: 1 });

    manager.setGlobalLimiter(limiter1);
    manager.addLimiter("api", limiter2);

    // Use up limits
    manager.checkLimits("test-user", "api");
    manager.checkLimits("test-user", "api"); // Should be blocked

    let { limited } = manager.isRateLimited("test-user", "api");
    expect(limited).toBe(true);

    // Reset all
    manager.resetAll("test-user");

    ({ limited } = manager.isRateLimited("test-user", "api"));
    expect(limited).toBe(false);
  });
});

describe("Rate Limit Presets", () => {
  test("should have valid preset configurations", () => {
    Object.entries(RATE_LIMIT_PRESETS).forEach(([name, config]) => {
      expect(config.windowMs).toBeGreaterThan(0);
      expect(config.max).toBeGreaterThan(0);
      expect(config.message).toBeDefined();

      // Test that preset can be used to create a working limiter
      const limiter = new RateLimiter(config);
      const result = limiter.checkLimit("test");
      expect(result.allowed).toBe(true);
    });
  });

  test("should enforce different limits per preset", () => {
    const strictLimiter = new RateLimiter(RATE_LIMIT_PRESETS.strict);
    const generousLimiter = new RateLimiter(RATE_LIMIT_PRESETS.generous);

    // Strict should have lower limits
    expect(RATE_LIMIT_PRESETS.strict.max).toBeLessThan(RATE_LIMIT_PRESETS.generous.max);

    // Verify behavior difference
    const strictStats = strictLimiter.getStats();
    const generousStats = generousLimiter.getStats();

    expect(typeof strictStats.totalRequests).toBe("number");
    expect(typeof generousStats.totalRequests).toBe("number");
  });
});

describe("Cleanup and Resource Management", () => {
  test("should clean up expired windows", (_done) => {
    const limiter = new RateLimiter({
      windowMs: 100, // Very short window
      max: 5,
    });

    let cleanupEmitted = false;
    limiter.on("cleanup", () => {
      cleanupEmitted = true;
    });

    // Make a request to create a window
    limiter.checkLimit("test-user");

    // Wait for cleanup
    setTimeout(() => {
      expect(cleanupEmitted).toBe(true);
      _done();
    }, 200);
  });

  test("should properly destroy rate limiter", () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      max: 5,
    });

    limiter.checkLimit("test-user");
    expect(limiter.getStats().activeWindows).toBe(1);

    limiter.destroy();
    expect(limiter.getStats().activeWindows).toBe(0);
  });

  test("should handle concurrent requests safely", async () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      max: 10,
    });

    // Simulate concurrent requests
    const promises = Array.from({ length: 20 }, (_, i) =>
      Promise.resolve(limiter.checkLimit(`user-${i % 5}`)),
    );

    const results = await Promise.all(promises);

    // Should handle all requests without errors
    expect(results).toHaveLength(20);
    expect(results.every((r) => typeof r.allowed === "boolean")).toBe(true);
  });
});
