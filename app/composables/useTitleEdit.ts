import { ref, toValue, nextTick, type MaybeRefOrGetter, type Ref } from 'vue'
import { useUpdateSessionName } from '@/app/composables/useChatMutations'

export function useTitleEdit(
  sessionId: string,
  options: {
    canEdit: MaybeRefOrGetter<boolean>
    sessionName: MaybeRefOrGetter<string | undefined>
    agentId: MaybeRefOrGetter<number | undefined>
  },
) {
  const isEditingTitle = ref(false)
  const editedTitle = ref('')
  const titleInputRef = ref<HTMLInputElement | null>(null)

  const { mutate: updateSessionName, isPending: isUpdatingTitle } = useUpdateSessionName()

  function startEditingTitle() {
    if (!toValue(options.canEdit)) return
    const name = toValue(options.sessionName)
    editedTitle.value = name ?? ''
    isEditingTitle.value = true
    void nextTick(() => {
      const input = titleInputRef.value
      if (input) {
        input.focus()
        input.setSelectionRange(input.value.length, input.value.length)
      }
    })
  }

  function cancelEditingTitle() {
    isEditingTitle.value = false
    editedTitle.value = ''
  }

  function saveTitle() {
    if (!isEditingTitle.value || isUpdatingTitle.value) return

    const currentName = toValue(options.sessionName)
    const agent = toValue(options.agentId)

    if (!editedTitle.value.trim() || agent === undefined) {
      cancelEditingTitle()
      return
    }

    const trimmedTitle = editedTitle.value.trim()
    if (trimmedTitle === currentName) {
      cancelEditingTitle()
      return
    }

    updateSessionName(
      {
        sessionId,
        sessionName: trimmedTitle,
        agentId: agent,
      },
      {
        onSuccess: () => cancelEditingTitle(),
        onError: () => cancelEditingTitle(),
      },
    )
  }

  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveTitle()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditingTitle()
    }
  }

  return {
    isEditingTitle: isEditingTitle as Ref<boolean>,
    editedTitle,
    isUpdatingTitle,
    startEditingTitle,
    saveTitle,
    handleTitleKeydown,
    titleInputRef,
  }
}
