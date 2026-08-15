import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

import { useTrimmedWelcomeMessage } from '@/app/composables/useTrimmedWelcomeMessage'

const mockWelcomeData = ref<{ message: string } | undefined>(undefined)
const mockIsLoading = ref(false)

vi.mock('@/app/composables/useChatQueries', () => ({
  useWelcomeMessage: vi.fn(() => ({
    data: mockWelcomeData,
    isLoading: mockIsLoading,
  })),
}))

describe('useTrimmedWelcomeMessage', () => {
  it('returns undefined when no welcome data', () => {
    mockWelcomeData.value = undefined
    const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1)
    expect(trimmedWelcomeMessage.value).toBeUndefined()
  })

  it('returns undefined when message is empty', () => {
    mockWelcomeData.value = { message: '' }
    const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1)
    expect(trimmedWelcomeMessage.value).toBeUndefined()
  })

  it('trims surrounding double quotes', () => {
    mockWelcomeData.value = { message: '"Hello, welcome!"' }
    const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1)
    expect(trimmedWelcomeMessage.value).toBe('Hello, welcome!')
  })

  it('returns unquoted message as-is', () => {
    mockWelcomeData.value = { message: 'Hello, welcome!' }
    const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1)
    expect(trimmedWelcomeMessage.value).toBe('Hello, welcome!')
  })

  it('does not trim when only one quote is present', () => {
    mockWelcomeData.value = { message: '"Hello, welcome!' }
    const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1)
    expect(trimmedWelcomeMessage.value).toBe('"Hello, welcome!')
  })

  it('exposes isLoading from the underlying query', () => {
    mockIsLoading.value = true
    const { isLoading } = useTrimmedWelcomeMessage(1)
    expect(isLoading.value).toBe(true)
  })

  describe('showOnlyWhen guard', () => {
    it('returns undefined when showOnlyWhen is false', () => {
      mockWelcomeData.value = { message: '"Hello!"' }
      const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1, {
        showOnlyWhen: false,
      })
      expect(trimmedWelcomeMessage.value).toBeUndefined()
    })

    it('returns message when showOnlyWhen is true', () => {
      mockWelcomeData.value = { message: '"Hello!"' }
      const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1, {
        showOnlyWhen: true,
      })
      expect(trimmedWelcomeMessage.value).toBe('Hello!')
    })

    it('reacts to showOnlyWhen ref changes', () => {
      mockWelcomeData.value = { message: '"Hello!"' }
      const show = ref(true)
      const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1, {
        showOnlyWhen: show,
      })

      expect(trimmedWelcomeMessage.value).toBe('Hello!')
      show.value = false
      expect(trimmedWelcomeMessage.value).toBeUndefined()
    })

    it('returns message when showOnlyWhen is not provided', () => {
      mockWelcomeData.value = { message: '"Hello!"' }
      const { trimmedWelcomeMessage } = useTrimmedWelcomeMessage(1)
      expect(trimmedWelcomeMessage.value).toBe('Hello!')
    })
  })
})
