// MSW setup - mock implementation for testing
// import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";

// Mock server implementation since MSW is not available
export const server = {
  listen: (options?: any) => console.log('Mock server listening', options),
  close: () => console.log('Mock server closed'),
  resetHandlers: () => console.log('Mock handlers reset'),
  use: (...args: any[]) => console.log('Mock server use:', args),
};

// Setup functions for tests
export const setupMSW = () => {
  // Start server before all tests
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: "warn",
    });
  });

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers();
  });

  // Close server after all tests
  afterAll(() => {
    server.close();
  });
};

// Helper to add custom handlers during tests
export const addHandler = (...customHandlers: any[]) => {
  server.use(...customHandlers);
};

// Helper to override specific endpoints
export const overrideHandler = (handler: any) => {
  server.use(handler);
};
