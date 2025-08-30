/**
 * Security module exports for the VTT application
 */

// CSRF Protection
export {
  csrfManager,
  secureFetch,
  addCSRFToForm,
  useCSRF
} from './csrf';

// Input Sanitization
export {
  sanitizeHTML,
  sanitizeText,
  validateInput,
  containsDangerousContent,
  sanitizeUserContent,
  sanitizeDiceExpression,
  sanitizeFileName,
  sanitizeURL,
  InputSanitizer,
  vttSanitizer,
  useSanitizedInput
} from './inputSanitization';

// Content Security Policy
export {
  generateCSPHeader,
  defaultCSPConfig,
  productionCSPConfig,
  CSPManager,
  handleCSPViolation,
  setupCSPReporting,
  useCSP,
  isURLAllowed,
  cspManager
} from './csp';

// Security utilities
export * from './utils';

// Types
export type { CSPConfig, CSPViolation } from './csp';
