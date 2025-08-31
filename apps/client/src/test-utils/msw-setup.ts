import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";

// Setup MSW server for Node.js environment (Jest tests)
export const server = setupServer(...handlers);

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
