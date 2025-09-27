/**
 * Tests for Combat API Routes
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RouteContext } from "../router/context";
import { createMockContext } from "../utils/router";
import { getTacticalDecisionHandler, simulateCombatHandler, analyzeCombatHandler } from "./combat";

type ResponsePayload = { error: string } | { success: boolean } | undefined;

describe("combat route handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTacticalDecisionHandler", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const ctx = createMockContext({
        req: {
          method: "POST",
          url: "/combat/tactical-decision",
        },
      }) as RouteContext;

      await getTacticalDecisionHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
      const body = (ctx.res as unknown as { body?: string }).body;
      const payload = body ? (JSON.parse(body) as ResponsePayload) : undefined;
      expect(payload).toEqual({ error: "Authentication required" });
    });
  });

  describe("simulateCombatHandler", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const ctx = createMockContext({
        req: {
          method: "POST",
          url: "/combat/simulate",
        },
      }) as RouteContext;

      await simulateCombatHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
      const body = (ctx.res as unknown as { body?: string }).body;
      const payload = body ? (JSON.parse(body) as ResponsePayload) : undefined;
      expect(payload).toEqual({ error: "Authentication required" });
    });
  });

  describe("analyzeCombatHandler", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const ctx = createMockContext({
        req: {
          method: "POST",
          url: "/combat/analyze",
        },
      }) as RouteContext;

      await analyzeCombatHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
      const body = (ctx.res as unknown as { body?: string }).body;
      const payload = body ? (JSON.parse(body) as ResponsePayload) : undefined;
      expect(payload).toEqual({ error: "Authentication required" });
    });
  });
});
