/**
 * Testing utilities for VTT components
 */

import { World } from "@vtt/core-ecs";
import { PhysicsWorld } from "@vtt/physics";
import { GameSession, Player } from "@vtt/net";
import { DiceRoller } from "@vtt/rules-5e";

export interface TestWorld {
  ecs: World;
  physics: PhysicsWorld;
  cleanup: () => void;
}

export interface TestSession {
  session: GameSession;
  players: Player[];
  cleanup: () => void;
}

export class TestUtils {
  /**
   * Create a test ECS world with physics
   */
  static createTestWorld(entityCount: number = 100): TestWorld {
    const ecs = new World(entityCount);
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: 0 },
      cellSize: 50,
    });

    return {
      ecs,
      physics,
      cleanup: () => {
        physics.clear();
      },
    };
  }

  /**
   * Create a test game session with mock players
   */
  static createTestSession(playerCount: number = 4): TestSession {
    const sessionId = `test-session-${Date.now()}`;
    const session = new GameSession(sessionId);
    const players: Player[] = [];

    for (let i = 0; i < playerCount; i++) {
      const player: Player = {
        id: `player-${i}`,
        name: `TestPlayer${i}`,
        role: i === 0 ? "gm" : "player",
        characterIds: [`char-${i}`],
        connected: true,
        lastSeen: Date.now(),
      };

      players.push(player);
      session.addPlayer(player);
    }

    return {
      session,
      players,
      cleanup: () => {
        session.destroy();
      },
    };
  }

  /**
   * Create a deterministic dice roller for testing
   */
  static createTestDiceRoller(sequence: number[]): DiceRoller {
    let index = 0;
    const mockRng = (): number => {
      const value = sequence[index % sequence.length];
      index++;
      return value;
    };

    return new DiceRoller(mockRng);
  }

  /**
   * Create mock WebGL context for renderer tests
   */
  static createMockWebGLContext(): WebGL2RenderingContext {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;

    if (!gl) {
      throw new Error("WebGL2 not supported in test environment");
    }

    return gl;
  }

  /**
   * Wait for a condition to be true
   */
  static async waitForCondition(condition: () => boolean, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Condition not met within ${timeout}ms`);
      }
      await this.delay(50);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  }

  /**
   * Generate test entity data
   */
  static generateTestEntities(count: number): Array<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    const entities = [];

    for (let i = 0; i < count; i++) {
      entities.push({
        id: i,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        width: 10 + Math.random() * 40,
        height: 10 + Math.random() * 40,
      });
    }

    return entities;
  }

  /**
   * Create mock analytics data
   */
  static createMockAnalyticsData(eventCount: number = 100): Array<{
    type: string;
    timestamp: number;
    data: Record<string, any>;
  }> {
    const events = [];
    const eventTypes = ["user_action", "system_event", "error", "performance"];

    for (let i = 0; i < eventCount; i++) {
      events.push({
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        timestamp: Date.now() - Math.random() * 86400000, // Last 24 hours
        data: {
          userId: `user-${Math.floor(Math.random() * 10)}`,
          sessionId: `session-${Math.floor(Math.random() * 5)}`,
          value: Math.random() * 100,
        },
      });
    }

    return events;
  }

  /**
   * Capture console output for testing
   */
  static captureConsole(): {
    logs: string[];
    errors: string[];
    warns: string[];
    restore: () => void;
  } {
    const logs: string[] = [];
    const errors: string[] = [];
    const warns: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => logs.push(args.join(" "));
    console.error = (...args) => errors.push(args.join(" "));
    console.warn = (...args) => warns.push(args.join(" "));

    return {
      logs,
      errors,
      warns,
      restore: () => {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
      },
    };
  }

  /**
   * Mock fetch for network tests
   */
  static createMockFetch(url: string, response: any): jest.Mock {
    const mockFetch = jest.fn((fetchUrl: string) => {
      if (fetchUrl === url) {
        return Promise.resolve({
          url: fetchUrl,
          ok: true,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(JSON.stringify(response)),
        } as any);
      } else {
        throw new Error(`No mock response for ${fetchUrl}`);
      }
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    return {
      restore: () => {
        global.fetch = originalFetch;
      },
    };
  }

  /**
   * Create performance benchmark
   */
  static async measurePerformance(
    fn: () => Promise<void> | void,
    times: number = 10,
  ): Promise<{
    average: number;
    min: number;
    max: number;
    total: number;
  }> {
    const results: number[] = [];

    for (let i = 0; i < times; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      results.push(end - start);
    }

    const sum = results.reduce((a, b) => a + b, 0);

    return {
      average: sum / times,
      min: Math.min(...results),
      max: Math.max(...results),
      total: sum,
    };
  }
}
