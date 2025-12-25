/**
 * Token extraction utilities
 * Extracts tokens from API responses with camelCase field names
 */

export interface TokenPair {
  accessToken: string | null
  refreshToken: string | null
}

/**
 * Extracts access and refresh tokens from an API response
 *
 * @param data - Response data object containing token fields (camelCase)
 * @returns TokenPair object with token values
 */
export function extractTokensFromResponse(data: unknown): TokenPair {
  const tokenData = data as { accessToken?: string; refreshToken?: string } | null | undefined
  const accessToken = tokenData?.accessToken ?? null
  const refreshToken = tokenData?.refreshToken ?? null

  // Validate tokens are not empty strings
  const validatedAccessToken = accessToken && accessToken.trim() !== '' ? accessToken : null
  const validatedRefreshToken = refreshToken && refreshToken.trim() !== '' ? refreshToken : null

  return {
    accessToken: validatedAccessToken,
    refreshToken: validatedRefreshToken,
  }
}
