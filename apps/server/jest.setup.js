// Jest setup file for server tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret';
process.env.SESSION_SECRET = 'test-session-secret';

// Suppress console output during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// Mock external dependencies
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  }))
}));

jest.mock('ws', () => ({
  WebSocket: jest.fn(),
  WebSocketServer: jest.fn()
}));

// Increase timeout for async operations
jest.setTimeout(30000);
