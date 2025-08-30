/**
 * Jest Setup File
 * Global test configuration and utilities
 */

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },
});

// Global test utilities
global.testUtils = {
  // Create mock user data
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    roles: ['user'],
    permissions: ['read:own', 'write:own'],
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // Create mock scene data
  createMockScene: (overrides = {}) => ({
    id: 'test-scene-id',
    name: 'Test Scene',
    width: 800,
    height: 600,
    gridSize: 50,
    backgroundColor: '#ffffff',
    tokens: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // Create mock token data
  createMockToken: (overrides = {}) => ({
    id: 'test-token-id',
    name: 'Test Token',
    x: 100,
    y: 100,
    size: 1,
    color: '#ff0000',
    imageUrl: 'https://example.com/token.png',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // Create mock asset data
  createMockAsset: (overrides = {}) => ({
    id: 'test-asset-id',
    name: 'Test Asset',
    type: 'image',
    filename: 'test.png',
    size: 1024,
    mimeType: 'image/png',
    tags: ['test'],
    metadata: Record<string, unknown>,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // Sleep utility for async tests
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Random data generators
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  randomEmail: () => {
    return `test${Math.floor(Math.random() * 10000)}@example.com`;
  },
  
  // Mock HTTP request/response objects
  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    url: '/test',
    headers: Record<string, unknown>,
    body: Record<string, unknown>,
    params: Record<string, unknown>,
    query: Record<string, unknown>,
    ip: '127.0.0.1',
    ...overrides,
  }),
  
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    return res;
  },
};

// Global test hooks
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset console methods to prevent test pollution
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests
});

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.DATABASE_URL = 'memory://test-db';

// Mock external dependencies that aren't available in test environment
jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
    toFormat: jest.fn().mockReturnThis(),
    metadata: jest.fn().mockResolvedValue({
      width: 100,
      height: 100,
      format: 'png',
    }),
  })),
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock-file-data')),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
      size: 1024,
      mtime: new Date(),
    }),
  },
}));

// Mock WebSocket for testing real-time features
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    
    // Simulate connection opening
    setTimeout(() => {
      if (this.onopen) this.onopen({ type: 'open' });
    }, 0);
  }
  
  send(data) {
    // Mock send - could be extended for testing
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ type: 'close' });
  }
};

// Mock Canvas API for rendering tests (only if HTMLCanvasElement exists)
if (typeof HTMLCanvasElement !== 'undefined') {
  global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4),
    })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4),
    })),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    translate: jest.fn(),
  }));
}

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
};

// Mock crypto API for security tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Add custom assertions for VTT-specific testing
expect.extend({
  toBeValidScene(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.width === 'number' &&
      typeof received.height === 'number' &&
      Array.isArray(received.tokens);
    
    return {
      message: () => pass
        ? `expected ${received} not to be a valid scene`
        : `expected ${received} to be a valid scene`,
      pass,
    };
  },
  
  toBeValidToken(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.x === 'number' &&
      typeof received.y === 'number' &&
      typeof received.size === 'number';
    
    return {
      message: () => pass
        ? `expected ${received} not to be a valid token`
        : `expected ${received} to be a valid token`,
      pass,
    };
  },
  
  toBeValidAsset(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.type === 'string' &&
      typeof received.filename === 'string';
    
    return {
      message: () => pass
        ? `expected ${received} not to be a valid asset`
        : `expected ${received} to be a valid asset`,
      pass,
    };
  },
});
