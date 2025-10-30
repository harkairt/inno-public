import { describe, it, expect } from 'vitest'
import { extractTokensFromResponse } from '@/lib/api/utils/tokens'

describe('extractTokensFromResponse', () => {
  describe('PascalCase tokens', () => {
    it('should extract tokens with PascalCase keys', () => {
      const data = {
        AccessToken: 'access-123',
        RefreshToken: 'refresh-456'
      }
      const result = extractTokensFromResponse(data)
      expect(result).toEqual({
        accessToken: 'access-123',
        refreshToken: 'refresh-456'
      })
    })
  })

  describe('camelCase tokens', () => {
    it('should extract tokens with camelCase keys', () => {
      const data = {
        accessToken: 'access-789',
        refreshToken: 'refresh-012'
      }
      const result = extractTokensFromResponse(data)
      expect(result).toEqual({
        accessToken: 'access-789',
        refreshToken: 'refresh-012'
      })
    })
  })

  describe('missing tokens', () => {
    it('should return null for missing accessToken', () => {
      const data = { RefreshToken: 'refresh-only' }
      const result = extractTokensFromResponse(data)
      expect(result.accessToken).toBeNull()
      expect(result.refreshToken).toBe('refresh-only')
    })

    it('should return null for missing refreshToken', () => {
      const data = { AccessToken: 'access-only' }
      const result = extractTokensFromResponse(data)
      expect(result.accessToken).toBe('access-only')
      expect(result.refreshToken).toBeNull()
    })

    it('should return nulls for empty object', () => {
      const result = extractTokensFromResponse({})
      expect(result).toEqual({
        accessToken: null,
        refreshToken: null
      })
    })

    it('should return nulls for null input', () => {
      const result = extractTokensFromResponse(null)
      expect(result).toEqual({
        accessToken: null,
        refreshToken: null
      })
    })

    it('should return nulls for undefined input', () => {
      const result = extractTokensFromResponse(undefined)
      expect(result).toEqual({
        accessToken: null,
        refreshToken: null
      })
    })
  })

  describe('empty string tokens', () => {
    it('should return null for empty string accessToken', () => {
      const data = {
        AccessToken: '',
        RefreshToken: 'valid-refresh'
      }
      const result = extractTokensFromResponse(data)
      expect(result.accessToken).toBeNull()
      expect(result.refreshToken).toBe('valid-refresh')
    })

    it('should return null for whitespace-only accessToken', () => {
      const data = {
        AccessToken: '   ',
        RefreshToken: 'valid-refresh'
      }
      const result = extractTokensFromResponse(data)
      expect(result.accessToken).toBeNull()
    })

    it('should return null for empty string refreshToken', () => {
      const data = {
        AccessToken: 'valid-access',
        RefreshToken: ''
      }
      const result = extractTokensFromResponse(data)
      expect(result.accessToken).toBe('valid-access')
      expect(result.refreshToken).toBeNull()
    })
  })

  describe('mixed case priority', () => {
    it('should prefer camelCase over PascalCase when both exist', () => {
      const data = {
        accessToken: 'camel-access',
        AccessToken: 'pascal-access',
        refreshToken: 'camel-refresh',
        RefreshToken: 'pascal-refresh'
      }
      const result = extractTokensFromResponse(data)
      expect(result.accessToken).toBe('camel-access')
      expect(result.refreshToken).toBe('camel-refresh')
    })
  })
})
