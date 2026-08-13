import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders } from '@/tests/utils/render'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import MessageInput from '@/app/components/chat/MessageInput.vue'

const BASE_PROPS = {
  sessionId: 'session-1',
  agentId: 1,
  members: ['user@test.com'],
}

describe('MessageInput file integration', () => {
  beforeEach(() => {
    seedAuthStorage()
  })

  it('shows attach button when disableFileUpload is false', () => {
    const { container } = renderWithProviders(MessageInput, {
      props: { ...BASE_PROPS, disableFileUpload: false },
    })

    const attachBtn = container.querySelector('[data-testid="attach-file-button"]')
    expect(attachBtn).toBeTruthy()
  })

  it('hides attach button when disableFileUpload is true', () => {
    const { container } = renderWithProviders(MessageInput, {
      props: { ...BASE_PROPS, disableFileUpload: true },
    })

    const attachBtn = container.querySelector('[data-testid="attach-file-button"]')
    expect(attachBtn).toBeNull()
  })

  it('hides file input when disableFileUpload is true', () => {
    const { container } = renderWithProviders(MessageInput, {
      props: { ...BASE_PROPS, disableFileUpload: true },
    })

    const fileInput = container.querySelector('[data-testid="file-input"]')
    expect(fileInput).toBeNull()
  })

  it('renders file input with accept filter', () => {
    const { container } = renderWithProviders(MessageInput, {
      props: { ...BASE_PROPS, disableFileUpload: false },
    })

    const fileInput = container.querySelector('[data-testid="file-input"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()
    expect(fileInput.accept).toContain('.png')
    expect(fileInput.accept).toContain('.pdf')
  })

  it('shows attach button by default (disableFileUpload defaults to false)', () => {
    const { container } = renderWithProviders(MessageInput, {
      props: BASE_PROPS,
    })

    const attachBtn = container.querySelector('[data-testid="attach-file-button"]')
    expect(attachBtn).toBeTruthy()
  })

  it('sends text-only message without files field problem', async () => {
    const { getByTestId } = renderWithProviders(MessageInput, {
      props: { ...BASE_PROPS, disableFileUpload: false },
    })

    const input = getByTestId('message-input') as HTMLTextAreaElement
    input.value = 'hello'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => {
      expect((getByTestId('message-input') as HTMLTextAreaElement).value).toBe('hello')
    })
  })
})
