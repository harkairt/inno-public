import { z } from 'zod'

const MAX_JSON_SIZE = 50_000
const MAX_ROWS = 500
const MAX_COLUMNS = 50

export const columnTypeSchema = z.enum(['number', 'string', 'date', 'boolean'])
export type ColumnType = z.infer<typeof columnTypeSchema>

export type CellValue = string | number | boolean | null

export interface ColumnMeta {
  name: string
  type: ColumnType
}

export interface TableData {
  columns: ColumnMeta[]
  rows: Record<string, CellValue>[]
}

const columnMetaSchema = z.object({
  name: z.string().min(1),
  type: columnTypeSchema,
})

const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const rowSchema = z.record(z.string(), cellValueSchema)

const rowsArraySchema = z.array(rowSchema).min(1).max(MAX_ROWS)

const hRowsSchema = z.tuple([z.array(columnMetaSchema).min(1).max(MAX_COLUMNS)]).rest(rowSchema)

const isNumeric = (v: unknown): boolean =>
  typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))

const isDateLike = (v: unknown): boolean => {
  if (typeof v !== 'string' || v.trim() === '') return false
  const ts = Date.parse(v)
  if (Number.isNaN(ts)) return false
  // Reject pure numbers that Date.parse accepts (e.g. "123")
  if (!Number.isNaN(Number(v))) return false
  return true
}

const inferColumnType = (values: unknown[]): ColumnType => {
  const nonNull = values.filter((v) => v != null && v !== '')
  if (nonNull.length === 0) return 'string'

  if (nonNull.every((v) => typeof v === 'boolean')) return 'boolean'
  if (nonNull.every(isNumeric)) return 'number'
  if (nonNull.every(isDateLike)) return 'date'
  return 'string'
}

export const parseRowsBlock = (json: string): TableData | null => {
  if (json.length > MAX_JSON_SIZE) return null

  try {
    const parsed: unknown = JSON.parse(json)
    const result = rowsArraySchema.safeParse(parsed)
    if (!result.success) return null

    const rows = result.data
    const keySet = new Set<string>()
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        keySet.add(key)
      }
    }

    const keys = [...keySet]
    if (keys.length > MAX_COLUMNS) return null

    const columns: ColumnMeta[] = keys.map((key) => ({
      name: key,
      type: inferColumnType(rows.map((r) => r[key])),
    }))

    const normalizedRows = rows.map((row) => {
      const normalized: Record<string, CellValue> = {}
      for (const key of keys) {
        normalized[key] = (row[key] ?? null) as CellValue
      }
      return normalized
    })

    return { columns, rows: normalizedRows }
  } catch {
    return null
  }
}

export type PivotData = Record<string, CellValue>[]

export const parsePivotBlock = (json: string): PivotData | null => {
  if (json.length > MAX_JSON_SIZE) return null

  try {
    const parsed: unknown = JSON.parse(json)
    const result = rowsArraySchema.safeParse(parsed)
    if (!result.success) return null
    return result.data as PivotData
  } catch {
    return null
  }
}

export const pivotDataToTableData = (data: PivotData): TableData => {
  const keySet = new Set<string>()
  for (const row of data) {
    for (const key of Object.keys(row)) {
      keySet.add(key)
    }
  }

  const keys = [...keySet]
  const columns: ColumnMeta[] = keys.map((key) => ({
    name: key,
    type: inferColumnType(data.map((r) => r[key])),
  }))

  const rows = data.map((row) => {
    const normalized: Record<string, CellValue> = {}
    for (const key of keys) {
      normalized[key] = (row[key] ?? null) as CellValue
    }
    return normalized
  })

  return { columns, rows }
}

export const parseHRowsBlock = (json: string): TableData | null => {
  if (json.length > MAX_JSON_SIZE) return null

  try {
    const parsed: unknown = JSON.parse(json)
    const result = hRowsSchema.safeParse(parsed)
    if (!result.success) return null

    const [meta, ...dataRows] = result.data
    if (dataRows.length === 0 || dataRows.length > MAX_ROWS) return null

    const columns: ColumnMeta[] = meta.map((m) => ({
      name: m.name,
      type: m.type,
    }))

    const rows = dataRows.map((row) => {
      const normalized: Record<string, CellValue> = {}
      const record = row as Record<string, CellValue>
      for (const col of columns) {
        normalized[col.name] = record[col.name] ?? null
      }
      return normalized
    })

    return { columns, rows }
  } catch {
    return null
  }
}
