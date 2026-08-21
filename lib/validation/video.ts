import { ok, err, type Result } from 'neverthrow'

export interface VideoData {
  src: string
  title?: string
  poster?: string
  loop?: boolean
  muted?: boolean
  autoplay?: boolean
  preload?: 'none' | 'metadata' | 'auto'
}

export type VideoRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-an-object'
  | 'missing-source'
  | 'invalid-source'
  | 'invalid-poster'
  | 'invalid-title'
  | 'invalid-option'
  | 'unknown-option'
  | 'external-reference'

export interface VideoRejection {
  reason: VideoRejectionReason
}

const MAX_JSON_SIZE = 50_000
const MAX_TITLE_LENGTH = 200
const EXTERNAL_REFERENCE_PREFIXES = [
  'image://',
  'http:',
  'https:',
  'ftp:',
  'ftps:',
  'ws:',
  'wss:',
  'file:',
  'blob:',
  'data:',
  'javascript:',
  'vbscript:',
  '//',
]
const VIDEO_EXTENSION_RE = /\.(?:mp4|webm|ogv|ogg)$/i
const IMAGE_EXTENSION_RE = /\.(?:avif|gif|jpe?g|png|webp)$/i
const ALLOWED_KEYS = new Set(['src', 'title', 'poster', 'loop', 'muted', 'autoplay', 'preload'])
const ALLOWED_PRELOAD = new Set(['none', 'metadata', 'auto'])

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExternalReference = (value: unknown): boolean => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return EXTERNAL_REFERENCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  }
  if (Array.isArray(value)) return value.some(hasExternalReference)
  if (!isPlainObject(value)) return false
  return Object.values(value).some(hasExternalReference)
}

const isSafeLocalPath = (value: string, extension: RegExp): boolean =>
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.includes('..') &&
  !value.includes('\\') &&
  !value.includes('?') &&
  !value.includes('#') &&
  extension.test(value)

export const parseVideoData = (json: string): Result<VideoData, VideoRejection> => {
  if (json.length > MAX_JSON_SIZE) return err({ reason: 'oversize' })

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return err({ reason: 'unparseable' })
  }

  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    return err({ reason: 'not-an-object' })
  }

  if (hasExternalReference(parsed)) return err({ reason: 'external-reference' })
  if (Object.keys(parsed).some((key) => !ALLOWED_KEYS.has(key)))
    return err({ reason: 'unknown-option' })

  if (parsed.src === undefined) return err({ reason: 'missing-source' })
  if (typeof parsed.src !== 'string' || !isSafeLocalPath(parsed.src, VIDEO_EXTENSION_RE)) {
    return err({ reason: 'invalid-source' })
  }

  if (
    parsed.title !== undefined &&
    (typeof parsed.title !== 'string' || parsed.title.length > MAX_TITLE_LENGTH)
  ) {
    return err({ reason: 'invalid-title' })
  }
  if (
    parsed.poster !== undefined &&
    (typeof parsed.poster !== 'string' || !isSafeLocalPath(parsed.poster, IMAGE_EXTENSION_RE))
  ) {
    return err({ reason: 'invalid-poster' })
  }
  if (
    ['loop', 'muted', 'autoplay'].some(
      (key) => parsed[key] !== undefined && typeof parsed[key] !== 'boolean',
    )
  ) {
    return err({ reason: 'invalid-option' })
  }
  if (
    parsed.preload !== undefined &&
    (typeof parsed.preload !== 'string' || !ALLOWED_PRELOAD.has(parsed.preload))
  ) {
    return err({ reason: 'invalid-option' })
  }
  if (parsed.autoplay === true && parsed.muted !== true) return err({ reason: 'invalid-option' })

  const data: VideoData = { src: parsed.src }
  if (parsed.title !== undefined) data.title = parsed.title
  if (parsed.poster !== undefined) data.poster = parsed.poster
  if (typeof parsed.loop === 'boolean') data.loop = parsed.loop
  if (typeof parsed.muted === 'boolean') data.muted = parsed.muted
  if (typeof parsed.autoplay === 'boolean') data.autoplay = parsed.autoplay
  if (parsed.preload === 'none' || parsed.preload === 'metadata' || parsed.preload === 'auto') {
    data.preload = parsed.preload
  }
  return ok(data)
}
