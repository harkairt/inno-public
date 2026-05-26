import { describe, it, expect } from 'vitest'

describe('chats page', () => {
  it('exports a valid Vue component', async () => {
    const mod = (await import('@/app/pages/chats.vue')) as { default: unknown }

    expect(typeof mod.default).toBe('object')
    expect(mod.default).toBeDefined()
  })
})
