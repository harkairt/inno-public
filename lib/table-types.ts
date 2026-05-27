import type { ColumnType, CellValue } from '@/lib/validation/table'

export interface TypeRule {
  align: 'left' | 'right' | 'center'
  sortable: boolean
  filterable: boolean
  format: (value: CellValue, locale: string) => string
}

const formatNumber = (value: CellValue, locale: string): string => {
  if (value == null || value === '') return ''
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return new Intl.NumberFormat(locale).format(num)
}

const formatDate = (value: CellValue, locale: string): string => {
  if (value == null || value === '') return ''
  const ts = Date.parse(String(value))
  if (Number.isNaN(ts)) return String(value)
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

const formatBoolean = (value: CellValue): string => {
  if (value == null) return ''
  return value ? '✓' : '—'
}

const formatString = (value: CellValue): string => {
  if (value == null) return ''
  return String(value)
}

export const typeRules: Record<ColumnType, TypeRule> = {
  number: {
    align: 'right',
    sortable: true,
    filterable: true,
    format: formatNumber,
  },
  string: {
    align: 'left',
    sortable: true,
    filterable: true,
    format: formatString,
  },
  date: {
    align: 'left',
    sortable: true,
    filterable: true,
    format: formatDate,
  },
  boolean: {
    align: 'center',
    sortable: false,
    filterable: false,
    format: formatBoolean,
  },
}
