/**
 * Content Security Policy (CSP) utilities and configuration for the VTT application
 */
import { logger } from '../lib/logger';
import React from 'react';

// CSP directive configuration
export interface CSPConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  childSrc?: string[];
  workerSrc?: string[];
  manifestSrc?: string[];
  baseUri?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
  reportTo?: string;
}

/**
 * Generate CSP header value from configuration
 */
export function generateCSPHeader(config: CSPConfig): string {
  const directives: string[] = [];

  // Helper function to format directive
  const addDirective = (name: string, values?: string[]) => {
    if (values && values.length > 0) {
      directives.push(`${name} ${values.join(" ")}`);
    }
  };

  // Add all directives
  addDirective("default-src", config.defaultSrc);
  addDirective("script-src", config.scriptSrc);
  addDirective("style-src", config.styleSrc);
  addDirective("img-src", config.imgSrc);
  addDirective("connect-src", config.connectSrc);
  addDirective("font-src", config.fontSrc);
  addDirective("object-src", config.objectSrc);
  addDirective("media-src", config.mediaSrc);
  addDirective("frame-src", config.frameSrc);
  addDirective("child-src", config.childSrc);
  addDirective("worker-src", config.workerSrc);
  addDirective("manifest-src", config.manifestSrc);
  addDirective("base-uri", config.baseUri);
  addDirective("form-action", config.formAction);
  addDirective("frame-ancestors", config.frameAncestors);

  // Add boolean directives
  if (config.upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }
  if (config.blockAllMixedContent) {
    directives.push("block-all-mixed-content");
  }

  // Add reporting directives
  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }
  if (config.reportTo) {
    directives.push(`report-to ${config.reportTo}`);
  }

  return directives.join("; ");
}

/**
 * Default CSP configuration for VTT application
 */
export const defaultCSPConfig: CSPConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for React development
    "'unsafe-eval'", // Required for development tools
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for styled-components and CSS-in-JS
    "https://fonts.googleapis.com",
    "https://cdn.jsdelivr.net",
  ],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "http:", // Allow HTTP images for user uploads
  ],
  connectSrc: ["'self'", "wss:", "ws:", "https://api.vtt.com", "https://*.vtt.com"],
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'", "blob:", "data:"],
  frameSrc: ["'none'"],
  childSrc: ["'self'"],
  workerSrc: ["'self'", "blob:"],
  manifestSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: true,
  blockAllMixedContent: false, // Allow mixed content for development
  reportUri: "/api/csp-report",
};

/**
 * Production CSP configuration (more restrictive)
 */
export const productionCSPConfig: CSPConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    // Remove unsafe-inline and unsafe-eval for production
    "https://cdn.jsdelivr.net",
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Still needed for some CSS frameworks
    "https://fonts.googleapis.com",
  ],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  connectSrc: ["'self'", "wss://api.vtt.com", "https://api.vtt.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'", "blob:"],
  frameSrc: ["'none'"],
  childSrc: ["'none'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: true,
  blockAllMixedContent: true,
  reportUri: "/api/csp-report",
};

/**
 * CSP Manager class for dynamic policy management
 */
export class CSPManager {
  private config: CSPConfig;
  private nonces: Set<string> = new Set();

  constructor(config: CSPConfig = defaultCSPConfig) {
    this.config = { ...config };
  }

  /**
   * Generate a cryptographic nonce for inline scripts/styles
   */
  generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const nonce = btoa(String.fromCharCode(...array));
    this.nonces.add(nonce);
    return nonce;
  }

  /**
   * Add nonce to script-src directive
   */
  addScriptNonce(nonce: string): void {
    if (!this.config.scriptSrc) {
      this.config.scriptSrc = [];
    }
    this.config.scriptSrc.push(`'nonce-${nonce}'`);
  }

  /**
   * Add nonce to style-src directive
   */
  addStyleNonce(nonce: string): void {
    if (!this.config.styleSrc) {
      this.config.styleSrc = [];
    }
    this.config.styleSrc.push(`'nonce-${nonce}'`);
  }

  /**
   * Add allowed domain to a directive
   */
  addAllowedDomain(directive: keyof CSPConfig, domain: string): void {
    const directiveArray = this.config[directive] as string[] | undefined;
    if (Array.isArray(directiveArray)) {
      if (!directiveArray.includes(domain)) {
        directiveArray.push(domain);
      }
    }
  }

  /**
   * Remove domain from directive
   */
  removeDomain(directive: keyof CSPConfig, domain: string): void {
    const directiveArray = this.config[directive] as string[] | undefined;
    if (Array.isArray(directiveArray)) {
      const index = directiveArray.indexOf(domain);
      if (index > -1) {
        directiveArray.splice(index, 1);
      }
    }
  }

  /**
   * Get current CSP header value
   */
  getHeaderValue(): string {
    return generateCSPHeader(this.config);
  }

  /**
   * Apply CSP to document
   */
  apply(): void {
    const meta = document.createElement("meta");
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = this.getHeaderValue();
    document.head.appendChild(meta);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CSPConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * CSP violation reporting
 */
export interface CSPViolation {
  documentUri: string;
  referrer: string;
  blockedUri: string;
  violatedDirective: string;
  originalPolicy: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Handle CSP violation reports
 */
export function handleCSPViolation(violation: CSPViolation): void {
  console.warn("CSP Violation:", violation);

  // Send to monitoring service
  if (typeof window !== "undefined" && "navigator" in window && "sendBeacon" in navigator) {
    const data = JSON.stringify({
      type: "csp-violation",
      violation,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });

    navigator.sendBeacon("/api/csp-report", data);
  }

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    logger.warn("CSP Violation Details", {
      blockedUri: violation.blockedUri,
      violatedDirective: violation.violatedDirective,
      sourceFile: violation.sourceFile,
      lineNumber: violation.lineNumber,
    });
  }
}

/**
 * Set up CSP violation event listener
 */
export function setupCSPReporting(): void {
  if (typeof document !== "undefined") {
    document.addEventListener("securitypolicyviolation", (event) => {
      handleCSPViolation({
        documentUri: event.documentURI,
        referrer: event.referrer,
        blockedUri: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
      });
    });
  }
}

/**
 * React hook for CSP management
 */
export function useCSP(config?: CSPConfig) {
  const [cspManager] = React.useState(() => new CSPManager(config));

  React.useEffect(() => {
    // Apply CSP on mount
    cspManager.apply();

    // Set up violation reporting
    setupCSPReporting();
  }, [cspManager]);

  const generateNonce = React.useCallback(() => {
    return cspManager.generateNonce();
  }, [cspManager]);

  const addAllowedDomain = React.useCallback(
    (directive: keyof CSPConfig, domain: string) => {
      cspManager.addAllowedDomain(directive, domain);
      cspManager.apply(); // Reapply CSP
    },
    [cspManager],
  );

  return {
    generateNonce,
    addAllowedDomain,
    getHeaderValue: () => cspManager.getHeaderValue(),
  };
}

/**
 * Utility to check if a URL is allowed by CSP
 */
export function isURLAllowed(
  url: string,
  directive: "scriptSrc" | "styleSrc" | "imgSrc" | "connectSrc",
  config: CSPConfig,
): boolean {
  const allowedSources = config[directive] || [];

  try {
    const urlObj = new URL(url);

    return allowedSources.some((source) => {
      if (source === "'self'") {
        return urlObj.origin === window.location.origin;
      }
      if (source === "'unsafe-inline'" || source === "'unsafe-eval'") {
        return false; // These don't apply to external URLs
      }
      if (source.startsWith("'nonce-")) {
        return false; // Nonces don't apply to external URLs
      }
      if (source === "data:" || source === "blob:") {
        return url.startsWith(source);
      }
      if (source.endsWith("*")) {
        const baseUrl = source.slice(0, -1);
        return url.startsWith(baseUrl);
      }
      return url.startsWith(source);
    });
  } catch {
    return false;
  }
}

// Initialize CSP manager for the application
export const cspManager = new CSPManager(
  process.env.NODE_ENV === "production" ? productionCSPConfig : defaultCSPConfig,
);
