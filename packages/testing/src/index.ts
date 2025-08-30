/**
 * VTT Testing Framework
 * Comprehensive testing utilities for Virtual Tabletop system
 */

export { TestUtils } from "./TestUtils";

// Re-export common testing utilities
export {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
  vitest,
} from "vitest";

// Test suite exports
export * from "./unit/DiceRollerTests";
export * from "./unit/PhysicsTests";
// export * from './integration/GameSessionTests';
// export * from './e2e/VTTWorkflowTests';

// Common test types and interfaces
export interface TestConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
}

export interface PerformanceBenchmark {
  name: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  totalTime: number;
  iterations: number;
}

export interface MockWebSocketServer {
  port: number;
  clients: Set<any>;
  broadcast: (_message: string) => void;
  close: () => Promise<void>;
}

/**
 * Global test configuration
 */
export const TEST_CONFIG: TestConfig = {
  timeout: 10000,
  retries: 2,
  parallel: true,
};

/**
 * Create mock WebSocket server for testing
 */
export function createMockWebSocketServer(port: number = 0): any {
  const wss = new (require("ws").Server)({ port: port });
  const clients = new Set();

  wss.on("connection", (ws: any) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  return {
    port,
    clients,
    broadcast: (message: string) => {
      clients.forEach((client: any) => {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          client.send(message);
        }
      });
    },
    close: () =>
      new Promise<void>((resolve) => {
        wss.close((_err?: Error) => resolve());
      }),
  };
}
