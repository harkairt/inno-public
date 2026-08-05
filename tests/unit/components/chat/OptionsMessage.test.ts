/**
 * OptionsMessage component tests.
 * Covers render (question text + markdown option labels) and the submit emit
 * contract for single-select and multi-select payloads. MarkdownContent is
 * mocked (it pulls in the markdown/shiki pipeline); the mock emits a real
 * <img>/<a> when the content looks like image/link markdown, so the row-click
 * guard can be exercised without the real renderer.
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
    template:
      '<div data-testid="markdown-content"><img v-if="content && content.includes(\'![\')" src="/x.png" alt="alt text"><a v-if="content && content.includes(\'](\') && !content.includes(\'![\')" href="/y">link</a>{{ content }}</div>',
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
  USelect: {
    name: 'USelect',
    props: ['modelValue', 'items'],
    template:
      '<div><span v-for="i in items" :key="i.value" data-testid="combobox-option" :data-value="i.value">{{ i.label }}</span></div>',
  },
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

function markdownTexts(): (string | undefined)[] {
  return screen.getAllByTestId('markdown-content').map((el) => el.textContent?.trim())
}

describe('OptionsMessage — rendering', () => {
  it('renders the question text via MarkdownContent', () => {
    renderOptions({ payload: makePayload({ Text: 'Pick one please' }) })
    expect(markdownTexts()).toContain('Pick one please')
  })

  it('renders each option value', () => {
    renderOptions({ payload: makePayload() })
    expect(screen.getByText('Option A')).toBeTruthy()
    expect(screen.getByText('Option B')).toBeTruthy()
    expect(screen.getByText('Option C')).toBeTruthy()
  })

  it('renders each single-select option value through MarkdownContent', () => {
    renderOptions({ payload: makePayload() })
    expect(markdownTexts()).toEqual(['Choose an option', 'Option A', 'Option B', 'Option C'])
  })

  it('renders each multi-select option value through MarkdownContent', () => {
    renderOptions({ payload: makePayload({ MultiSelectEnabled: true }) })
    expect(markdownTexts()).toEqual(['Choose an option', 'Option A', 'Option B', 'Option C'])
  })

  it('does not render the submit button when inactive', () => {
    renderOptions({ payload: makePayload(), isActive: false })
    expect(screen.queryByTestId('submit')).toBeNull()
  })
})

describe('OptionsMessage — markdown label interactions', () => {
  it('does not select the option when its image is clicked', async () => {
    const value = '![alt text](/x.png)'
    renderOptions({ payload: makePayload({ Items: [{ Key: 'k1', Value: value }] }) })

    await fireEvent.click(screen.getByAltText('alt text'))
    expect(screen.getByTestId('submit')).toHaveProperty('disabled', true)

    await fireEvent.click(screen.getByText(value))
    expect(screen.getByTestId('submit')).toHaveProperty('disabled', false)
  })

  it('does not select the option when its link is clicked', async () => {
    const value = '[link](/y)'
    renderOptions({ payload: makePayload({ Items: [{ Key: 'k1', Value: value }] }) })

    await fireEvent.click(screen.getByRole('link'))
    expect(screen.getByTestId('submit')).toHaveProperty('disabled', true)

    await fireEvent.click(screen.getByText(value))
    expect(screen.getByTestId('submit')).toHaveProperty('disabled', false)
  })

  it('does not toggle a multi-select option when its image is clicked', async () => {
    const value = '![alt text](/x.png)'
    renderOptions({
      payload: makePayload({ MultiSelectEnabled: true, Items: [{ Key: 'k1', Value: value }] }),
    })

    await fireEvent.click(screen.getByAltText('alt text'))
    expect(screen.getByTestId('submit')).toHaveProperty('disabled', true)

    await fireEvent.click(screen.getByText(value))
    expect(screen.getByTestId('submit')).toHaveProperty('disabled', false)
  })
})

describe('OptionsMessage — combobox', () => {
  it('flattens markdown labels to plain text while values stay raw markdown', () => {
    renderOptions({
      payload: makePayload({
        UIControlType: 1,
        Items: [
          { Key: 'k1', Value: '**Bold** option' },
          { Key: 'k2', Value: '![Alt text](/x.png)' },
        ],
      }),
    })

    const options = screen.getAllByTestId('combobox-option')
    expect(options.map((el) => el.textContent)).toEqual(['Bold option', 'Alt text'])
    expect(options.map((el) => el.getAttribute('data-value'))).toEqual([
      '**Bold** option',
      '![Alt text](/x.png)',
    ])
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
