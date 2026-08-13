/**
 * Tests the table-block parsers used by MarkdownContent to render data tables.
 * Covers valid shapes, malformed JSON, schema rejection, size/row/column limits,
 * and column-type inference.
 */
import { describe, it, expect } from 'vitest'
import {
  columnTypeSchema,
  parseRowsBlock,
  parsePivotBlock,
  parseHRowsBlock,
  pivotDataToTableData,
  type PivotData,
} from '@/lib/validation/table'

describe('columnTypeSchema', () => {
  it('accepts the four known column types', () => {
    for (const t of ['number', 'string', 'date', 'boolean']) {
      expect(columnTypeSchema.safeParse(t).success).toBe(true)
    }
  })

  it('rejects unknown types', () => {
    expect(columnTypeSchema.safeParse('object').success).toBe(false)
  })
})

describe('parseRowsBlock', () => {
  it('parses rows and infers column types', () => {
    const json = JSON.stringify([
      { n: 1, s: 'a', b: true, d: '2024-01-02' },
      { n: 2, s: 'b', b: false, d: '2024-03-04' },
    ])
    const result = parseRowsBlock(json)
    expect(result).not.toBeNull()
    const byName = Object.fromEntries(result!.columns.map((c) => [c.name, c.type]))
    expect(byName).toEqual({ n: 'number', s: 'string', b: 'boolean', d: 'date' })
    expect(result!.rows).toHaveLength(2)
  })

  it('fills missing keys across rows with null', () => {
    const json = JSON.stringify([{ a: 1 }, { b: 2 }])
    const result = parseRowsBlock(json)
    expect(result!.rows[0]).toEqual({ a: 1, b: null })
    expect(result!.rows[1]).toEqual({ a: null, b: 2 })
  })

  it('returns null for malformed JSON', () => {
    expect(parseRowsBlock('{not json')).toBeNull()
  })

  it('returns null for a non-array payload', () => {
    expect(parseRowsBlock(JSON.stringify({ a: 1 }))).toBeNull()
  })

  it('returns null for an empty array (min 1 row)', () => {
    expect(parseRowsBlock('[]')).toBeNull()
  })

  it('returns null when the JSON exceeds the size cap', () => {
    const huge = 'x'.repeat(50_001)
    expect(parseRowsBlock(huge)).toBeNull()
  })

  it('preserves source key order even when keys are integer-like', () => {
    const json =
      '[{"terulet":"Pest","2018":8778,"2019":9492,"mertekegyseg":"db"},' +
      '{"terulet":"Fejér","2018":1374,"2019":1405,"mertekegyseg":"db"}]'
    const result = parseRowsBlock(json)
    expect(result!.columns.map((c) => c.name)).toEqual(['terulet', '2018', '2019', 'mertekegyseg'])
  })

  it('returns null when there are too many columns', () => {
    const row: Record<string, number> = {}
    for (let i = 0; i < 51; i++) row[`c${i}`] = i
    expect(parseRowsBlock(JSON.stringify([row]))).toBeNull()
  })
})

describe('parsePivotBlock', () => {
  it('returns data and source key order', () => {
    const data = [{ a: 1 }, { a: 2 }]
    const result = parsePivotBlock(JSON.stringify(data))
    expect(result).not.toBeNull()
    expect(result!.data).toEqual(data)
    expect(result!.sourceKeyOrder).toEqual(['a'])
  })

  it('returns null for invalid input', () => {
    expect(parsePivotBlock('nope')).toBeNull()
  })
})

describe('pivotDataToTableData', () => {
  it('derives columns + normalized rows from pivot rows', () => {
    const pivot: PivotData = [{ a: 1, b: 'x' }, { a: 2 }]
    const table = pivotDataToTableData(pivot)
    expect(table.columns.map((c) => c.name)).toEqual(['a', 'b'])
    expect(table.rows[1]).toEqual({ a: 2, b: null })
  })

  it('uses sourceKeyOrder when provided', () => {
    const pivot: PivotData = [{ a: 1, b: 'x' }]
    const table = pivotDataToTableData(pivot, ['b', 'a'])
    expect(table.columns.map((c) => c.name)).toEqual(['b', 'a'])
  })
})

describe('parseHRowsBlock', () => {
  it('parses [meta, ...rows] tuple form and maps by column name', () => {
    const json = JSON.stringify([
      [
        { name: 'a', type: 'number' },
        { name: 'b', type: 'string' },
      ],
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
    ])
    const result = parseHRowsBlock(json)
    expect(result).not.toBeNull()
    expect(result!.columns).toEqual([
      { name: 'a', type: 'number' },
      { name: 'b', type: 'string' },
    ])
    expect(result!.rows).toEqual([
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
    ])
  })

  it('returns null when there are no data rows (meta only)', () => {
    const json = JSON.stringify([[{ name: 'a', type: 'number' }]])
    expect(parseHRowsBlock(json)).toBeNull()
  })

  it('returns null for an invalid meta column type', () => {
    const json = JSON.stringify([[{ name: 'a', type: 'bogus' }], { a: 1 }])
    expect(parseHRowsBlock(json)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseHRowsBlock('{')).toBeNull()
  })
})
