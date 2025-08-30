/**
 * Authentication utility functions
 */

import jwt from "jsonwebtoken";
import { logger } from "@vtt/logging";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key";

/**
 * Extract user ID from JWT token in Authorization header
 */
export async function extractUserIdFromToken(authHeader: string): Promise<string | null> {
  try {
    // Remove 'Bearer ' prefix if present
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

    if (!token) {
      return null;
    }

    // Verify and decode the token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Extract user ID from token payload
    if (decoded && decoded.userId) {
      return decoded.userId;
    } else if (decoded && decoded.sub) {
      // Some JWT implementations use 'sub' for subject/user ID
      return decoded.sub;
    }

    return null;
  } catch (error) {
    logger.error("Failed to extract user ID from token:", error as Error);
    return null;
  }
}

/**
 * Generate JWT token for a user
 */
export function generateToken(userId: string, email?: string): string {
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };

  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Verify if a token is valid
 */
export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
