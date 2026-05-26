/**
 * Axios HTTP client setup
 * Provides configured axios instance for API communication
 */

import axios, { type AxiosInstance } from 'axios'

/**
 * Get the API base URL from environment or default
 * This is safe to call at module level since it doesn't use Nuxt composables
 * In development, returns empty string to use relative URLs (proxied by Nitro)
 * In production, returns the full API URL
 */
function getApiBaseUrl(): string {
  // In development, use relative URLs to leverage Nitro's dev proxy
  if (import.meta.dev) {
    return '' // Empty string makes axios use relative URLs
  }

  // In browser context, check if window.__NUXT__ has runtime config
  type NuxtWindow = Window & { __NUXT__?: { config?: { public?: { apiBaseUrl?: string } } } }
  if (
    typeof window !== 'undefined' &&
    (window as NuxtWindow).__NUXT__?.config?.public?.apiBaseUrl
  ) {
    return (window as NuxtWindow).__NUXT__!.config!.public!.apiBaseUrl!
  }

  // Fallback to environment variable or empty string (use relative URLs for proxy)
  return (import.meta.env.NUXT_PUBLIC_API_BASE_URL as string | undefined) ?? ''
}

export function createApiClient(): AxiosInstance {
  const baseURL = getApiBaseUrl()

  const client = axios.create({
    baseURL: `${baseURL}`,
    timeout: 300000, // 5 minutes
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })

  // Request timeout configuration
  client.defaults.timeout = 300000

  return client
}

// Singleton instance for use throughout the application
export const apiClient = createApiClient()

// Export default for convenience
export default apiClient
