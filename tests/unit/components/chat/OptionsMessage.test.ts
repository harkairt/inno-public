/**
 * OptionsMessage component tests.
 * Covers render (question text + option items) and the submit emit contract for
 * single-select and multi-select payloads. MarkdownContent is mocked (it pulls
 * in the markdown/shiki pipeline).
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import type { OptionsMessagePayload } from '@/types/api/schemas'
import OptionsMessage from '~/components/chat/OptionsMessage.vue'

// vi.mock is hoisted above imports by Vitest, so the component import can sit
// with the other imports and still receive the mocked MarkdownContent.
vi.mock('@/app/components/chat/MarkdownContent.vue', () => ({
  default: {
    name: 'MarkdownContent',
    props: ['content'],
    template: '<div data-testid="markdown-content">{{ content }}</div>',
  },
}))

const stubs = {
  UButton: {
    name: 'UButton',
    inheritAttrs: false,
    props: ['disabled'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\', $event)" data-testid="submit"><slot /></button>',
  },
  UIcon: { name: 'UIcon', props: ['name'], template: '<i :data-name="name" />' },
  USelect: { name: 'USelect', props: ['modelValue', 'items'], template: '<div />' },
  UInput: { name: 'UInput', props: ['modelValue'], template: '<input />' },
}

function makePayload(overrides: Partial<OptionsMessagePayload> = {}): OptionsMessagePayload {
  return {
    Text: 'Choose an option',
    MultiSelectEnabled: false,
    IsPlainTextEnabled: false,
    UIControlType: 0,
    Items: [
      { Key: 'k1', Value: 'Option A' },
      { Key: 'k2', Value: 'Option B' },
      { Key: 'k3', Value: 'Option C' },
    ],
    ...overrides,
  }
}

function renderOptions(props: Record<string, unknown>) {
  return renderWithProviders(OptionsMessage as Component, {
    props: { isActive: true, ...props },
    global: { stubs },
  })
}

describe('OptionsMessage — rendering', () => {
  it('renders the question text via MarkdownContent', () => {
    renderOptions({ payload: makePayload({ Text: 'Pick one please' }) })
    expect(screen.getByTestId('markdown-content').textContent).toContain('Pick one please')
  })

  it('renders each option value', () => {
    renderOptions({ payload: makePayload() })
    expect(screen.getByText('Option A')).toBeTruthy()
    expect(screen.getByText('Option B')).toBeTruthy()
    expect(screen.getByText('Option C')).toBeTruthy()
  })

  it('does not render the submit button when inactive', () => {
    renderOptions({ payload: makePayload(), isActive: false })
    expect(screen.queryByTestId('submit')).toBeNull()
  })
})

describe('OptionsMessage — single-select submit', () => {
  it('emits submit with the chosen value', async () => {
    const { emitted } = renderOptions({ payload: makePayload() })

    await fireEvent.click(screen.getByText('Option B'))
    await fireEvent.click(screen.getByTestId('submit'))

    expect(emitted().submit).toBeTruthy()
    expect(emitted().submit[0]).toEqual(['Option B'])
  })

  it('does not emit before a selection is made (button disabled)', () => {
    renderOptions({ payload: makePayload() })
    expect(screen.getByTestId('submit')).toHaveProperty('disabled', true)
  })
})

describe('OptionsMessage — multi-select submit', () => {
  it('emits submit with comma-joined selected values', async () => {
    const { emitted } = renderOptions({ payload: makePayload({ MultiSelectEnabled: true }) })

    await fireEvent.click(screen.getByText('Option A'))
    await fireEvent.click(screen.getByText('Option C'))
    await fireEvent.click(screen.getByTestId('submit'))

    expect(emitted().submit[0]).toEqual(['Option A, Option C'])
  })
})
