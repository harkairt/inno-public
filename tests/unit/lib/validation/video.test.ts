import { describe, expect, it } from 'vitest'
import { parseVideoData } from '@/lib/validation/video'

const validVideo = { src: '/videos/demo.webm', title: 'Demo', muted: true, autoplay: true }

const reasonOf = (json: string): string | undefined => {
  const result = parseVideoData(json)
  return result.isErr() ? result.error.reason : undefined
}

describe('parseVideoData', () => {
  it('accepts a same-origin video with supported options', () => {
    const result = parseVideoData(JSON.stringify(validVideo))
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(validVideo)
  })

  it.each([
    ['oversize', 'x'.repeat(50_001)],
    ['unparseable', '{'],
    ['not-an-object', '[]'],
    ['missing-source', JSON.stringify({ title: 'Demo' })],
    ['invalid-source', JSON.stringify({ src: '/videos/demo.txt' })],
    ['invalid-poster', JSON.stringify({ src: '/videos/demo.mp4', poster: '/videos/demo.svg' })],
    ['invalid-title', JSON.stringify({ src: '/videos/demo.mp4', title: 3 })],
    ['invalid-option', JSON.stringify({ src: '/videos/demo.mp4', autoplay: true })],
    ['invalid-option', JSON.stringify({ src: '/videos/demo.mp4', preload: 'eager' })],
    ['unknown-option', JSON.stringify({ src: '/videos/demo.mp4', controls: false })],
    ['external-reference', JSON.stringify({ src: 'https://example.com/demo.mp4' })],
    ['external-reference', JSON.stringify({ src: 'data:video/mp4;base64,abc' })],
  ])('rejects %s input', (reason, json) => {
    expect(reasonOf(json)).toBe(reason)
  })

  it('rejects path traversal and query-string references', () => {
    expect(reasonOf(JSON.stringify({ src: '/videos/../private.mp4' }))).toBe('invalid-source')
    expect(reasonOf(JSON.stringify({ src: '/videos/demo.mp4?token=secret' }))).toBe(
      'invalid-source',
    )
  })
})
