import { err, ok, type Result } from 'neverthrow'

export interface MermaidData {
  source: string
}

export type MermaidRejectionReason =
  | 'oversize'
  | 'empty'
  | 'external-reference'
  | 'directive'
  | 'interactive'
  | 'html-label'

export interface MermaidRejection {
  reason: MermaidRejectionReason
}

const MAX_MERMAID_SIZE = 50_000
const EXTERNAL_REFERENCE_PREFIXES = [
  'image:',
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
]
const HTML_LABEL_PATTERN = /<\/?[a-z]/i

const linesOf = (source: string): string[] => source.split('\n').map((line) => line.trimStart())

const hasExternalReference = (source: string): boolean => {
  const normalized = source.toLowerCase()
  return (
    normalized.includes('//') ||
    EXTERNAL_REFERENCE_PREFIXES.some((prefix) => normalized.includes(prefix))
  )
}

const hasDirective = (source: string): boolean =>
  linesOf(source).some((line) => line.startsWith('%%{') || line.startsWith('---'))

const hasClickStatement = (source: string): boolean =>
  linesOf(source).some((line) => /^click(?:\s|$)/i.test(line))

/**
 * Validates Mermaid fence content without loading the Mermaid renderer.
 * Mermaid grammar validation happens when the lazy-loaded renderer parses it.
 */
export const parseMermaidData = (source: string): Result<MermaidData, MermaidRejection> => {
  if (source.length > MAX_MERMAID_SIZE) return err({ reason: 'oversize' })
  if (!source.trim()) return err({ reason: 'empty' })
  if (hasExternalReference(source)) return err({ reason: 'external-reference' })
  if (hasDirective(source)) return err({ reason: 'directive' })
  if (hasClickStatement(source)) return err({ reason: 'interactive' })
  if (HTML_LABEL_PATTERN.test(source)) return err({ reason: 'html-label' })

  return ok({ source })
}
