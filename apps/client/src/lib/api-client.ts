/**
 * API Client - Configured axios instance for VTT Platform API
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { logger } from "@vtt/logging";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const serverUrl = import.meta.env?.VITE_SERVER_URL || "http://localhost:8080";
    const baseURL = serverUrl.endsWith('/api/v1') ? serverUrl : `${serverUrl}/api/v1`;
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      withCredentials: true, // Include cookies for session management
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor for adding auth token
    this.client.interceptors.request.use(
      (config) => {
        // Add timestamp to prevent caching
        config.headers = {
          ...(config.headers || {}),
          "X-Request-Time": new Date().toISOString(),
        } as any;

        // Add auth token from localStorage if available
        const accessToken = localStorage.getItem("accessToken");
        if (accessToken) {
          (config.headers as any)["Authorization"] = `Bearer ${accessToken}`;
        }

        // Add CSRF token if available
        if (typeof document !== "undefined") {
          const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
          if (csrfToken) {
            (config.headers as any)["X-CSRF-Token"] = csrfToken;
          }
        }

        return config;
      },
      (error) => {
        // Ensure we never reject with empty objects
        if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
          return Promise.reject(new Error('Request configuration failed'));
        }
        if (error instanceof Error) {
          return Promise.reject(error);
        }
        return Promise.reject(new Error(error.message || 'Request failed'));
      },
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        // Ensure we always have a proper error object
        if (!error) {
          const unknownError = new Error("An unknown error occurred");
          logger.error("Unknown error in API client", { type: 'unknown' });
          return Promise.reject(unknownError);
        }

        // Handle network errors
        if (!error.response) {
          const networkError = new Error(error.message || "Network error. Please check your connection.");
          // Never log the raw error if it might be empty
          const errorInfo = error.message ? { message: error.message } : { type: 'network', code: error.code || 'UNKNOWN' };
          logger.error("Network error:", errorInfo);
          return Promise.reject(networkError);
        }

        // Handle specific HTTP status codes
        const { status, data } = error.response;

        switch (status) {
          case 401:
            // Unauthorized - try to refresh token first, then redirect
            if (typeof window !== "undefined" && !window.location.pathname.includes("/auth")) {
              const refreshToken = localStorage.getItem("refreshToken");
              if (refreshToken) {
                // Attempt token refresh - this will be handled by AuthProvider
                logger.info("API received 401, refresh token available - triggering auth refresh");
                window.dispatchEvent(new CustomEvent("auth:refresh-needed"));
              } else {
                // No refresh token, redirect to login
                logger.info("API received 401, no refresh token - redirecting to login");
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                window.location.href = "/auth/login";
              }
            }
            return Promise.reject(new Error(data?.error || "Authentication required"));
          case 403:
            // Forbidden - show permission error
            logger.error("Permission denied:", data?.error || "Access forbidden");
            return Promise.reject(new Error(data?.error || "Permission denied"));
          case 429:
            // Rate limited
            logger.error("Rate limit exceeded:", data?.error || "Too many requests");
            return Promise.reject(new Error(data?.error || "Rate limit exceeded. Please try again later."));
          case 500:
            // Server error
            logger.error("Server error:", data?.error || "Internal server error");
            return Promise.reject(new Error(data?.error || "Server error. Please try again later."));
          default: {
            // Other errors
            const errorMessage = data?.error || data?.message || `Request failed with status ${status}`;
            return Promise.reject(new Error(errorMessage));
          }
        }
      },
    );
  }

  // Generic request method
  async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.request(config);
  }

  // GET request
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.get(url, config);
  }

  // POST request
  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.post(url, data, config);
  }

  // PUT request
  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.put(url, data, config);
  }

  // PATCH request
  async patch<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.patch(url, data, config);
  }

  // DELETE request
  async delete<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.delete(url, config);
  }

  // Upload file
  async upload<T>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    const formData = new FormData();
    formData.append("file", file);

    return this.client.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }

  // Download file
  async download(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: "blob",
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(downloadUrl);
  }

  // Set authorization header (deprecated - tokens now read from localStorage)
  setAuthToken(token: string) {
    // For backward compatibility, but tokens are now automatically read from localStorage
    localStorage.setItem("accessToken", token);
    logger.info("Auth token updated in localStorage");
  }

  // Remove authorization header (deprecated - tokens now read from localStorage)
  clearAuthToken() {
    // For backward compatibility, but tokens are now automatically cleared from localStorage
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    logger.info("Auth tokens cleared from localStorage");
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem("accessToken");
    return !!token;
  }

  // Get current access token
  getAccessToken(): string | null {
    return localStorage.getItem("accessToken");
  }

  // Get base URL
  getBaseURL(): string {
    return this.client.defaults.baseURL || "";
  }
}

// Create and export singleton instance
export const _apiClient = new ApiClient();
export const apiClient = _apiClient;

// Export types
export type { ApiResponse };
