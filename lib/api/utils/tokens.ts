/**
 * Token extraction utilities
 * Handles flexible token extraction from API responses with varying casing conventions
 */

export interface TokenPair {
  accessToken: string | null
  refreshToken: string | null
}

/**
 * Extracts access and refresh tokens from an API response
 * Handles both camelCase (accessToken) and PascalCase (AccessToken) fields
 *
 * @param data - Response data object that may contain token fields
 * @returns TokenPair object with normalized camelCase field names
 */
export function extractTokensFromResponse(data: any): TokenPair {
  const accessToken = data?.accessToken ?? data?.AccessToken ?? null
  const refreshToken = data?.refreshToken ?? data?.RefreshToken ?? null

  // Validate tokens are not empty strings
  const validatedAccessToken = accessToken && accessToken.trim() !== '' ? accessToken : null
  const validatedRefreshToken = refreshToken && refreshToken.trim() !== '' ? refreshToken : null

  return {
    accessToken: validatedAccessToken,
    refreshToken: validatedRefreshToken,
  }
}
