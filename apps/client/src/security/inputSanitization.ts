/**
 * Input sanitization and validation utilities for the VTT application
 */

import React from 'react';
import DOMPurify from "isomorphic-dompurify";
import { logger } from '../lib/logger';

// Input validation patterns
const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_-]{3,20}$/,
  campaignName: /^[a-zA-Z0-9\s_'-]{1,50}$/,
  characterName: /^[a-zA-Z0-9\s_'-]{1,30}$/,
  diceExpression: /^[0-9d+*/\s()khlr!<>=-]+$/i,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  url: /^https?:\/\/[^\s<>"']+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

// Dangerous patterns to block
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /<meta/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /@import/gi,
];

/**
 * Sanitize HTML content using DOMPurify
 */
export function sanitizeHTML(
  input: string,
  options: {
    allowedTags?: string[];
    allowedAttributes?: string[];
    stripTags?: boolean;
  } = {},
): string {
  if (typeof input !== "string") {
    return "";
  }

  const config: any = {
    ALLOWED_TAGS: options.allowedTags || ["b", "i", "em", "strong", "u", "br", "p"],
    ALLOWED_ATTR: options.allowedAttributes || ["class"],
    KEEP_CONTENT: !options.stripTags,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
  };

  return String(DOMPurify.sanitize(input, config));
}

/**
 * Sanitize plain text input
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove null bytes and control characters
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate input against patterns
 */
export function validateInput(input: string, type: keyof typeof VALIDATION_PATTERNS): boolean {
  if (typeof input !== "string") {
    return false;
  }

  const pattern = VALIDATION_PATTERNS[type];
  return pattern ? pattern.test(input) : false;
}

/**
 * Check for dangerous content
 */
export function containsDangerousContent(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }

  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Sanitize user-generated content for display
 */
export function sanitizeUserContent(
  input: string,
  contentType: "chat" | "description" | "name" = "chat",
): string {
  if (typeof input !== "string") {
    return "";
  }

  // Check for dangerous content first
  if (containsDangerousContent(input)) {
    logger.warn("Dangerous content detected and blocked:", input.substring(0, 100));
    return "[Content blocked for security reasons]";
  }

  switch (contentType) {
    case "chat":
      return sanitizeHTML(input, {
        allowedTags: ["b", "i", "em", "strong", "u", "br"],
        allowedAttributes: [],
      });

    case "description":
      return sanitizeHTML(input, {
        allowedTags: ["b", "i", "em", "strong", "u", "br", "p", "ul", "ol", "li"],
        allowedAttributes: ["class"],
      });

    case "name":
      return sanitizeText(input, 50);

    default:
      return sanitizeText(input);
  }
}

/**
 * Sanitize dice expressions
 */
export function sanitizeDiceExpression(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove any non-dice characters
  const sanitized = input.replace(/[^0-9d+*/\s()khlr!<>=-]/gi, "");

  // Validate the expression
  if (!validateInput(sanitized, "diceExpression")) {
    throw new Error("Invalid dice expression");
  }

  // Limit complexity to prevent DoS
  const diceCount = (sanitized.match(/\d+d/gi) || []).length;
  if (diceCount > 10) {
    throw new Error("Too many dice in expression");
  }

  return sanitized;
}

/**
 * Sanitize file names
 */
export function sanitizeFileName(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove dangerous characters (use Unicode escapes for control chars)
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "");

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, "");

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split(".").pop();
    const name = sanitized.substring(0, 255 - (ext ? ext.length + 1 : 0));
    sanitized = ext ? `${name}.${ext}` : name;
  }

  // Ensure not empty
  if (!sanitized) {
    sanitized = "untitled";
  }

  return sanitized;
}

/**
 * Sanitize URLs
 */
export function sanitizeURL(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Only allow HTTP/HTTPS URLs
  if (!validateInput(input, "url")) {
    throw new Error("Invalid URL format");
  }

  try {
    const url = new URL(input);

    // Block dangerous protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }

    // Block localhost and private IPs in production
    if (process.env.NODE_ENV === "production") {
      const hostname = url.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname.startsWith("127.") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
      ) {
        throw new Error("Private network URLs not allowed");
      }
    }

    return url.toString();
  } catch (error) {
    throw new Error("Invalid URL");
  }
}

/**
 * Input sanitization middleware for forms
 */
export class InputSanitizer {
  private rules: Map<string, (value: any) => any> = new Map();

  addRule(fieldName: string, sanitizer: (value: any) => any): void {
    this.rules.set(fieldName, sanitizer);
  }

  sanitize(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const rule = this.rules.get(key);
      if (rule) {
        try {
          sanitized[key] = rule(value);
        } catch (error) {
          logger.warn(`Sanitization failed for field ${key}:`, error);
          sanitized[key] = "";
        }
      } else {
        // Default sanitization for unknown fields
        if (typeof value === "string") {
          sanitized[key] = sanitizeText(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }
}

/**
 * Pre-configured sanitizer for common VTT forms
 */
export const vttSanitizer = new InputSanitizer();

// Add common rules
vttSanitizer.addRule("email", (value: string) => {
  const sanitized = sanitizeText(value, 254);
  if (!validateInput(sanitized, "email")) {
    throw new Error("Invalid email format");
  }
  return sanitized.toLowerCase();
});

vttSanitizer.addRule("username", (value: string) => {
  const sanitized = sanitizeText(value, 20);
  if (!validateInput(sanitized, "username")) {
    throw new Error("Invalid username format");
  }
  return sanitized;
});

vttSanitizer.addRule("campaignName", (value: string) => {
  const sanitized = sanitizeText(value, 50);
  if (!validateInput(sanitized, "campaignName")) {
    throw new Error("Invalid campaign name");
  }
  return sanitized;
});

vttSanitizer.addRule("characterName", (value: string) => {
  const sanitized = sanitizeText(value, 30);
  if (!validateInput(sanitized, "characterName")) {
    throw new Error("Invalid character name");
  }
  return sanitized;
});

vttSanitizer.addRule("description", (value: string) => {
  return sanitizeUserContent(value, "description");
});

vttSanitizer.addRule("chatMessage", (value: string) => {
  return sanitizeUserContent(value, "chat");
});

vttSanitizer.addRule("diceExpression", sanitizeDiceExpression);

vttSanitizer.addRule("url", sanitizeURL);

/**
 * React hook for input sanitization
 */
export function useSanitizedInput(
  initialValue: string = "",
  sanitizer: (value: string) => string = sanitizeText,
) {
  const [value, setValue] = React.useState(initialValue);
  const [sanitizedValue, setSanitizedValue] = React.useState(sanitizer(initialValue));

  const handleChange = React.useCallback(
    (newValue: string) => {
      setValue(newValue);
      try {
        setSanitizedValue(sanitizer(newValue));
      } catch (error) {
        logger.warn("Sanitization error:", error);
        setSanitizedValue("");
      }
    },
    [sanitizer],
  );

  return {
    value,
    sanitizedValue,
    onChange: handleChange,
    isValid: value === sanitizedValue,
  };
}
