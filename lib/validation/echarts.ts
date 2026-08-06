import { ok, err, type Result } from 'neverthrow'

export type EChartsOption = Record<string, unknown>

export type EChartsRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-an-object'
  | 'external-reference'
  | 'navigation-target'
  | 'invalid-prompt'

export interface EChartsRejection {
  reason: EChartsRejectionReason
}

const MAX_OPTION_JSON_SIZE = 50_000

export const MAX_PROMPT_LENGTH = 500

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

const NAVIGATION_KEYS = ['link', 'sublink']

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isValidPrompt = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_PROMPT_LENGTH

const isExternalReference = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return EXTERNAL_REFERENCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

const inspectNode = (node: Record<string, unknown>): EChartsRejectionReason | null => {
  for (const value of Object.values(node)) {
    if (typeof value === 'string' && isExternalReference(value)) return 'external-reference'
  }

  for (const key of NAVIGATION_KEYS) {
    const value = node[key]
    if (typeof value === 'string' && value.trim().length > 0) return 'navigation-target'
  }

  if ('prompt' in node && !isValidPrompt(node.prompt)) return 'invalid-prompt'

  return null
}

function findRejection(node: unknown): EChartsRejectionReason | null {
  if (typeof node === 'string') return isExternalReference(node) ? 'external-reference' : null

  if (Array.isArray(node)) {
    for (const item of node) {
      const reason = findRejection(item)
      if (reason) return reason
    }
    return null
  }

  if (!isPlainObject(node)) return null

  const own = inspectNode(node)
  if (own) return own

  for (const value of Object.values(node)) {
    const reason = findRejection(value)
    if (reason) return reason
  }

  return null
}

function containsPrompt(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(containsPrompt)
  if (!isPlainObject(node)) return false
  if (isValidPrompt(node.prompt)) return true
  return Object.values(node).some(containsPrompt)
}

export const hasActionableItems = (option: EChartsOption): boolean => containsPrompt(option)

export const parseEChartsOption = (json: string): Result<EChartsOption, EChartsRejection> => {
  if (json.length > MAX_OPTION_JSON_SIZE) return err({ reason: 'oversize' })

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return err({ reason: 'unparseable' })
  }

  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    return err({ reason: 'not-an-object' })
  }

  const reason = findRejection(parsed)
  return reason ? err({ reason }) : ok(parsed)
}
