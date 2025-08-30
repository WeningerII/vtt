import crypto from "crypto";
import { useState, useEffect } from "react";

/**
 * CSRF Protection middleware and utilities
 */

// Store for CSRF tokens (in production, use Redis or similar)
const tokenStore = new Map<string, { token: string; expires: number }>();

/**
 * Generate a CSRF token for a session
 */
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + 3600000; // 1 hour expiry

  tokenStore.set(sessionId, { token, expires });

  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = tokenStore.get(sessionId);

  if (!stored) {
    return false;
  }

  // Check if token has expired
  if (Date.now() > stored.expires) {
    tokenStore.delete(sessionId);
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored.token));
}

/**
 * Express middleware for CSRF protection
 */
export function csrfProtection() {
  return (req: any, res: any, next: any) => {
    // Skip CSRF for GET requests
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }

    const sessionId = req.session?.id || req.cookies?.sessionId;
    const token = req.headers["x-csrf-token"] || req.body?._csrf;

    if (!sessionId || !token) {
      return res.status(403).json({ error: "CSRF token missing" });
    }

    if (!validateCSRFToken(sessionId, token)) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }

    next();
  };
}

/**
 * React hook for CSRF token management
 */
export function useCSRFToken() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);

  useEffect(() => {
    // Fetch CSRF token from server
    fetch("/api/csrf-token", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setCSRFToken(data.token))
      .catch((err) => console.error("Failed to fetch CSRF token:", err));
  }, []);

  return csrfToken;
}

/**
 * Add CSRF token to fetch requests
 */
export function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "X-CSRF-Token": csrfToken || "",
    },
    credentials: "include",
  });
}
