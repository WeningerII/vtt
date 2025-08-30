/**
 * Additional security utilities for the VTT application
 */

/**
 * Rate limiting utility
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request is allowed for given identifier
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  /**
   * Get remaining requests for identifier
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * Secure random string generation
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Password strength validation
 */
export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isStrong: boolean;
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain lowercase letters');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain uppercase letters');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    feedback.push('Password must contain numbers');
  } else {
    score += 1;
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Password must contain special characters');
  } else {
    score += 1;
  }

  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('Avoid repeated characters');
    score = Math.max(0, score - 1);
  }

  if (/123|abc|qwe/i.test(password)) {
    feedback.push('Avoid common sequences');
    score = Math.max(0, score - 1);
  }

  return {
    score: Math.min(4, score),
    feedback,
    isStrong: score >= 3 && feedback.length === 0
  };
}

/**
 * Secure session storage wrapper
 */
export class SecureStorage {
  private readonly prefix: string;
  private readonly encryptionKey?: CryptoKey;

  constructor(prefix: string = 'vtt_secure_') {
    this.prefix = prefix;
  }

  /**
   * Store data securely
   */
  async setItem(key: string, value: any): Promise<void> {
    const serialized = JSON.stringify(value);
    const prefixedKey = this.prefix + key;
    
    try {
      sessionStorage.setItem(prefixedKey, serialized);
    } catch (error) {
      console.warn('Failed to store secure data:', error);
    }
  }

  /**
   * Retrieve data securely
   */
  async getItem<T>(key: string): Promise<T | null> {
    const prefixedKey = this.prefix + key;
    
    try {
      const stored = sessionStorage.getItem(prefixedKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to retrieve secure data:', error);
      return null;
    }
  }

  /**
   * Remove data
   */
  removeItem(key: string): void {
    const prefixedKey = this.prefix + key;
    sessionStorage.removeItem(prefixedKey);
  }

  /**
   * Clear all secure data
   */
  clear(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

/**
 * XSS protection utilities
 */
export function escapeHTML(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function unescapeHTML(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Timing attack protection
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Security headers validation
 */
export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'X-Frame-Options'?: string;
  'X-Content-Type-Options'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
}

export function validateSecurityHeaders(headers: Headers): SecurityHeaders {
  const securityHeaders: SecurityHeaders = {};

  // Check for important security headers
  const headerNames = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy'
  ];

  headerNames.forEach(name => {
    const value = headers.get(name);
    if (value) {
      securityHeaders[name as keyof SecurityHeaders] = value;
    }
  });

  return securityHeaders;
}

/**
 * Content type validation
 */
export function isValidContentType(contentType: string, allowedTypes: string[]): boolean {
  const normalizedType = contentType.toLowerCase().split(';')[0].trim();
  return allowedTypes.some(allowed => 
    allowed === '*/*' || 
    normalizedType === allowed.toLowerCase() ||
    (allowed.endsWith('/*') && normalizedType.startsWith(allowed.slice(0, -1)))
  );
}

/**
 * File upload security validation
 */
export interface FileValidationOptions {
  maxSize: number;
  allowedTypes: string[];
  allowedExtensions: string[];
  scanForMalware?: boolean;
}

export function validateFileUpload(file: File, options: FileValidationOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check file size
  if (file.size > options.maxSize) {
    errors.push(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
  }

  // Check content type
  if (!isValidContentType(file.type, options.allowedTypes)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !options.allowedExtensions.includes(extension)) {
    errors.push(`File extension .${extension} is not allowed`);
  }

  // Check for suspicious file names
  if (/[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
    errors.push('File name contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Global security configuration
 */
export const securityConfig = {
  rateLimiter: new RateLimiter(60000, 100), // 100 requests per minute
  secureStorage: new SecureStorage(),
  
  // File upload limits
  fileUpload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocumentTypes: ['application/pdf', 'text/plain'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt']
  },

  // Session configuration
  session: {
    timeout: 30 * 60 * 1000, // 30 minutes
    renewThreshold: 5 * 60 * 1000 // Renew if less than 5 minutes remaining
  }
};
