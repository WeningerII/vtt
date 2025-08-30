/**
 * API Client - Configured axios instance for VTT Platform API
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '@vtt/logging';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
      timeout: 10000,
      withCredentials: true, // Include cookies for session management
      headers: {
        'Content-Type': 'application/json',
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
          'X-Request-Time': new Date().toISOString(),
        } as any;

        // Add CSRF token if available
        if (typeof document !== 'undefined') {
          const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');
          if (csrfToken) {
            (config.headers as any)['X-CSRF-Token'] = csrfToken;
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        // Handle network errors
        if (!error.response) {
          logger.error('Network error:', error.message);
          return Promise.reject(new Error('Network error. Please check your connection.'));
        }

        // Handle specific HTTP status codes
        const { status, data } = error.response;
        
        switch (status) {
          case 401:
            // Unauthorized - redirect to login or refresh token
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
              window.location.href = '/auth/login';
            }
            break;
          case 403:
            // Forbidden - show permission error
            logger.error('Permission denied:', data?.error || 'Access forbidden');
            break;
          case 429:
            // Rate limited
            logger.error('Rate limit exceeded:', data?.error || 'Too many requests');
            break;
          case 500:
            // Server error
            logger.error('Server error:', data?.error || 'Internal server error');
            break;
        }

        return Promise.reject(error);
      }
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
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.post(url, data, config);
  }

  // PUT request
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.put(url, data, config);
  }

  // PATCH request
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.patch(url, data, config);
  }

  // DELETE request
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.delete(url, config);
  }

  // Upload file
  async upload<T>(url: string, file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse<ApiResponse<T>>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
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
      responseType: 'blob',
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Set authorization header
  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Remove authorization header
  clearAuthToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  // Get base URL
  getBaseURL(): string {
    return this.client.defaults.baseURL || '';
  }
}

// Create and export singleton instance
export const _apiClient = new ApiClient();
export const apiClient = _apiClient;

// Export types
export type { ApiResponse };
