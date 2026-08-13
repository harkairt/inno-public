import { ref, type CSSProperties } from 'vue'
import type { AISessionMessageDTO } from '@/types/api/schemas'
import { useAuthStore } from '@/app/stores/auth'
import { useClipboard } from '@vueuse/core'

export const ownMessageStyle: CSSProperties = {
  backgroundColor: 'var(--config-own-message-bg)',
  fontSize: 'var(--config-own-message-font-size)',
  fontStyle: 'var(--config-own-message-font-style)' as CSSProperties['fontStyle'],
  fontWeight: 'var(--config-own-message-font-weight)' as CSSProperties['fontWeight'],
  borderWidth: 'var(--config-message-border-width)',
  borderColor: 'var(--config-message-border-color)',
  borderStyle: 'var(--config-message-border-style)' as CSSProperties['borderStyle'],
  borderRadius: 'var(--config-message-border-radius)',
  color: 'var(--config-own-message-fg)',
}

export const partnerMessageStyle: CSSProperties = {
  backgroundColor: 'var(--config-partner-message-bg)',
  fontSize: 'var(--config-partner-message-font-size)',
  fontStyle: 'var(--config-partner-message-font-style)' as CSSProperties['fontStyle'],
  fontWeight: 'var(--config-partner-message-font-weight)' as CSSProperties['fontWeight'],
  borderWidth: 'var(--config-message-border-width)',
  borderColor: 'var(--config-message-border-color)',
  borderStyle: 'var(--config-message-border-style)' as CSSProperties['borderStyle'],
  borderRadius: 'var(--config-message-border-radius)',
  color: 'hsl(var(--foreground))',
}

export function useMessagePresentation() {
  const authStore = useAuthStore()
  const { copy } = useClipboard()
  const { locale } = useI18n()

  const copiedMessageId = ref<string | null>(null)

  function isUserMessage(message: AISessionMessageDTO): boolean {
    return message.senderUserCode === authStore.user?.email
  }

  function formatActionBarDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return ''

      const now = new Date()
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()

      if (isToday) {
        return date.toLocaleTimeString(locale.value, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      }

      return date.toLocaleDateString(locale.value, {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ''
    }
  }

  async function handleCopy(messageId: string, text: string | null | undefined): Promise<void> {
    if (!text) return
    await copy(text)
    copiedMessageId.value = messageId
    setTimeout(() => {
      if (copiedMessageId.value === messageId) {
        copiedMessageId.value = null
      }
    }, 1500)
  }

  return {
    ownMessageStyle,
    partnerMessageStyle,
    isUserMessage,
    formatActionBarDate,
    handleCopy,
    copiedMessageId,
  }
}
