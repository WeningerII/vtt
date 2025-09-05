/**
 * Security Utilities and Helpers
 */

import * as crypto from "crypto";
import { SecurityContext, User } from "./types";

export class SecurityUtils {
  /**
   * Generate cryptographically secure random string
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Generate secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
    let password = "";

    for (let i = 0; i < length; i++) {
      password += chars.charAt(crypto.randomInt(0, chars.length));
    }

    return password;
  }

  /**
   * Hash sensitive data using SHA-256
   */
  static hashData(data: string, salt: string = ""): string {
    const hash = crypto.createHash("sha256");
    hash.update(data + salt);
    return hash.digest("hex");
  }

  /**
   * Generate HMAC signature
   */
  static generateHMAC(data: string, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(data);
    return hmac.digest("hex");
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  static encrypt(text: string, key: string): EncryptedData {
    const algorithm = "aes-256-gcm";
    const iv = crypto.randomBytes(16);
    const keyBuffer = crypto.scryptSync(key, "salt", 32);

    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    cipher.setAAD(Buffer.from("vtt-auth"));

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: EncryptedData, key: string): string {
    const algorithm = "aes-256-gcm";
    const keyBuffer = crypto.scryptSync(key, "salt", 32);

    const iv = Buffer.from(encryptedData.iv, "hex");
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    decipher.setAAD(Buffer.from("vtt-auth"));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));

    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Sanitize user input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/vbscript:/gi, "") // Remove vbscript: protocol
      .replace(/on\w+\s*=/gi, "") // Remove event handlers
      .trim();
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  /**
   * Check password strength
   */
  static checkPasswordStrength(password: string): PasswordStrength {
    const checks = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      symbols: /[^A-Za-z0-9]/.test(password),
      noCommonWords: !this.containsCommonWords(password),
      noPersonalInfo: true, // Would check against user data in real implementation
    };

    const score = Object.values(checks).filter(Boolean).length;
    let strength: "weak" | "fair" | "good" | "strong";

    if (score < 4) {strength = "weak";}
    else if (score < 6) {strength = "fair";}
    else if (score < 7) {strength = "good";}
    else {strength = "strong";}

    return {
      score,
      strength,
      checks,
      suggestions: this.getPasswordSuggestions(checks),
    };
  }

  /**
   * Generate secure session token
   */
  static generateSessionToken(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString("hex");
    return `${timestamp}.${randomBytes}`;
  }

  /**
   * Create secure cookie options
   */
  static getSecureCookieOptions(isProduction: boolean = false): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
    };

    if (isProduction) {
      options.domain = ".yourdomain.com";
    }

    return options;
  }

  /**
   * Rate limit key generator
   */
  static generateRateLimitKey(identifier: string, action: string): string {
    const hash = this.hashData(`${identifier}:${action}`);
    return `rate_limit:${hash}`;
  }

  /**
   * Obfuscate sensitive data for logging
   */
  static obfuscateForLogging(data: any): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "credit_card",
      "ssn",
      "social_security",
      "passport",
    ];

    const obfuscated = { ...data };

    for (const [key, value] of Object.entries(obfuscated)) {
      const lowercaseKey = key.toLowerCase();

      if (sensitiveFields.some((field) => lowercaseKey.includes(field))) {
        if (typeof value === "string") {
          obfuscated[key] = "*".repeat(Math.min(value.length, 8));
        } else {
          obfuscated[key] = "[REDACTED]";
        }
      } else if (typeof value === "object") {
        obfuscated[key] = this.obfuscateForLogging(value);
      }
    }

    return obfuscated;
  }

  /**
   * Generate device fingerprint
   */
  static generateDeviceFingerprint(
    userAgent: string,
    acceptLanguage: string = "",
    timezone: string = "",
  ): string {
    const fingerprint = `${userAgent}|${acceptLanguage}|${timezone}`;
    return this.hashData(fingerprint);
  }

  /**
   * Check if request comes from suspicious source
   */
  static isSuspiciousRequest(req: any): boolean {
    const userAgent = req.get("User-Agent") || "";
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /php/i,
    ];

    // Check user agent
    if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
      return true;
    }

    // Check for missing common headers
    const commonHeaders = ["accept", "accept-language", "accept-encoding"];
    const missingHeaders = commonHeaders.filter((header) => !req.get(header));

    if (missingHeaders.length > 1) {
      return true;
    }

    return false;
  }

  /**
   * Generate API key
   */
  static generateAPIKey(prefix: string = "vtt"): string {
    const keyPart = crypto.randomBytes(20).toString("hex");
    const checksum = this.hashData(keyPart).substring(0, 8);
    return `${prefix}_${keyPart}${checksum}`;
  }

  /**
   * Validate API key format
   */
  static validateAPIKey(apiKey: string, expectedPrefix: string = "vtt"): boolean {
    if (!apiKey.startsWith(`${expectedPrefix}`)) {
      return false;
    }

    const keyPart = apiKey.substring(expectedPrefix.length + 1, apiKey.length - 8);
    const providedChecksum = apiKey.slice(-8);
    const expectedChecksum = this.hashData(keyPart).substring(0, 8);

    return providedChecksum === expectedChecksum;
  }

  /**
   * Secure comparison to prevent timing attacks
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(sessionId: string, secret: string): string {
    const timestamp = Date.now().toString();
    const data = `${sessionId}:${timestamp}`;
    const signature = this.generateHMAC(data, secret);
    return Buffer.from(`${data}:${signature}`).toString("base64");
  }

  /**
   * Validate CSRF token
   */
  static validateCSRFToken(
    token: string,
    sessionId: string,
    secret: string,
    maxAge: number = 3600000,
  ): boolean {
    try {
      const decoded = Buffer.from(token, "base64").toString("utf8");
      const [receivedSessionId, timestamp, signature] = decoded.split(":");

      if (receivedSessionId !== sessionId || !timestamp || !signature) {
        return false;
      }

      const tokenAge = Date.now() - parseInt(timestamp);
      if (tokenAge > maxAge) {
        return false;
      }

      const data = `${receivedSessionId}:${timestamp}`;
      const expectedSignature = this.generateHMAC(data, secret);

      return this.secureCompare(signature, expectedSignature);
    } catch (_error) {
      return false;
    }
  }

  // Private helper methods

  private static containsCommonWords(password: string): boolean {
    const commonWords = [
      "password",
      "123456",
      "qwerty",
      "abc123",
      "admin",
      "login",
      "welcome",
      "monkey",
      "dragon",
      "master",
    ];

    const lowercasePassword = password.toLowerCase();
    return commonWords.some((word) => lowercasePassword.includes(word));
  }

  private static getPasswordSuggestions(checks: Record<string, boolean>): string[] {
    const suggestions: string[] = [];

    if (!checks.length) {suggestions.push("Use at least 12 characters");}
    if (!checks.uppercase) {suggestions.push("Include uppercase letters");}
    if (!checks.lowercase) {suggestions.push("Include lowercase letters");}
    if (!checks.numbers) {suggestions.push("Include numbers");}
    if (!checks.symbols) {suggestions.push("Include special characters");}
    if (!checks.noCommonWords) {suggestions.push("Avoid common words");}

    return suggestions;
  }
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export interface PasswordStrength {
  score: number;
  strength: "weak" | "fair" | "good" | "strong";
  checks: Record<string, boolean>;
  suggestions: string[];
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  maxAge: number;
  path: string;
  domain?: string | undefined;
}
