import { toValue, type MaybeRefOrGetter } from 'vue'
import { useSendMessage } from '@/app/composables/useChatMutations'
import { revokeBlobUrls } from '@/app/composables/sendMessageOptimistic'
import { useChatStore } from '@/app/stores/chat'

export function useChatActions(sessionId: MaybeRefOrGetter<string>, scrollToBottom: () => void) {
  const chatStore = useChatStore()
  const retryMutation = useSendMessage()

  function handleRetryMessage(messageId: string) {
    const sid = toValue(sessionId)
    const entry = chatStore
      .getFailedEntries(sid)
      .find((e) => e.optimisticDisplay.messageID === messageId)
    if (!entry) return
    chatStore.removeFailedMessage(sid, messageId)
    void retryMutation
      .mutateAsync({ request: entry.request, attachments: entry.attachments })
      .finally(() => scrollToBottom())
  }

  function handleDiscardMessage(messageId: string) {
    const sid = toValue(sessionId)
    const entry = chatStore
      .getFailedEntries(sid)
      .find((e) => e.optimisticDisplay.messageID === messageId)
    if (entry) revokeBlobUrls(entry.optimisticDisplay)
    chatStore.removeFailedMessage(sid, messageId)
  }

  return { handleRetryMessage, handleDiscardMessage }
}
