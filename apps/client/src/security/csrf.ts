/**
 * CSRF Protection utilities for the VTT application
 */

// CSRF token management
class CSRFManager {
  private token: string | null = null;
  private readonly tokenKey = 'vtt-csrf-token';
  private readonly headerName = 'X-CSRF-Token';

  constructor() {
    this.loadToken();
  }

  /**
   * Get current CSRF token, generating one if needed
   */
  getToken(): string {
    if (!this.token) {
      this.generateToken();
    }
    return this.token!;
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(): void {
    // Generate cryptographically secure random token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this.token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Store in sessionStorage (not localStorage for security)
    sessionStorage.setItem(this.tokenKey, this.token);
  }

  /**
   * Load token from storage
   */
  private loadToken(): void {
    this.token = sessionStorage.getItem(this.tokenKey);
  }

  /**
   * Clear the current token
   */
  clearToken(): void {
    this.token = null;
    sessionStorage.removeItem(this.tokenKey);
  }

  /**
   * Get headers object with CSRF token
   */
  getHeaders(): Record<string, string> {
    return {
      [this.headerName]: this.getToken()
    };
  }

  /**
   * Validate a token (for server-side validation)
   */
  validateToken(token: string): boolean {
    return token === this.token && token.length === 64;
  }
}

export const csrfManager = new CSRFManager();

/**
 * Fetch wrapper with automatic CSRF protection
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  
  // Add CSRF token to all non-GET requests
  if (options.method && options.method.toUpperCase() !== 'GET') {
    Object.entries(csrfManager.getHeaders()).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  // Ensure Content-Type is set for POST requests
  if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const secureOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'same-origin', // Include cookies for same-origin requests
  };

  const response = await fetch(url, secureOptions);

  // Handle CSRF token refresh
  if (response.status === 403) {
    const errorData = await response.clone().json().catch(() => ({}));
    if (errorData.error === 'CSRF_TOKEN_INVALID') {
      csrfManager.clearToken();
      // Retry with new token
      return secureFetch(url, options);
    }
  }

  return response;
}

/**
 * Form submission with CSRF protection
 */
export function addCSRFToForm(form: HTMLFormElement): void {
  // Remove existing CSRF input if present
  const existingInput = form.querySelector('input[name="csrf_token"]');
  if (existingInput) {
    existingInput.remove();
  }

  // Add new CSRF token input
  const csrfInput = document.createElement('input');
  csrfInput.type = 'hidden';
  csrfInput.name = 'csrf_token';
  csrfInput.value = csrfManager.getToken();
  form.appendChild(csrfInput);
}

/**
 * React hook for CSRF protection
 */
export function useCSRF() {
  const [token, setToken] = React.useState(csrfManager.getToken());

  const refreshToken = React.useCallback(() => {
    csrfManager.generateToken();
    setToken(csrfManager.getToken());
  }, []);

  const getSecureHeaders = React.useCallback(() => {
    return csrfManager.getHeaders();
  }, [token]);

  return {
    token,
    refreshToken,
    getSecureHeaders,
    secureFetch
  };
}
