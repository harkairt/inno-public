/**
 * Pins DEFAULT_CONFIG — the fallback applied when config.json fails to load
 * (silent-fallback contract). Guards against silent drift of the shipped
 * defaults and asserts the object satisfies the InnoChatConfig schema.
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'
import { InnoChatConfigSchema } from '@/types/api/schemas'

describe('DEFAULT_CONFIG', () => {
  it('is a valid InnoChatConfig per the schema', () => {
    expect(InnoChatConfigSchema.safeParse(DEFAULT_CONFIG).success).toBe(true)
  })

  it('pins the shipped default values', () => {
    expect(DEFAULT_CONFIG).toEqual({
      mainColor: '#027be2',
      backgroundColor: '#ffffff',
      watermarkEnabled: false,
      partnerMessageBackgroundColor: 'rgba(0, 188, 212, 0.302)',
      ownMessageBackgroundColor: 'rgba(189, 189, 189, 0.302)',
      messageBorderThickness: 0,
      messageBorderColor: 'rgba(0, 0, 0, 0)',
      messageBorderStyle: 'solid',
      messageBorderRounded: 2,
      messageTextOwnItalic: false,
      messageTextOwnBold: false,
      messageTextOwnSize: 14,
      messageTextPartnerItalic: false,
      messageTextPartnerBold: false,
      messageTextPartnerSize: 14,
      axiosTimeout: 30000,
      publicMode: 0,
      publicLoginEmail: null,
      publicLoginPassword: null,
      publicAgent: -1,
    })
  })

  it('defaults to non-public mode (guards the operating-mode fallback)', () => {
    expect(DEFAULT_CONFIG.publicMode).toBe(0)
    expect(DEFAULT_CONFIG.publicAgent).toBe(-1)
  })
})
