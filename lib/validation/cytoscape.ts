import { ok, err, type Result } from 'neverthrow'

export interface CytoscapeConfig {
  elements: CytoscapeElements
  layout?: CytoscapeLayout
  style?: CytoscapeStyleRule[]
}

export type CytoscapeElements =
  | { nodes: CytoscapeNode[]; edges: CytoscapeEdge[] }
  | CytoscapeElement[]

interface CytoscapeNode {
  data: { id: string; [key: string]: unknown }
  [key: string]: unknown
}

interface CytoscapeEdge {
  data: { source: string; target: string; [key: string]: unknown }
  [key: string]: unknown
}

type CytoscapeElement = CytoscapeNode | CytoscapeEdge

interface CytoscapeLayout {
  name: string
  [key: string]: unknown
}

interface CytoscapeStyleRule {
  selector: string
  style: Record<string, unknown>
}

export type CytoscapeRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-an-object'
  | 'missing-elements'
  | 'invalid-elements'
  | 'invalid-layout'
  | 'invalid-style'
  | 'external-reference'

export interface CytoscapeRejection {
  reason: CytoscapeRejectionReason
}

const MAX_JSON_SIZE = 50_000

const ALLOWED_LAYOUTS = new Set([
  'cose',
  'grid',
  'circle',
  'breadthfirst',
  'concentric',
  'random',
  'preset',
  'null',
])

const ALLOWED_STYLE_PROPERTIES = new Set([
  'background-color',
  'border-color',
  'border-width',
  'shape',
  'width',
  'height',
  'line-color',
  'target-arrow-color',
  'target-arrow-shape',
  'source-arrow-color',
  'source-arrow-shape',
  'curve-style',
  'label',
  'font-size',
  'color',
  'text-opacity',
  'text-valign',
  'text-halign',
  'overlay-opacity',
  'opacity',
  'line-style',
  'padding',
])

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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isExternalReference = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return EXTERNAL_REFERENCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

function hasExternalReference(node: unknown): boolean {
  if (typeof node === 'string') return isExternalReference(node)

  if (Array.isArray(node)) return node.some(hasExternalReference)

  if (!isPlainObject(node)) return false

  return Object.values(node).some(hasExternalReference)
}

function isValidNode(el: unknown): el is CytoscapeNode {
  if (!isPlainObject(el)) return false
  const data = el.data
  if (!isPlainObject(data)) return false
  return typeof data.id === 'string' && data.id.length > 0
}

function isValidEdge(el: unknown): el is CytoscapeEdge {
  if (!isPlainObject(el)) return false
  const data = el.data
  if (!isPlainObject(data)) return false
  return (
    typeof data.source === 'string' &&
    data.source.length > 0 &&
    typeof data.target === 'string' &&
    data.target.length > 0
  )
}

function isValidElement(el: unknown): boolean {
  return isValidNode(el) || isValidEdge(el)
}

function validateElements(raw: unknown): CytoscapeElements | null {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null
    return raw.every(isValidElement) ? (raw as CytoscapeElement[]) : null
  }

  if (!isPlainObject(raw)) return null

  const nodes = raw.nodes
  const edges = raw.edges

  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null
  if (nodes.length === 0 && edges.length === 0) return null
  if (!nodes.every(isValidNode) || !edges.every(isValidEdge)) return null

  return { nodes, edges } as CytoscapeElements
}

function validateLayout(raw: unknown): CytoscapeLayout | null | false {
  if (raw === undefined) return null
  if (!isPlainObject(raw)) return false
  if (typeof raw.name !== 'string' || !ALLOWED_LAYOUTS.has(raw.name)) return false
  return raw as CytoscapeLayout
}

function validateStyle(raw: unknown): CytoscapeStyleRule[] | null | false {
  if (raw === undefined) return null
  if (!Array.isArray(raw)) return false

  for (const rule of raw) {
    if (!isPlainObject(rule)) return false
    if (typeof rule.selector !== 'string') return false
    if (!isPlainObject(rule.style)) return false

    for (const key of Object.keys(rule.style)) {
      if (!ALLOWED_STYLE_PROPERTIES.has(key)) return false
    }
  }

  return raw as CytoscapeStyleRule[]
}

export const parseCytoscapeConfig = (json: string): Result<CytoscapeConfig, CytoscapeRejection> => {
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

  const elements = validateElements(parsed.elements)
  if (!elements)
    return err({ reason: parsed.elements === undefined ? 'missing-elements' : 'invalid-elements' })

  const layout = validateLayout(parsed.layout)
  if (layout === false) return err({ reason: 'invalid-layout' })

  const style = validateStyle(parsed.style)
  if (style === false) return err({ reason: 'invalid-style' })

  if (hasExternalReference(parsed)) return err({ reason: 'external-reference' })

  const config: CytoscapeConfig = { elements }
  if (layout) config.layout = layout
  if (style) config.style = style

  return ok(config)
}
