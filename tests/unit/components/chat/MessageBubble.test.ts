import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/tests/utils/render'
import { makeMessage } from '@/tests/utils/factories'
import { AIAnswerType } from '@/types/enums'

vi.mock('@/app/composables/useMessagePresentation', () => ({
  useMessagePresentation: () => ({
    ownMessageStyle: computed(() => ({})),
    partnerMessageStyle: computed(() => ({})),
    isUserMessage: () => false,
  }),
}))

describe('MessageBubble', () => {
  it('uses the full available width for Mermaid content', async () => {
    const { default: MessageBubble } = await import('~/components/chat/MessageBubble.vue')
    const { container } = renderWithProviders(MessageBubble, {
      props: { message: makeMessage({ messageText: '```mermaid\ngantt\n```' }) },
      global: { stubs: { MarkdownContent: true } },
    })

    expect(container.querySelector('.message-bubble')?.classList.contains('w-full')).toBe(true)
  })

  it('keeps file-message bubbles sized to their content', async () => {
    const { default: MessageBubble } = await import('~/components/chat/MessageBubble.vue')
    const { container } = renderWithProviders(MessageBubble, {
      props: { message: makeMessage({ messageType: AIAnswerType.File }) },
      global: { stubs: { FileMessage: true } },
    })

    expect(container.querySelector('.message-bubble')?.classList.contains('w-full')).toBe(false)
  })
})
