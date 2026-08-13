import { computed, readonly, ref } from 'vue'

const STORAGE_PREFIX = 'innochat-focused-messages'
const STORAGE_VERSION = 1

interface StoredFocusedMessages {
  version: typeof STORAGE_VERSION
  messageIds: string[]
}

function parseStored(raw: string | null): string[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Partial<StoredFocusedMessages> | null
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.messageIds)) return []

    return [
      ...new Set(
        parsed.messageIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ]
  } catch {
    return []
  }
}

export function useMessageFocus(sessionId: string) {
  const focusedIds = ref<string[]>([])

  const storageKey = `${STORAGE_PREFIX}:${sessionId}`

  function load(): void {
    if (typeof window === 'undefined') {
      focusedIds.value = []
      return
    }

    try {
      focusedIds.value = parseStored(localStorage.getItem(storageKey))
    } catch {
      focusedIds.value = []
    }
  }

  function persist(): void {
    if (typeof window === 'undefined') return

    try {
      const value: StoredFocusedMessages = {
        version: STORAGE_VERSION,
        messageIds: focusedIds.value,
      }
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* ignored */
    }
  }

  function isFocused(messageId: string): boolean {
    return focusedIds.value.includes(messageId)
  }

  function toggleFocus(messageId: string): void {
    focusedIds.value = isFocused(messageId)
      ? focusedIds.value.filter((id) => id !== messageId)
      : [...focusedIds.value, messageId]
    persist()
  }

  function clearAll(): void {
    focusedIds.value = []
    persist()
  }

  const focusedCount = computed(() => focusedIds.value.length)
  const hasFocusedMessages = computed(() => focusedIds.value.length > 0)

  load()

  return {
    focusedIds: readonly(focusedIds),
    isFocused,
    toggleFocus,
    clearAll,
    focusedCount,
    hasFocusedMessages,
  }
}
