/**
 * Tests for the buffer polyfill plugin. It exposes Node's Buffer on window for
 * libraries (@gradio/client) that expect it.
 */
import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'
import bufferPlugin from '@/app/plugins/buffer.client'

function runPlugin() {
  return (bufferPlugin as unknown as () => void)()
}

describe('buffer plugin', () => {
  it('assigns the Buffer polyfill to window', () => {
    delete (window as unknown as { Buffer?: unknown }).Buffer

    runPlugin()

    expect(window.Buffer).toBe(Buffer)
  })
})
