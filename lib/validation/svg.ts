import { err, ok, type Result } from 'neverthrow'

export interface SvgData {
  markup: string
  title?: string
}

export type SvgRejectionReason =
  | 'oversize'
  | 'unparseable'
  | 'not-svg'
  | 'unsupported-element'
  | 'unsupported-attribute'
  | 'invalid-attribute'
  | 'external-reference'
  | 'invalid-content'
  | 'too-complex'

export interface SvgRejection {
  reason: SvgRejectionReason
}

const MAX_SVG_SIZE = 50_000
const MAX_ELEMENTS = 1_000
const MAX_DEPTH = 64
const MAX_ATTRIBUTES = 4_000
const MAX_ABSOLUTE_NUMBER = 1_000_000
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'marker',
])

const LENGTH_ATTRIBUTES = new Set([
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'fx',
  'fy',
  'refX',
  'refY',
  'stroke-dashoffset',
  'letter-spacing',
  'baseline-shift',
])

const NON_NEGATIVE_LENGTH_ATTRIBUTES = new Set([
  'width',
  'height',
  'r',
  'rx',
  'ry',
  'fr',
  'stroke-width',
  'font-size',
  'textLength',
  'markerWidth',
  'markerHeight',
])

const OPACITY_ATTRIBUTES = new Set(['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity'])

const PAINT_ATTRIBUTES = new Set(['fill', 'stroke', 'color', 'stop-color'])
const INTERNAL_URL_ATTRIBUTES = new Set([
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
])
const TRANSFORM_ATTRIBUTES = new Set(['transform', 'gradientTransform'])
const TEXT_ONLY_ELEMENTS = new Set(['text', 'tspan', 'title', 'desc'])

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

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const LENGTH_PATTERN =
  /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:%|px|em|rem|pt|pc|cm|mm|in)?$/i
const SAFE_ID_PATTERN = /^[a-z_][\w.-]*$/i
const INTERNAL_URL_PATTERN = /^url\(#[a-z_][\w.-]*\)$/i
const INTERNAL_HREF_PATTERN = /^#[a-z_][\w.-]*$/i
const PATH_DATA_PATTERN = /^[mzlhvcsqtae0-9.,+\-\s]+$/i
const COLOR_PATTERN = /^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgba?|hsla?)\([0-9.%+\-,\s]+\))$/i
const XML_DECLARATION_PATTERN =
  /^<\?xml\s+version\s*=\s*(?:"1\.0"|'1\.0')(?:\s+encoding\s*=\s*(?:"UTF-8"|'UTF-8'))?(?:\s+standalone\s*=\s*(?:"yes"|"no"|'yes'|'no'))?\s*\?>$/i

interface SvgAttribute {
  name: string
  value: string
}

interface OpeningTag {
  kind: 'opening'
  name: string
  attributes: SvgAttribute[]
  selfClosing: boolean
  nextIndex: number
}

interface ClosingTag {
  kind: 'closing'
  name: string
  nextIndex: number
}

type ParsedTag = OpeningTag | ClosingTag

class SvgValidationFailure extends Error {
  constructor(readonly reason: SvgRejectionReason) {
    super(reason)
  }
}

const reject = (reason: SvgRejectionReason): never => {
  throw new SvgValidationFailure(reason)
}

const isNameStart = (character: string | undefined): boolean =>
  character !== undefined && /[a-z_:]/i.test(character)

const isNameCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[\w.:-]/.test(character)

const skipWhitespace = (source: string, start: number): number => {
  let index = start
  while (index < source.length && /\s/.test(source[index] ?? '')) index++
  return index
}

const readName = (source: string, start: number): { name: string; nextIndex: number } => {
  if (!isNameStart(source[start])) reject('unparseable')

  let index = start + 1
  while (isNameCharacter(source[index])) index++

  return { name: source.slice(start, index), nextIndex: index }
}

const NAMED_XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  apos: "'",
  quot: '"',
}

const isInvalidXmlCodePoint = (codePoint: number): boolean => {
  const invalidControl = codePoint < 0x20 && ![0x09, 0x0a, 0x0d].includes(codePoint)
  const surrogate = codePoint >= 0xd800 && codePoint <= 0xdfff
  return invalidControl || surrogate || codePoint === 0xfffe || codePoint === 0xffff
}

const decodeNumericEntity = (entity: string): string => {
  const hexadecimal = entity[1]?.toLowerCase() === 'x'
  const digits = entity.slice(hexadecimal ? 2 : 1)
  const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10)

  if (
    !Number.isInteger(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    isInvalidXmlCodePoint(codePoint)
  ) {
    reject('unparseable')
  }

  return String.fromCodePoint(codePoint)
}

const decodeEntity = (entity: string): string => {
  if (entity.startsWith('#')) return decodeNumericEntity(entity)
  return NAMED_XML_ENTITIES[entity.toLowerCase()] ?? reject('unparseable')
}

const decodeXmlEntities = (value: string): string => {
  let decoded = ''
  let cursor = 0
  const entityPattern = /&(#x[0-9a-f]+|#\d+|amp|lt|gt|apos|quot);/gi

  for (const match of value.matchAll(entityPattern)) {
    const index = match.index ?? reject('unparseable')

    const preceding = value.slice(cursor, index)
    if (preceding.includes('&')) reject('unparseable')
    decoded += preceding

    const entity = match[1] ?? reject('unparseable')
    decoded += decodeEntity(entity)

    cursor = index + match[0].length
  }

  const remainder = value.slice(cursor)
  if (remainder.includes('&')) reject('unparseable')
  return decoded + remainder
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeXmlAttribute = (value: string): string =>
  escapeXmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const parseClosingTag = (source: string, start: number): ClosingTag => {
  let index = start
  const parsedName = readName(source, index)
  const name = parsedName.name
  index = skipWhitespace(source, parsedName.nextIndex)

  if (source[index] !== '>') reject('unparseable')
  return { kind: 'closing', name, nextIndex: index + 1 }
}

const parseAttribute = (
  source: string,
  start: number,
): { attribute: SvgAttribute; nextIndex: number } => {
  const parsedName = readName(source, start)
  const name = parsedName.name
  let index = skipWhitespace(source, parsedName.nextIndex)

  if (source[index] !== '=') reject('unparseable')
  index = skipWhitespace(source, index + 1)

  const quote = source[index] ?? reject('unparseable')
  if (quote !== '"' && quote !== "'") reject('unparseable')

  const valueStart = index + 1
  const valueEnd = source.indexOf(quote, valueStart)
  if (valueEnd === -1) reject('unparseable')

  const rawValue = source.slice(valueStart, valueEnd)
  if (rawValue.includes('<')) reject('unparseable')

  return {
    attribute: { name, value: decodeXmlEntities(rawValue) },
    nextIndex: valueEnd + 1,
  }
}

const parseOpeningTag = (source: string, start: number): OpeningTag => {
  const parsedName = readName(source, start)
  const name = parsedName.name
  let index = parsedName.nextIndex
  const attributes: SvgAttribute[] = []
  const seenAttributes = new Set<string>()

  while (index < source.length) {
    const beforeWhitespace = index
    index = skipWhitespace(source, index)
    const character = source[index]

    if (character === '>')
      return { kind: 'opening', name, attributes, selfClosing: false, nextIndex: index + 1 }
    if (character === '/' && source[index + 1] === '>')
      return { kind: 'opening', name, attributes, selfClosing: true, nextIndex: index + 2 }
    if (index === beforeWhitespace) reject('unparseable')

    const parsed = parseAttribute(source, index)
    if (seenAttributes.has(parsed.attribute.name)) reject('unparseable')

    seenAttributes.add(parsed.attribute.name)
    attributes.push(parsed.attribute)
    index = parsed.nextIndex
  }

  return reject('unparseable')
}

const parseTag = (source: string, start: number): ParsedTag =>
  source[start + 1] === '/'
    ? parseClosingTag(source, start + 2)
    : parseOpeningTag(source, start + 1)

const parseFiniteNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (!NUMBER_PATTERN.test(trimmed)) return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_ABSOLUTE_NUMBER) return null
  return parsed
}

const parseLength = (value: string, nonNegative = false): boolean => {
  const match = value.trim().match(LENGTH_PATTERN)
  if (!match?.[1]) return false

  const parsed = Number(match[1])
  if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_ABSOLUTE_NUMBER) return false
  return !nonNegative || parsed >= 0
}

const parseNumberList = (value: string): number[] | null => {
  const parts = value.trim().split(/[\s,]+/)
  if (parts.length === 0 || parts.some((part) => part.length === 0)) return null

  const values = parts.map(parseFiniteNumber)
  return values.every((part): part is number => part !== null) ? values : null
}

const isValidOpacity = (value: string): boolean => {
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) {
    const percent = parseFiniteNumber(trimmed.slice(0, -1))
    return percent !== null && percent >= 0 && percent <= 100
  }

  const number = parseFiniteNumber(trimmed)
  return number !== null && number >= 0 && number <= 1
}

const hasInvalidXmlCharacter = (value: string): boolean => {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (isInvalidXmlCodePoint(codePoint)) return true
  }
  return false
}

const compactReference = (value: string): string =>
  [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 0x20 && codePoint !== 0x7f
    })
    .join('')
    .toLowerCase()

const isExternalReference = (value: string): boolean => {
  const compact = compactReference(value)
  if (EXTERNAL_REFERENCE_PREFIXES.some((prefix) => compact.startsWith(prefix))) return true

  return compact.includes('url(') && !INTERNAL_URL_PATTERN.test(compact)
}

const isValidTransform = (value: string): boolean => {
  const input = value.trim()
  if (!input) return false

  const transformPattern = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/gy
  const argumentCounts: Record<string, number[]> = {
    matrix: [6],
    translate: [1, 2],
    scale: [1, 2],
    rotate: [1, 3],
    skewX: [1],
    skewY: [1],
  }

  let cursor = 0
  while (cursor < input.length) {
    cursor = skipWhitespace(input, cursor)
    transformPattern.lastIndex = cursor
    const match = transformPattern.exec(input)
    if (match?.[1] === undefined || match[2] === undefined || match.index !== cursor) return false

    const values = parseNumberList(match[2])
    if (!values || !argumentCounts[match[1]]?.includes(values.length)) return false
    cursor = transformPattern.lastIndex
  }

  return true
}

const isValidPreserveAspectRatio = (value: string): boolean =>
  /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value.trim())

type AttributeValidator = (element: string, value: string) => boolean

const oneOf =
  (allowed: readonly string[]): AttributeValidator =>
  (_element, value) =>
    allowed.includes(value)

const isValidIdList = (value: string): boolean => {
  const ids = value.trim().split(/\s+/)
  return ids.length > 0 && ids.every((id) => SAFE_ID_PATTERN.test(id))
}

const isValidViewBox = (value: string): boolean => {
  const values = parseNumberList(value)
  const width = values?.at(2)
  const height = values?.at(3)
  return (
    values !== null &&
    values.length === 4 &&
    width !== undefined &&
    width > 0 &&
    height !== undefined &&
    height > 0
  )
}

const isValidPositiveNumber = (value: string): boolean => {
  const number = parseFiniteNumber(value)
  return number !== null && number > 0
}

const isValidPathData = (value: string): boolean =>
  PATH_DATA_PATTERN.test(value) && /m/i.test(value)

const isValidPoints = (value: string): boolean => {
  const values = parseNumberList(value)
  return values !== null && values.length >= 4 && values.length % 2 === 0
}

const isValidLengthList = (value: string, nonNegative = false): boolean => {
  const values = value.trim().split(/[\s,]+/)
  return values.length > 0 && values.every((part) => parseLength(part, nonNegative))
}

const isValidPaint = (value: string): boolean => {
  const paint = value.trim()
  return COLOR_PATTERN.test(paint) || INTERNAL_URL_PATTERN.test(paint)
}

const isValidInternalUrl = (value: string): boolean => {
  const reference = value.trim()
  return reference === 'none' || INTERNAL_URL_PATTERN.test(reference)
}

const isValidMiterLimit = (value: string): boolean => {
  const number = parseFiniteNumber(value)
  return number !== null && number >= 1
}

const isValidFontFamily = (value: string): boolean =>
  Boolean(value.trim()) && value.length <= 200 && /^[-\w ,'"]+$/.test(value)

const isValidOrientation = (value: string): boolean =>
  ['auto', 'auto-start-reverse'].includes(value) || parseFiniteNumber(value) !== null

const ATTRIBUTE_VALIDATORS = new Map<string, AttributeValidator>()

const registerAttributeValidator = (
  names: Iterable<string>,
  validator: AttributeValidator,
): void => {
  for (const name of names) ATTRIBUTE_VALIDATORS.set(name, validator)
}

registerAttributeValidator(
  ['xmlns'],
  (element, value) => element === 'svg' && value === SVG_NAMESPACE,
)
registerAttributeValidator(['id'], (_element, value) => SAFE_ID_PATTERN.test(value))
registerAttributeValidator(
  ['href'],
  (element, value) => element === 'use' && INTERNAL_HREF_PATTERN.test(value),
)
registerAttributeValidator(
  ['role'],
  oneOf(['img', 'presentation', 'graphics-document', 'graphics-symbol']),
)
registerAttributeValidator(
  ['aria-label'],
  (_element, value) => Boolean(value.trim()) && value.length <= 500,
)
registerAttributeValidator(['aria-labelledby', 'aria-describedby'], (_element, value) =>
  isValidIdList(value),
)
registerAttributeValidator(['focusable'], oneOf(['true', 'false', 'auto']))
registerAttributeValidator(['xml:space'], oneOf(['default', 'preserve']))
registerAttributeValidator(['viewBox'], (_element, value) => isValidViewBox(value))
registerAttributeValidator(['preserveAspectRatio'], (_element, value) =>
  isValidPreserveAspectRatio(value),
)
registerAttributeValidator(LENGTH_ATTRIBUTES, (_element, value) => parseLength(value))
registerAttributeValidator(NON_NEGATIVE_LENGTH_ATTRIBUTES, (_element, value) =>
  parseLength(value, true),
)
registerAttributeValidator(['pathLength'], (_element, value) => isValidPositiveNumber(value))
registerAttributeValidator(['d'], (_element, value) => isValidPathData(value))
registerAttributeValidator(['points'], (_element, value) => isValidPoints(value))
registerAttributeValidator(['dx', 'dy'], (_element, value) => isValidLengthList(value))
registerAttributeValidator(
  ['stroke-dasharray'],
  (_element, value) => value.trim() === 'none' || isValidLengthList(value, true),
)
registerAttributeValidator(['rotate'], (_element, value) => parseNumberList(value) !== null)
registerAttributeValidator(PAINT_ATTRIBUTES, (_element, value) => isValidPaint(value))
registerAttributeValidator(INTERNAL_URL_ATTRIBUTES, (_element, value) => isValidInternalUrl(value))
registerAttributeValidator(OPACITY_ATTRIBUTES, (_element, value) => isValidOpacity(value))
registerAttributeValidator(['fill-rule', 'clip-rule'], oneOf(['nonzero', 'evenodd', 'inherit']))
registerAttributeValidator(['stroke-linecap'], oneOf(['butt', 'round', 'square', 'inherit']))
registerAttributeValidator(
  ['stroke-linejoin'],
  oneOf(['miter', 'miter-clip', 'round', 'bevel', 'arcs', 'inherit']),
)
registerAttributeValidator(['stroke-miterlimit'], (_element, value) => isValidMiterLimit(value))
registerAttributeValidator(TRANSFORM_ATTRIBUTES, (_element, value) => isValidTransform(value))
registerAttributeValidator(['vector-effect'], oneOf(['none', 'non-scaling-stroke']))
registerAttributeValidator(['font-family'], (_element, value) => isValidFontFamily(value))
registerAttributeValidator(['font-style'], oneOf(['normal', 'italic', 'oblique', 'inherit']))
registerAttributeValidator(['font-weight'], (_element, value) =>
  /^(?:normal|bold|bolder|lighter|[1-9]00|inherit)$/.test(value),
)
registerAttributeValidator(['text-anchor'], oneOf(['start', 'middle', 'end', 'inherit']))
registerAttributeValidator(
  ['text-decoration'],
  oneOf(['none', 'underline', 'overline', 'line-through', 'inherit']),
)
registerAttributeValidator(
  ['dominant-baseline', 'alignment-baseline'],
  oneOf([
    'auto',
    'baseline',
    'before-edge',
    'text-before-edge',
    'middle',
    'central',
    'after-edge',
    'text-after-edge',
    'ideographic',
    'alphabetic',
    'hanging',
    'mathematical',
    'inherit',
  ]),
)
registerAttributeValidator(['lengthAdjust'], oneOf(['spacing', 'spacingAndGlyphs']))
registerAttributeValidator(
  ['gradientUnits', 'clipPathUnits', 'maskUnits', 'maskContentUnits'],
  oneOf(['userSpaceOnUse', 'objectBoundingBox']),
)
registerAttributeValidator(['spreadMethod'], oneOf(['pad', 'reflect', 'repeat']))
registerAttributeValidator(['offset'], (_element, value) => isValidOpacity(value))
registerAttributeValidator(['markerUnits'], oneOf(['strokeWidth', 'userSpaceOnUse']))
registerAttributeValidator(['orient'], (_element, value) => isValidOrientation(value))
registerAttributeValidator(['overflow'], oneOf(['visible', 'hidden']))

const validateAttribute = (element: string, attribute: SvgAttribute): void => {
  const { name, value } = attribute
  const validator = ATTRIBUTE_VALIDATORS.get(name) ?? reject('unsupported-attribute')
  if (name !== 'xmlns' && isExternalReference(value)) reject('external-reference')
  if (!validator(element, value)) reject('invalid-attribute')
}

const serializeOpeningTag = (tag: OpeningTag, addNamespace: boolean): string => {
  const attributes = tag.attributes.map(
    ({ name, value }) => ` ${name}="${escapeXmlAttribute(value)}"`,
  )
  if (addNamespace) attributes.unshift(` xmlns="${SVG_NAMESPACE}"`)

  return `<${tag.name}${attributes.join('')}${tag.selfClosing ? '/>' : '>'}`
}

interface SvgParseState {
  input: string
  cursor: number
  serialized: string
  stack: string[]
  titleParts: string[]
  rootSeen: boolean
  rootClosed: boolean
  declarationSeen: boolean
  elementCount: number
  attributeCount: number
}

const createParseState = (input: string): SvgParseState => ({
  input,
  cursor: 0,
  serialized: '',
  stack: [],
  titleParts: [],
  rootSeen: false,
  rootClosed: false,
  declarationSeen: false,
  elementCount: 0,
  attributeCount: 0,
})

const appendParsedText = (state: SvgParseState, rawText: string): void => {
  if (!rawText) return
  const text = decodeXmlEntities(rawText)
  const parent = state.stack.at(-1)

  if (!state.rootSeen || state.rootClosed || !parent) {
    if (text.trim()) reject('unparseable')
    return
  }

  if (!TEXT_ONLY_ELEMENTS.has(parent)) {
    if (text.trim()) reject('invalid-content')
    state.serialized += text
    return
  }

  state.serialized += escapeXmlText(text)
  if (state.stack[0] === 'svg' && state.stack[1] === 'title') state.titleParts.push(text)
}

const consumeComment = (state: SvgParseState, tagStart: number): boolean => {
  if (!state.input.startsWith('<!--', tagStart)) return false

  const commentEnd = state.input.indexOf('-->', tagStart + 4)
  if (commentEnd === -1 || state.input.slice(tagStart + 4, commentEnd).includes('--')) {
    reject('unparseable')
  }
  state.cursor = commentEnd + 3
  return true
}

const consumeDeclaration = (state: SvgParseState, tagStart: number): boolean => {
  if (!state.input.startsWith('<?', tagStart)) return false

  const declarationEnd = state.input.indexOf('?>', tagStart + 2)
  if (declarationEnd === -1) reject('unparseable')

  const declaration = state.input.slice(tagStart, declarationEnd + 2)
  if (state.rootSeen || state.declarationSeen || !XML_DECLARATION_PATTERN.test(declaration)) {
    reject('unparseable')
  }

  state.declarationSeen = true
  state.cursor = declarationEnd + 2
  return true
}

const consumeSpecialMarkup = (state: SvgParseState, tagStart: number): boolean => {
  if (consumeComment(state, tagStart) || consumeDeclaration(state, tagStart)) return true
  if (state.input.startsWith('<!', tagStart)) reject('unparseable')
  return false
}

const applyClosingTag = (state: SvgParseState, tag: ClosingTag): void => {
  const expected = state.stack.pop()
  if (!expected || expected !== tag.name) reject('unparseable')

  state.serialized += `</${tag.name}>`
  if (state.stack.length === 0) state.rootClosed = true
}

const validateRootPosition = (state: SvgParseState, tag: OpeningTag): void => {
  if (!state.rootSeen) {
    if (tag.name !== 'svg') reject('not-svg')
    state.rootSeen = true
    return
  }

  if (state.stack.length === 0) reject('unparseable')
}

const enforceComplexityLimits = (state: SvgParseState, tag: OpeningTag): void => {
  state.elementCount++
  state.attributeCount += tag.attributes.length
  const nextDepth = tag.selfClosing ? state.stack.length : state.stack.length + 1

  if (
    state.elementCount > MAX_ELEMENTS ||
    state.attributeCount > MAX_ATTRIBUTES ||
    nextDepth > MAX_DEPTH
  ) {
    reject('too-complex')
  }
}

const applyOpeningTag = (state: SvgParseState, tag: OpeningTag): void => {
  if (state.rootClosed) reject('unparseable')
  if (!ALLOWED_ELEMENTS.has(tag.name)) reject('unsupported-element')

  validateRootPosition(state, tag)
  enforceComplexityLimits(state, tag)
  for (const attribute of tag.attributes) validateAttribute(tag.name, attribute)

  const hasNamespace = tag.attributes.some(({ name }) => name === 'xmlns')
  state.serialized += serializeOpeningTag(tag, tag.name === 'svg' && !hasNamespace)

  if (tag.selfClosing && state.stack.length === 0) state.rootClosed = true
  if (!tag.selfClosing) state.stack.push(tag.name)
}

const parseSvgMarkup = (input: string): SvgData => {
  const state = createParseState(input)

  while (state.cursor < input.length) {
    const tagStart = input.indexOf('<', state.cursor)
    if (tagStart === -1) {
      appendParsedText(state, input.slice(state.cursor))
      state.cursor = input.length
      break
    }

    appendParsedText(state, input.slice(state.cursor, tagStart))
    if (consumeSpecialMarkup(state, tagStart)) continue

    const tag = parseTag(input, tagStart)
    state.cursor = tag.nextIndex
    if (tag.kind === 'closing') applyClosingTag(state, tag)
    else applyOpeningTag(state, tag)
  }

  if (!state.rootSeen) reject('not-svg')
  if (!state.rootClosed || state.stack.length > 0) reject('unparseable')

  const title = state.titleParts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 300)
  return title ? { markup: state.serialized, title } : { markup: state.serialized }
}

/**
 * Parses untrusted fence content into a canonical, inert SVG subset.
 * The serializer emits only registered elements and attributes; callers must
 * still render the result in an isolated image context rather than as live DOM.
 */
export const parseSvgData = (source: string): Result<SvgData, SvgRejection> => {
  if (source.length > MAX_SVG_SIZE) return err({ reason: 'oversize' })
  if (hasInvalidXmlCharacter(source)) return err({ reason: 'unparseable' })

  try {
    const input = source.trim()
    if (!input?.includes('<')) reject('not-svg')
    return ok(parseSvgMarkup(input))
  } catch (error) {
    if (error instanceof SvgValidationFailure) return err({ reason: error.reason })
    return err({ reason: 'unparseable' })
  }
}
