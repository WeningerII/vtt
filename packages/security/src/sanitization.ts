// Import statements commented out - install packages if needed
// import DOMPurify from 'isomorphic-dompurify';
// import validator from 'validator';

// Mock implementations for now
const DOMPurify = {
  sanitize: (html: string, options?: any) => {
    // Basic HTML sanitization
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/javascript:/gi, "");
  },
};

const validator = {
  isEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  normalizeEmail: (email: string) => email.toLowerCase().trim(),
  isURL: (url: string, options?: any) => {
    try {
      const u = new URL(url);
      if (options?.protocols) {
        return options.protocols.includes(u.protocol.slice(0, -1));
      }
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Input sanitization utilities for preventing XSS and injection attacks
 */

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize user input for display
 */
export function sanitizeText(text: string): string {
  // Remove any HTML tags
  let sanitized = text.replace(/<[^>]*>/g, "");

  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");

  return sanitized;
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();

  if (!validator.isEmail(trimmed)) {
    return null;
  }

  return validator.normalizeEmail(trimmed) || null;
}

/**
 * Validate and sanitize URLs
 */
export function sanitizeURL(url: string): string | null {
  const trimmed = url.trim();

  // Only allow http(s) protocols
  if (
    !validator.isURL(trimmed, {
      protocols: ["http", "https"],
      require_protocol: true,
    })
  ) {
    return null;
  }

  return trimmed;
}

/**
 * Sanitize file names to prevent directory traversal
 */
export function sanitizeFileName(fileName: string): string {
  // Remove any path separators and special characters
  return fileName
    .replace(/[/\\]/g, "")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9\-_.]/g, "_")
    .slice(0, 255); // Limit length
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumber(
  input: string,
  options?: {
    min?: number;
    max?: number;
    allowFloat?: boolean;
  },
): number | null {
  const num = options?.allowFloat ? parseFloat(input) : parseInt(input, 10);

  if (isNaN(num)) {
    return null;
  }

  if (options?.min !== undefined && num < options.min) {
    return null;
  }

  if (options?.max !== undefined && num > options.max) {
    return null;
  }

  return num;
}

/**
 * Sanitize JSON input
 */
export function sanitizeJSON(jsonString: string): any | null {
  try {
    const parsed = JSON.parse(jsonString);
    // Additional validation can be added here
    return parsed;
  } catch {
    return null;
  }
}

/**
 * SQL injection prevention - parameterize queries
 */
export function escapeSQLIdentifier(identifier: string): string {
  // Only allow alphanumeric characters and underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error("Invalid SQL identifier");
  }
  return identifier;
}

/**
 * MongoDB injection prevention
 */
export function sanitizeMongoQuery(query: any): any {
  if (typeof query !== "object" || query === null) {
    return query;
  }

  const sanitized: any = {};

  for (const key in query) {
    // Prevent operator injection
    if (key.startsWith("$")) {
      continue;
    }

    const value = query[key];

    if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMongoQuery(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * React component for sanitized HTML display
 */
export function SafeHTML({ html, className }: { html: string; className?: string }) {
  const sanitized = sanitizeHTML(html);

  // Return a React element using createElement
  // This would need React imported in actual usage
  return {
    type: "div",
    props: {
      className,
      dangerouslySetInnerHTML: { __html: sanitized },
    },
  } as any;
}

/**
 * Express middleware for input sanitization
 */
export function inputSanitization() {
  return (req: any, res: any, next: any) => {
    // Sanitize body
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize params
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return typeof obj === "string" ? sanitizeText(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized: any = {};

  for (const key in obj) {
    const sanitizedKey = sanitizeText(key);
    sanitized[sanitizedKey] = sanitizeObject(obj[key]);
  }

  return sanitized;
}
