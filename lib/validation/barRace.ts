import { ok, err, type Result } from 'neverthrow'

export interface BarRaceData {
  categories: string[]
  start: number
  end: number
  step: number
  sort: 'asc' | 'desc'
  maxBars: number | null
  stepDuration: number | null
  frames: Record<string, number>[]
}

export type BarRaceRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-an-object'
  | 'invalid-categories'
  | 'invalid-range'
  | 'invalid-frames'
  | 'frame-count-mismatch'
  | 'invalid-sort'
  | 'invalid-max-bars'
  | 'invalid-step-duration'

export interface BarRaceRejection {
  reason: BarRaceRejectionReason
}

const MAX_JSON_SIZE = 500_000

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function validateCategories(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string' || item.trim().length === 0) return null
    if (seen.has(item)) return null
    seen.add(item)
  }
  return raw as string[]
}

function validateRange(
  obj: Record<string, unknown>,
): { start: number; end: number; step: number } | null {
  const { start, end, step } = obj
  if (!isFiniteNumber(start) || !isFiniteNumber(end) || !isFiniteNumber(step)) return null
  if (step <= 0 || end < start) return null
  return { start, end, step }
}

function validateSort(raw: unknown): 'asc' | 'desc' | null {
  if (raw === undefined) return 'desc'
  if (raw === 'asc' || raw === 'desc') return raw
  return null
}

function validateMaxBars(raw: unknown): number | null | false {
  if (raw === undefined || raw === null) return null
  if (Number.isInteger(raw) && (raw as number) >= 1) return raw as number
  return false
}

function validateStepDuration(raw: unknown): number | null | false {
  if (raw === undefined || raw === null) return null
  if (isFiniteNumber(raw) && raw > 0) return raw
  return false
}

function validateFrames(raw: unknown, categories: Set<string>): Record<string, number>[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null

  for (const frame of raw) {
    if (!isPlainObject(frame)) return null
    for (const [key, value] of Object.entries(frame)) {
      if (!categories.has(key) || !isFiniteNumber(value)) return null
    }
  }

  return raw as Record<string, number>[]
}

export const parseBarRaceData = (json: string): Result<BarRaceData, BarRaceRejection> => {
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

  const categories = validateCategories(parsed.categories)
  if (!categories) return err({ reason: 'invalid-categories' })

  const range = validateRange(parsed)
  if (!range) return err({ reason: 'invalid-range' })

  const sort = validateSort(parsed.sort)
  if (!sort) return err({ reason: 'invalid-sort' })

  const maxBars = validateMaxBars(parsed.maxBars)
  if (maxBars === false) return err({ reason: 'invalid-max-bars' })

  const stepDuration = validateStepDuration(parsed.stepDuration)
  if (stepDuration === false) return err({ reason: 'invalid-step-duration' })

  const categorySet = new Set(categories)
  const frames = validateFrames(parsed.frames, categorySet)
  if (!frames) return err({ reason: 'invalid-frames' })

  const expectedCount = Math.round((range.end - range.start) / range.step) + 1
  if (frames.length !== expectedCount) {
    return err({ reason: 'frame-count-mismatch' })
  }

  return ok({
    categories,
    ...range,
    sort,
    maxBars,
    stepDuration,
    frames,
  })
}
