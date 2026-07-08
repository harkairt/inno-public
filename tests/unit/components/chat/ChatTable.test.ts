/**
 * Component tests for ChatTable — the rendered `rows`/`h-rows` code-block table.
 *
 * The Zod validation that gates whether a table is rendered at all lives
 * upstream in `lib/validation/table.ts` (parseRowsBlock → null on bad input) and
 * is exercised through MarkdownContent. ChatTable itself receives an
 * already-parsed `TableData` prop, so its own "fallback, not crash" contract is
 * the empty-state div it shows when there are no usable rows.
 *
 * Nuxt UI's UTable/UInput/UPagination aren't registered in the test app, so they
 * are stubbed. UTable is stubbed with a thin table that renders the raw cell
 * values, letting us assert the rows the user sees without pulling in the full
 * TanStack table engine.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import { ref, type Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import type { TableData } from '@/lib/validation/table'

// ChatTable imports `useI18n` directly from vue-i18n (not the Nuxt auto-import),
// so the global stub in tests/setup.ts doesn't apply — provide a leaf stub here.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))

const stubs = {
  UInput: {
    props: ['modelValue', 'placeholder'],
    template:
      '<input data-testid="table-filter" :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UTable: {
    props: ['data', 'columns'],
    template:
      '<table data-testid="u-table"><tbody><tr v-for="(row, i) in data" :key="i" data-testid="table-row"><td v-for="col in columns" :key="col.accessorKey">{{ row[col.accessorKey] }}</td></tr></tbody></table>',
  },
  UPagination: {
    props: ['page', 'total', 'itemsPerPage'],
    template: '<div data-testid="pagination" :data-total="total" />',
  },
  UButton: true,
  UCheckbox: true,
}

async function renderTable(tableData: TableData) {
  const { default: ChatTable } = (await import('~/components/chat/ChatTable.vue')) as {
    default: Component
  }
  return renderWithProviders(ChatTable, { props: { tableData }, global: { stubs } })
}

const validData: TableData = {
  columns: [
    { name: 'Name', type: 'string' },
    { name: 'Age', type: 'number' },
  ],
  rows: [
    { Name: 'Alice', Age: 30 },
    { Name: 'Bob', Age: 25 },
  ],
}

describe('ChatTable — valid data', () => {
  it('renders one row per data entry', async () => {
    await renderTable(validData)
    expect(screen.getAllByTestId('table-row')).toHaveLength(2)
  })

  it('renders the cell values the user sees', async () => {
    await renderTable(validData)
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('shows the global filter input when a column is filterable', async () => {
    // string + number columns are filterable per lib/table-types.ts
    await renderTable(validData)
    expect(screen.getByTestId('table-filter')).toBeTruthy()
  })

  it('hides the filter input when no column is filterable (boolean-only)', async () => {
    await renderTable({
      columns: [{ name: 'Active', type: 'boolean' }],
      rows: [{ Active: true }, { Active: false }],
    })
    expect(screen.queryByTestId('table-filter')).toBeNull()
  })

  it('paginates at PAGE_SIZE (20) and exposes pagination controls', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ Name: `User ${i}`, Age: i }))
    await renderTable({ columns: validData.columns, rows })
    expect(screen.getAllByTestId('table-row')).toHaveLength(20)
    expect(screen.getByTestId('pagination').getAttribute('data-total')).toBe('25')
  })
})

describe('ChatTable — fallback (not a crash)', () => {
  it('shows the no-data empty state instead of the table when there are no rows', async () => {
    await renderTable({ columns: validData.columns, rows: [] })
    // Empty-state div renders (i18n stub returns the key), UTable does not.
    expect(screen.getByText('chat.table.no-data')).toBeTruthy()
    expect(screen.queryByTestId('u-table')).toBeNull()
    expect(screen.queryByTestId('table-row')).toBeNull()
  })
})
