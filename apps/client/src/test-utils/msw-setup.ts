// MSW setup for API mocking in tests
import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";

export const server = setupServer(...handlers);

// Setup functions for tests
export const setupMSW = () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
};

// Helper to add custom handlers during tests
export const addHandler = (...customHandlers: any[]) => {
  server.use(...customHandlers);
};

// Helper to override specific endpoints
export const overrideHandler = (handler: any) => {
  server.use(handler);
};
