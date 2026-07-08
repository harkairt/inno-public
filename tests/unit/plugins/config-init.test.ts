/**
 * Tests for the config-init client plugin.
 *
 * Drives setup() against MSW's /api/settings/config.json through the REAL
 * ConfigService + config store (no mocking). Verifies the axios timeout is
 * applied, CSS custom properties are written to :root for each sanitizer
 * allow-list branch, injection attempts are rejected, and a failed load falls
 * back to defaults without crashing.
 */
import { describe, it, expect } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { httpError } from '@/tests/msw/http'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'
import { apiClient } from '@/lib/api/client'
import { useConfigStore } from '@/app/stores/config'
import type { InnoChatConfig } from '@/types/api/schemas'
import configInitPlugin from '@/app/plugins/config-init.client'

const CONFIG_PATH = '/api/settings/config.json'

/** The plugin is authored in object form; run its setup() directly. */
function runPlugin() {
  return (configInitPlugin as unknown as { setup: () => Promise<unknown> }).setup()
}

/** Serve a full-schema config.json with the given overrides (served raw). */
function serveConfig(overrides: Partial<InnoChatConfig>) {
  server.use(http.get(CONFIG_PATH, () => HttpResponse.json({ ...DEFAULT_CONFIG, ...overrides })))
}

/** Read a CSS custom property off the document root. */
function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name)
}

describe('config-init plugin', () => {
  it('applies the axios timeout and writes CSS custom properties on success', async () => {
    serveConfig({ axiosTimeout: 55000 })

    await runPlugin()

    const configStore = useConfigStore()
    expect(configStore.isLoaded).toBe(true)
    expect(configStore.loadError).toBeNull()
    expect(apiClient.defaults.timeout).toBe(55000)

    // Numeric-derived properties.
    expect(cssVar('--config-own-message-font-size')).toBe('14px')
    expect(cssVar('--config-message-border-radius')).toBe('2px')
    expect(cssVar('--config-own-message-font-style')).toBe('normal')
    expect(cssVar('--config-own-message-font-weight')).toBe('normal')
  })

  it('accepts every color allow-list branch (hex, rgb, rgba, named)', async () => {
    serveConfig({
      mainColor: '#abc', // hex (3-8 digits)
      messageBorderColor: '#aabbccdd', // hex (8 digits)
      backgroundColor: 'rgb(1, 2, 3)', // rgb()
      ownMessageBackgroundColor: 'rgba(0, 0, 0, 0.5)', // rgba()
      partnerMessageBackgroundColor: 'red', // named color
      messageBorderStyle: 'dashed', // style allow-list
    })

    await runPlugin()

    expect(cssVar('--config-main-color')).toBe('#abc')
    expect(cssVar('--config-message-border-color')).toBe('#aabbccdd')
    expect(cssVar('--config-background-color')).toBe('rgb(1, 2, 3)')
    expect(cssVar('--config-own-message-bg')).toBe('rgba(0, 0, 0, 0.5)')
    expect(cssVar('--config-partner-message-bg')).toBe('red')
    expect(cssVar('--config-message-border-style')).toBe('dashed')
  })

  it('rejects CSS injection attempts (property left empty)', async () => {
    serveConfig({
      mainColor: 'red; } body { display:none', // rule-breakout attempt
      backgroundColor: 'expression(alert(1))', // fails all branches (parens+no digits)
      ownMessageBackgroundColor: 'url(javascript:alert(1))', // not a valid color form
      partnerMessageBackgroundColor: 'rgb(1, 2)', // wrong arg count
      messageBorderColor: '#zzzzzz', // non-hex chars
    })

    await runPlugin()

    expect(cssVar('--config-main-color')).toBe('')
    expect(cssVar('--config-background-color')).toBe('')
    expect(cssVar('--config-own-message-bg')).toBe('')
    expect(cssVar('--config-partner-message-bg')).toBe('')
    expect(cssVar('--config-message-border-color')).toBe('')
  })

  it('falls back to defaults without crashing when config.json fails (500)', async () => {
    server.use(http.get(CONFIG_PATH, () => httpError(500)))

    await runPlugin()

    const configStore = useConfigStore()
    expect(configStore.isLoaded).toBe(true) // silent-failure contract: still marked loaded
    expect(configStore.loadError).not.toBeNull()
    // Defaults still applied — no crash, timeout set from the default config.
    expect(apiClient.defaults.timeout).toBe(DEFAULT_CONFIG.axiosTimeout)
  })
})
