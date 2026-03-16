/**
 * Request interceptors for the API client
 * Handles request modification and validation
 */

import type { InternalAxiosRequestConfig } from "axios";
import { generateUUID } from "../../utils/uuid";
import { AppError } from "../../errors/types";
import { ErrorCode } from "@/types/enums";

/**
 * Request interceptor that adds headers and metadata to outgoing requests
 */
export function requestInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  // console.log("🔍 _______ Request:", {
  //   url: config.url,
  //   data: config.data,
  //   headers: config.headers,
  // });

  // Add request ID for tracking and debugging
  config.headers = config.headers || {};
  config.headers["X-Request-ID"] = generateUUID();

  // Add client timestamp
  config.headers["X-Client-Timestamp"] = new Date().toISOString();

  // Add client info
  if (typeof navigator !== "undefined") {
    config.headers["X-Client-User-Agent"] = navigator.userAgent;
  }

  // Add app version if available
  const appVersion = process.env.npm_package_version;
  if (appVersion) {
    config.headers["X-App-Version"] = appVersion;
  }

  // Log request in development
  if (process.env.NODE_ENV === "development") {
    // console.log(
    //   `🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`,
    //   {
    //     requestId: config.headers["X-Request-ID"],
    //     data: config.data,
    //     params: config.params,
    //   }
    // );
  }

  return config;
}

/**
 * Request error interceptor for handling request configuration errors
 */
export function requestErrorInterceptor(error: unknown): Promise<never> {
  return Promise.reject(error);
}

/**
 * Factory function to create authentication request interceptor
 * Takes auth store as parameter to avoid context issues
 * @param getToken - Function that returns the current access token
 */
export function createAuthRequestInterceptor(getToken: () => string | null) {
  return function authRequestInterceptor(
    config: InternalAxiosRequestConfig
  ): InternalAxiosRequestConfig {
    const token = getToken();
    // console.log("🔍 ___>>>____ Auth Request:", {
    //   token,
    //   headers: config.headers,
    // });

    // Add Authorization header if token exists
    if (token) {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  };
}

/**
 * Request interceptor for rate limiting
 * Implements client-side rate limiting to prevent overwhelming the server
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 100, windowMs = 60000) {
    // 100 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(key = "default"): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;

    // Remove old requests outside the window
    const validTimestamps = timestamps.filter(
      (timestamp) => timestamp > windowStart
    );
    this.requests.set(key, validTimestamps);

    // Check if we can make a new request
    if (validTimestamps.length < this.maxRequests) {
      validTimestamps.push(now);
      return true;
    }

    return false;
  }

  getResetTime(key = "default"): number {
    const timestamps = this.requests.get(key) ?? [];
    if (timestamps.length === 0) return 0;

    const oldestRequest = Math.min(...timestamps);
    return oldestRequest + this.windowMs;
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

export function rateLimitInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig | Promise<never> {
  const key = `${config.method}_${config.url}`;

  if (!rateLimiter.canMakeRequest(key)) {
    const resetTime = rateLimiter.getResetTime(key);
    const waitTime = Math.max(0, resetTime - Date.now());

    if (import.meta.dev) {
      console.warn(`Rate limit exceeded for ${key}. Reset in ${waitTime}ms`);
    }

    return Promise.reject(
      new AppError(ErrorCode.RATE_LIMITED, `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)}s`)
    );
  }

  return config;
}

/**
 * Request interceptor for caching
 * Adds cache control headers based on request type
 */
export function cacheInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  // Add cache control headers for GET requests
  if (config.method?.toLowerCase() === "get") {
    config.headers = config.headers || {};

    // Add no-cache for dynamic data endpoints
    const noCacheEndpoints = ["/messages", "/sessions", "/unread"];

    const url = config.url ?? "";
    const shouldNoCache = noCacheEndpoints.some((endpoint) =>
      url.includes(endpoint)
    );

    if (shouldNoCache) {
      config.headers["Cache-Control"] = "no-cache";
      config.headers["Pragma"] = "no-cache";
    } else {
      // Allow caching for static data endpoints
      config.headers["Cache-Control"] = "max-age=300"; // 5 minutes
    }
  }

  return config;
}

/**
 * Request interceptor for request transformation
 * Transforms request data to match API expectations
 */
export function transformRequestInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  // Handle FormData requests
  if (config.data instanceof FormData) {
    // Don't set Content-Type for FormData - let browser set it with boundary
    delete config.headers["Content-Type"];
    return config;
  }

  // Transform request data for specific endpoints
  const url = config.url ?? "";

  // Example: Convert camelCase to snake_case for specific endpoints
  if (url.includes("/login") || url.includes("/register")) {
    // config.data = transformToSnakeCase(config.data);
  }

  return config;
}


/**
 * Request interceptor for debugging
 * Provides detailed logging for development
 */
export function debugInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  // if (process.env.NODE_ENV === "development") {
  //   console.group(
  //     `🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`
  //   );
  //   console.log("Request ID:", config.headers["X-Request-ID"]);
  //   console.log("Headers:", config.headers);
  //   console.log("Data:", config.data);
  //   console.log("Params:", config.params);
  //   console.log("Full Config:", config);
  //   console.groupEnd();
  // }

  return config;
}
