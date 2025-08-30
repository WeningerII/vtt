import { test, expect } from "@playwright/test";

test.describe("API Health Checks", () => {
  test("server liveness probe responds correctly", async ({ request }) => {
    const response = await request.get("http://localhost:8080/livez");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.uptimeSec).toBeGreaterThan(0);
  });

  test("server readiness probe responds correctly", async ({ request }) => {
    const response = await request.get("http://localhost:8080/readyz");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe("up");
  });

  test("API documentation is accessible", async ({ request }) => {
    const response = await request.get("http://localhost:8080/docs");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  });

  test("OpenAPI spec is valid JSON", async ({ request }) => {
    const response = await request.get("http://localhost:8080/api-docs.json");
    expect(response.status()).toBe(200);

    const spec = await response.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("VTT Server API");
  });
});

test.describe("AI Providers API", () => {
  test("list AI providers endpoint works", async ({ request }) => {
    const response = await request.get("http://localhost:8080/ai/providers");
    expect(response.status()).toBe(200);

    const providers = await response.json();
    expect(Array.isArray(providers)).toBe(true);
  });
});

test.describe("Error Handling", () => {
  test("404 returns proper JSON error", async ({ request }) => {
    const response = await request.get("http://localhost:8080/nonexistent");
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.error).toBe("Not found");
  });

  test("CORS headers are present", async ({ request }) => {
    const response = await request.get("http://localhost:8080/livez");
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBeDefined();
  });
});
