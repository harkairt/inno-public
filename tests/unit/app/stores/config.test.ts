import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConfigStore } from '~/stores/config'

vi.mock('@/lib/api/services/ConfigService', () => ({
  configService: {
    getConfig: vi.fn(),
  },
}))

describe('Config Store — loadConfig', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with defaults before loading', () => {
    const store = useConfigStore()

    expect(store.isLoaded).toBe(false)
    expect(store.config.mainColor).toBe('#027be2')
    expect(store.config.watermarkEnabled).toBe(false)
  })

  it('merges loaded config with defaults', async () => {
    const { configService } = await import('@/lib/api/services/ConfigService')

    vi.mocked(configService.getConfig).mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { mainColor: '#ff0000' },
    } as ReturnType<typeof configService.getConfig> extends Promise<infer R> ? R : never)

    const store = useConfigStore()
    await store.loadConfig()

    expect(store.isLoaded).toBe(true)
    expect(store.loadError).toBeNull()
    expect(store.config.mainColor).toBe('#ff0000')
    // Defaults should be preserved for fields not in the loaded config
    expect(store.config.watermarkEnabled).toBe(false)
  })

  it('marks as loaded even on service error (silent failure)', async () => {
    const { configService } = await import('@/lib/api/services/ConfigService')

    vi.mocked(configService.getConfig).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: new Error('Config unavailable'),
    } as ReturnType<typeof configService.getConfig> extends Promise<infer R> ? R : never)

    const store = useConfigStore()
    await store.loadConfig()

    expect(store.isLoaded).toBe(true)
    expect(store.loadError).toBeTruthy()
    // Defaults still in place
    expect(store.config.mainColor).toBe('#027be2')
  })

  it('marks as loaded on unexpected exception', async () => {
    const { configService } = await import('@/lib/api/services/ConfigService')

    vi.mocked(configService.getConfig).mockRejectedValue(new Error('Network failure'))

    const store = useConfigStore()
    await store.loadConfig()

    expect(store.isLoaded).toBe(true)
    expect(store.loadError).toBeTruthy()
  })
})

describe('Config Store — setConfig', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('merges partial config updates', () => {
    const store = useConfigStore()

    store.setConfig({ mainColor: '#00ff00', watermarkEnabled: true })

    expect(store.config.mainColor).toBe('#00ff00')
    expect(store.config.watermarkEnabled).toBe(true)
    expect(store.config.backgroundColor).toBe('#ffffff') // unchanged default
  })
})

describe('Config Store — computed styles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('ownMessageStyle reflects config values', () => {
    const store = useConfigStore()

    store.setConfig({
      ownMessageBackgroundColor: '#aabbcc',
      messageTextOwnBold: true,
      messageTextOwnItalic: false,
      messageTextOwnSize: 16,
    })

    expect(store.ownMessageStyle.backgroundColor).toBe('#aabbcc')
    expect(store.ownMessageStyle.fontWeight).toBe('bold')
    expect(store.ownMessageStyle.fontStyle).toBe('normal')
    expect(store.ownMessageStyle.fontSize).toBe('16px')
  })
})
