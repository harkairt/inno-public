/**
 * MessageInput component tests.
 * Tests input behavior, submit, and voice button visibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutateAsync = vi.fn().mockResolvedValue({})

vi.mock('~/composables/useChatMutations', () => ({
  useSendMessage: () => ({
    mutateAsync: mockMutateAsync,
    isPending: ref(false),
    isError: ref(false),
    error: ref(null),
  })
}))

vi.mock('~/composables/useTextFormatting', () => ({
  useTextFormatting: () => ({
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleStrikethrough: vi.fn(),
    toggleCode: vi.fn(),
    insertLink: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleNumberedList: vi.fn(),
  })
}))

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: () => ({
    user: { email: 'test@example.com', name: 'Test User' },
    isAuthenticated: true,
  })
}))

vi.mock('@/app/stores/chat', () => ({
  useChatStore: () => ({
    getDraft: vi.fn().mockReturnValue(''),
    saveDraft: vi.fn(),
    clearDraft: vi.fn(),
  })
}))

vi.mock('@/app/composables/useSignalRChat', () => ({
  useSignalRChat: () => ({
    sendTypingIndicator: vi.fn(),
    sendStoppedTypingIndicator: vi.fn(),
  })
}))

vi.mock('@/app/composables/useVoiceRecording', () => ({
  useVoiceRecording: () => ({
    isRecording: ref(false),
    isTranscribing: ref(false),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    setTranscribing: vi.fn(),
    error: ref(null),
  })
}))

vi.mock('@/lib/api/services/TranscriptionService', () => ({
  useTranscriptionService: () => ({
    isConfigured: () => false,
    transcribe: vi.fn(),
  })
}))

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

async function renderMessageInput(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const pinia = createPinia()
  setActivePinia(pinia)

  const { default: MessageInput } = await import('~/components/chat/MessageInput.vue')

  return render(MessageInput, {
    props: {
      sessionId: 'session-1',
      agentId: 1,
      ...props,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }], pinia],
      stubs: {
        UButton: {
          name: 'UButton',
          inheritAttrs: false,
          props: ['disabled', 'type', 'loading', 'icon', 'color', 'variant', 'size', 'label'],
          template: '<button :disabled="disabled" :type="type" v-bind="$attrs"><slot>{{ label }}</slot></button>',
        },
        UTextarea: {
          name: 'UTextarea',
          props: ['modelValue', 'placeholder', 'disabled', 'rows'],
          emits: ['update:modelValue', 'keydown'],
          template: '<textarea :placeholder="placeholder" :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keydown="$emit(\'keydown\', $event)" data-testid="message-input"></textarea>',
        },
        UAlert: { template: '<div />' },
        ChatFormattingToolbar: { template: '<div />' },
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageInput — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the message input textarea', async () => {
    await renderMessageInput()

    expect(screen.getByTestId('message-input')).toBeTruthy()
  })

  it('renders the send button', async () => {
    await renderMessageInput()

    expect(screen.getByRole('button', { name: 'chat.messageInput.send' })).toBeTruthy()
  })

  it('send button is disabled when input is empty', async () => {
    await renderMessageInput()

    const sendButton = screen.getByRole('button', { name: 'chat.messageInput.send' })
    expect(sendButton).toHaveProperty('disabled', true)
  })

  it('send button is enabled when input has text', async () => {
    await renderMessageInput()

    const textarea = screen.getByTestId('message-input')
    await fireEvent.update(textarea, 'Hello world')

    const sendButton = screen.getByRole('button', { name: 'chat.messageInput.send' })
    expect(sendButton).toHaveProperty('disabled', false)
  })
})

describe('MessageInput — submit behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls mutation on form submit with text', async () => {
    await renderMessageInput()

    const textarea = screen.getByTestId('message-input')
    await fireEvent.update(textarea, 'Test message')

    const form = screen.getByTestId('message-input').closest('form')!
    await fireEvent.submit(form)

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Test message',
        sessionId: 'session-1',
      })
    )
  })

  it('does not call mutation when input is empty', async () => {
    await renderMessageInput()

    const form = screen.getByTestId('message-input').closest('form')!
    await fireEvent.submit(form)

    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it('clears input after submit', async () => {
    await renderMessageInput()

    const textarea = screen.getByTestId('message-input') as HTMLTextAreaElement
    await fireEvent.update(textarea, 'Test message')
    expect(textarea.value).toBe('Test message')

    const form = textarea.closest('form')!
    await fireEvent.submit(form)

    expect(textarea.value).toBe('')
  })
})

describe('MessageInput — voice button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides voice button when disableVoice is true', async () => {
    await renderMessageInput({ disableVoice: true })

    const buttons = screen.queryAllByRole('button')
    const voiceButton = buttons.find(b => b.getAttribute('aria-label')?.includes('Recording'))
    expect(voiceButton).toBeUndefined()
  })

  it('hides voice button when transcription is not configured', async () => {
    // Default mock has isConfigured: () => false
    await renderMessageInput({ disableVoice: false })

    const buttons = screen.queryAllByRole('button')
    const voiceButton = buttons.find(b => b.getAttribute('aria-label')?.includes('Recording'))
    expect(voiceButton).toBeUndefined()
  })
})
