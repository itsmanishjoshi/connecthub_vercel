/**
 * API Client
 * 
 * Centralized HTTP client for ConnectHub with error handling and retries
 */

import { logger } from '@/utils/logger';
import { retry } from '@/utils/helpers';
import { ERROR_MESSAGES } from '@/constants';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(baseUrl = '', headers: HeadersInit = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Generic request method
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    try {
      logger.debug(`API Request: ${options.method || 'GET'} ${url}`, config, 'ApiClient');

      const response = await retry(
        () => fetch(url, config),
        3, // max attempts
        1000 // initial delay
      );

      const data = await this.parseResponse<T>(response);

      if (!response.ok) {
        const errorData = data as Record<string, unknown>;
        const error: ApiError = {
          message: (errorData.error as string) || ERROR_MESSAGES.GENERIC,
          status: response.status,
          details: data,
        };

        logger.error(`API Error: ${options.method || 'GET'} ${url}`, error, 'ApiClient');

        return {
          error: error.message,
          status: response.status,
        };
      }

      logger.debug(`API Response: ${options.method || 'GET'} ${url}`, data, 'ApiClient');

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      logger.error(`API Request Failed: ${options.method || 'GET'} ${url}`, error, 'ApiClient');

      return {
        error: ERROR_MESSAGES.NETWORK,
        status: 0,
      };
    }
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    if (contentType?.includes('text/')) {
      return response.text() as T;
    }

    return response.blob() as T;
  }

  /**
   * Set authorization header
   */
  setAuthToken(token: string): void {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Remove authorization header
   */
  clearAuthToken(): void {
    const headers = this.defaultHeaders as Record<string, string>;
    const { Authorization: _removed, ...rest } = headers;
    this.defaultHeaders = rest;
  }

  /**
   * Update base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient };
