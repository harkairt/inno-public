/**
 * Unit tests for usePublicMode — drives the composable through a real, seeded
 * config store (no mocking). Verifies the public-mode truth table, the -1
 * publicAgent sentinel, credential/validity helpers, and the chat-URL shape.
 */
import { describe, it, expect } from 'vitest'
import { usePublicMode } from '@/app/composables/usePublicMode'
import { useConfigStore } from '@/app/stores/config'
import type { InnoChatConfig } from '@/types/api/schemas'

/** Seed the active config store and return the composable bound to it. */
function seedConfig(partial: Partial<InnoChatConfig>) {
  const configStore = useConfigStore()
  configStore.setConfig(partial)
  return { configStore, ...usePublicMode() }
}

describe('usePublicMode', () => {
  describe('isPublicMode truth table', () => {
    it('is true when publicMode === 1', () => {
      const { isPublicMode } = seedConfig({ publicMode: 1 })
      expect(isPublicMode.value).toBe(true)
    })

    it('is false when publicMode === 0', () => {
      const { isPublicMode } = seedConfig({ publicMode: 0 })
      expect(isPublicMode.value).toBe(false)
    })

    it('is false when publicMode is undefined (defaults to 0)', () => {
      // DEFAULT_CONFIG.publicMode is 0; not overriding it leaves the falsy branch.
      const { isPublicMode } = seedConfig({})
      expect(isPublicMode.value).toBe(false)
    })
  })

  describe('publicAgentId sentinel', () => {
    it('returns the agent id when a real agent is configured', () => {
      const { publicAgentId } = seedConfig({ publicAgent: 42 })
      expect(publicAgentId.value).toBe(42)
    })

    it('returns null for the -1 sentinel (no agent configured)', () => {
      const { publicAgentId } = seedConfig({ publicAgent: -1 })
      expect(publicAgentId.value).toBeNull()
    })
  })

  describe('credentials', () => {
    it('exposes login email/password from config', () => {
      const { publicLoginEmail, publicLoginPassword } = seedConfig({
        publicLoginEmail: 'bot@example.com',
        publicLoginPassword: 'secret',
      })
      expect(publicLoginEmail.value).toBe('bot@example.com')
      expect(publicLoginPassword.value).toBe('secret')
    })

    it('hasPublicCredentials is true only when both email and password are set', () => {
      expect(
        seedConfig({ publicLoginEmail: 'a@b.c', publicLoginPassword: 'p' }).hasPublicCredentials
          .value,
      ).toBe(true)
    })

    it('hasPublicCredentials is false when a credential is missing', () => {
      expect(
        seedConfig({ publicLoginEmail: 'a@b.c', publicLoginPassword: null }).hasPublicCredentials
          .value,
      ).toBe(false)
      expect(
        seedConfig({ publicLoginEmail: null, publicLoginPassword: 'p' }).hasPublicCredentials.value,
      ).toBe(false)
    })
  })

  describe('hasPublicAuthError', () => {
    it('reflects the config store publicAuthError flag', () => {
      const { configStore, hasPublicAuthError } = seedConfig({})
      expect(hasPublicAuthError.value).toBe(false)
      configStore.setPublicAuthError(true)
      expect(hasPublicAuthError.value).toBe(true)
    })
  })

  describe('isValidPublicAgent', () => {
    it('matches the configured agent (number or numeric string)', () => {
      const { isValidPublicAgent } = seedConfig({ publicAgent: 7 })
      expect(isValidPublicAgent(7)).toBe(true)
      expect(isValidPublicAgent('7')).toBe(true)
      expect(isValidPublicAgent(8)).toBe(false)
    })

    it('is always false when no agent is configured (-1 sentinel)', () => {
      const { isValidPublicAgent } = seedConfig({ publicAgent: -1 })
      expect(isValidPublicAgent(-1)).toBe(false)
      expect(isValidPublicAgent(1)).toBe(false)
    })
  })

  describe('getPublicChatUrl', () => {
    it('builds the public entry URL for the configured agent', () => {
      const { getPublicChatUrl } = seedConfig({ publicAgent: 99 })
      expect(getPublicChatUrl()).toBe('/chats/public/new/99')
    })

    it('returns null when no agent is configured', () => {
      const { getPublicChatUrl } = seedConfig({ publicAgent: -1 })
      expect(getPublicChatUrl()).toBeNull()
    })
  })
})
