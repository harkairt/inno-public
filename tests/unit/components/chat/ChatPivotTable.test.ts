/**
 * Component tests for ChatPivotTable — the "open pivot" button + modal that
 * lazy-loads the heavy `vue-pivottable` widget and offers a Table / Pivot tab.
 *
 * vue-pivottable (and its CSS side-effect import) can't run in happy-dom, so the
 * module is mocked with a stub component (mirrors
 * tests/unit/composables/usePivotTable.test.ts). Nuxt UI's UModal/UButton/UTabs/
 * UIcon and the nested ChatTable are stubbed so we can inspect the modal content
 * directly.
 *
 * The mobile branch is `window.innerWidth < 768` read directly in the component
 * (not useWindowSize), so it is driven by overriding window.innerWidth before
 * render — the computed reads it on first evaluation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/vue'
import { ref } from 'vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import type { PivotData } from '@/lib/validation/table'

// ChatPivotTable imports `useI18n` directly from vue-i18n (not the Nuxt
// auto-import), so the global stub in tests/setup.ts doesn't apply.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))

vi.mock('vue-pivottable', () => ({
  VuePivottableUi: {
    name: 'VuePivottableUi',
    props: ['data'],
    template: '<div data-testid="pivot-ui" />',
  },
}))
vi.mock('vue-pivottable/dist/vue-pivottable.css', () => ({}))

const stubs = {
  UButton: {
    props: ['icon'],
    template: '<button data-testid="open-btn" @click="$emit(\'click\')"><slot /></button>',
  },
  UModal: {
    props: ['open', 'fullscreen'],
    // Always render the content slot so we can inspect it regardless of open state.
    template:
      '<div data-testid="modal" :data-fullscreen="String(fullscreen)"><slot name="content" /></div>',
  },
  UTabs: {
    props: ['items', 'modelValue'],
    template: '<div data-testid="tabs" />',
  },
  UIcon: {
    props: ['name'],
    template: '<i :data-icon="name" />',
  },
  ChatTable: {
    props: ['tableData'],
    template: '<div data-testid="chat-table" :data-rows="tableData.rows.length" />',
  },
}

const originalInnerWidth = window.innerWidth

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
}

afterEach(() => {
  setInnerWidth(originalInnerWidth)
})

beforeEach(() => {
  setInnerWidth(1280)
})

const pivotData: PivotData = [
  { region: 'North', sales: 100 },
  { region: 'South', sales: 200 },
]

async function renderPivot(data: PivotData = pivotData) {
  const { default: ChatPivotTable } = (await import('~/components/chat/ChatPivotTable.vue')) as {
    default: Component
  }
  return renderWithProviders(ChatPivotTable, { props: { data }, global: { stubs } })
}

describe('ChatPivotTable — trigger + modal content', () => {
  it('renders the open-table button', async () => {
    await renderPivot()
    expect(screen.getByText('chat.pivot.openTable')).toBeTruthy()
  })

  it('renders the embedded ChatTable with data derived from the pivot rows', async () => {
    await renderPivot()
    const table = screen.getByTestId('chat-table')
    expect(table).toBeTruthy()
    expect(table.getAttribute('data-rows')).toBe('2')
  })

  it('shows the loader (not the pivot widget) before the pivot lib is loaded', async () => {
    const { container } = await renderPivot()
    expect(container.querySelector('[data-icon="i-lucide-loader-2"]')).not.toBeNull()
    expect(screen.queryByTestId('pivot-ui')).toBeNull()
  })
})

describe('ChatPivotTable — lazy pivot load', () => {
  it('loads and mounts the pivot widget after opening', async () => {
    await renderPivot()
    // The modal close button is also a UButton; target the labelled open button.
    await fireEvent.click(screen.getByText('chat.pivot.openTable'))
    // handleOpen awaits loadPivotTable() (async import) then assigns the component.
    expect(await screen.findByTestId('pivot-ui')).toBeTruthy()
  })
})

describe('ChatPivotTable — responsive (mobile branch)', () => {
  it('marks the modal fullscreen when window is narrow (< 768)', async () => {
    setInnerWidth(500)
    await renderPivot()
    expect(screen.getByTestId('modal').getAttribute('data-fullscreen')).toBe('true')
  })

  it('does not mark the modal fullscreen on a wide desktop window', async () => {
    setInnerWidth(1280)
    await renderPivot()
    expect(screen.getByTestId('modal').getAttribute('data-fullscreen')).toBe('false')
  })
})
