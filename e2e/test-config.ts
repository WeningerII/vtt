/**
 * E2E Test Configuration
 * Centralized configuration for all e2e test settings
 */

export const E2E_CONFIG = {
  // Test timeouts
  timeouts: {
    test: 120000,
    expect: 5000,
    navigation: 10000,
    action: 5000,
  },

  // Retry configuration
  retries: {
    ci: 2,
    local: 1,
  },

  // Parallel execution
  workers: {
    ci: 4,
    local: 2,
  },

  // Test data limits
  limits: {
    maxTokensPerScene: 100,
    maxUsersPerTest: 10,
    maxChatMessages: 50,
    maxAssetsPerTest: 20,
  },

  // Performance thresholds
  performance: {
    pageLoadTime: 15000,
    apiResponseTime: 2000,
    websocketLatency: 500,
    memoryGrowthMB: 50,
    networkBandwidthKB: 500,
  },

  // Browser configurations
  browsers: {
    chromium: {
      headless: true,
      viewport: { width: 1280, height: 720 },
      video: "retain-on-failure",
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
    },
    firefox: {
      headless: true,
      viewport: { width: 1280, height: 720 },
      video: "retain-on-failure",
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
    },
    webkit: {
      headless: true,
      viewport: { width: 1280, height: 720 },
      video: "retain-on-failure",
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
    },
  },

  // Mobile device configurations
  mobile: {
    "iPhone 13": {
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
      isMobile: true,
      hasTouch: true,
    },
    iPad: {
      viewport: { width: 820, height: 1180 },
      userAgent: "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
      isMobile: true,
      hasTouch: true,
    },
  },

  // Test environment URLs
  urls: {
    server: "http://localhost:8080",
    client: "http://localhost:3000",
    websocket: "ws://localhost:8080/ws",
  },

  // Database configuration
  database: {
    testFile: "./test.db",
    resetBetweenTests: true,
    seedData: true,
  },

  // Test data patterns
  testData: {
    userPrefix: "test-user-",
    campaignPrefix: "test-campaign-",
    scenePrefix: "test-scene-",
    tokenPrefix: "test-token-",
  },

  // Feature flags for tests
  features: {
    enableWebSocket: true,
    enableRealTimeCollaboration: true,
    enablePerformanceTesting: true,
    enableStressTesting: process.env.STRESS_TEST_MODE === "true",
    enableCrossBrowserTesting: true,
  },

  // CI/CD specific settings
  ci: {
    shards: 4,
    maxFailures: 5,
    reportFormats: ["html", "json", "junit"],
    artifactRetentionDays: 7,
    videoRetentionDays: 3,
    traceRetentionDays: 3,
  },

  // Test categories and their priorities
  testCategories: {
    smoke: {
      priority: "high",
      timeout: 10000,
      retries: 3,
    },
    integration: {
      priority: "high",
      timeout: 30000,
      retries: 2,
    },
    e2e: {
      priority: "medium",
      timeout: 60000,
      retries: 2,
    },
    performance: {
      priority: "low",
      timeout: 120000,
      retries: 1,
    },
    stress: {
      priority: "low",
      timeout: 300000,
      retries: 0,
    },
  },

  // Selectors and test IDs
  selectors: {
    // Authentication
    loginForm: '[data-testid="login-form"]',
    usernameInput: '[data-testid="username-input"]',
    passwordInput: '[data-testid="password-input"]',
    loginButton: '[data-testid="login-button"]',

    // Navigation
    campaignsList: '[data-testid="campaigns-list"]',
    sceneCanvas: '[data-testid="scene-canvas"]',

    // Game elements
    token: '[data-testid="token"]',
    chatInput: '[data-testid="chat-input"]',
    chatMessage: '[data-testid="chat-message"]',
    initiativeTracker: '[data-testid="initiative-tracker"]',

    // Tools
    addTokenTool: '[data-testid="add-token-tool"]',
    drawingTool: '[data-testid="drawing-tool"]',
    measureTool: '[data-testid="measure-tool"]',

    // Status indicators
    connectionStatus: '[data-testid="connection-status"]',
    offlineIndicator: '[data-testid="offline-indicator"]',
    loadingIndicator: '[data-testid="loading-indicator"]',

    // Error handling
    errorBanner: '[data-testid="error-banner"]',
    errorMessage: '[data-testid="error-message"]',
    retryButton: '[data-testid="retry-button"]',
  },

  // API endpoints for testing
  apiEndpoints: {
    auth: "/api/auth",
    campaigns: "/api/campaigns",
    scenes: "/api/scenes",
    tokens: "/api/tokens",
    assets: "/api/assets",
    websocket: "/ws",
  },

  // Mock data configurations
  mocks: {
    enableApiMocks: false,
    enableWebSocketMocks: false,
    mockLatency: 100,
    mockFailureRate: 0.05,
  },

  // Accessibility testing
  accessibility: {
    enableA11yTesting: true,
    wcagLevel: "AA",
    includeWarnings: false,
  },

  // Security testing
  security: {
    enableSecurityTests: true,
    testCSP: true,
    testXSS: true,
    testSQLInjection: true,
  },
};

export default E2E_CONFIG;
