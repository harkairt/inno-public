<template>
  <!-- Dropdown Menu Trigger -->
  <UDropdownMenu :items="menuItems">
    <UButton
      icon="i-heroicons-ellipsis-vertical"
      variant="ghost"
      color="neutral"
      size="xs"
      aria-label="Session options"
      @click.prevent.stop
    />
  </UDropdownMenu>

  <!-- Edit Modal (separate from dropdown) -->
  <UModal v-model:open="isModalOpen" :title="t('chat.sessionMenu.editName')">
    <template #content>
      <form class="p-4" @submit.prevent="handleSave">
        <label class="block text-sm font-medium mb-2">
          {{ t('chat.sessionMenu.sessionNameLabel') }}
        </label>
        <UInput
          ref="inputRef"
          v-model="editedName"
          :placeholder="t('chat.sessionMenu.sessionNamePlaceholder')"
          :disabled="isPending"
          class="mb-4"
        />
        <div class="flex justify-end gap-2">
          <UButton
            type="button"
            variant="ghost"
            color="neutral"
            :disabled="isPending"
            @click="handleCancel"
          >
            {{ t('chat.sessionMenu.cancel') }}
          </UButton>
          <UButton
            type="submit"
            :loading="isPending"
            :disabled="!canSave"
          >
            {{ isPending ? t('chat.sessionMenu.saving') : t('chat.sessionMenu.save') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>

  <!-- Delete Confirmation Modal -->
  <UModal v-model:open="isDeleteModalOpen" :title="t('chat.sessionMenu.deleteConfirmTitle')">
    <template #content>
      <div class="p-4">
        <p class="text-sm text-(--ui-text-muted) mb-4">
          {{ t('chat.sessionMenu.deleteConfirmMessage') }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            type="button"
            variant="ghost"
            color="neutral"
            :disabled="isDeleting"
            @click="isDeleteModalOpen = false"
          >
            {{ t('chat.sessionMenu.cancel') }}
          </UButton>
          <UButton
            color="error"
            :loading="isDeleting"
            @click="handleDelete"
          >
            {{ isDeleting ? t('chat.sessionMenu.deleting') : t('chat.sessionMenu.delete') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useUpdateSessionName, useDeleteSession } from '~/composables/useChatMutations'

const { t } = useI18n()
const toast = useToast()

const props = defineProps<{
  sessionId: string
  sessionName: string
  agentId: number
}>()

// Local state
const isModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const editedName = ref(props.sessionName)
const inputRef = ref<{ inputRef?: { el?: HTMLInputElement } } | null>(null)

// Mutations
const { mutateAsync, isPending } = useUpdateSessionName()
const { mutateAsync: deleteSession, isPending: isDeleting } = useDeleteSession()

// Computed: Can save (name changed and not empty)
const canSave = computed(() => {
  const trimmed = editedName.value.trim()
  return trimmed.length > 0 && trimmed !== props.sessionName
})

// Menu items for dropdown
const menuItems = computed(() => [
  {
    label: t('chat.sessionMenu.editName'),
    icon: 'i-heroicons-pencil-square',
    onSelect: () => {
      editedName.value = props.sessionName
      isModalOpen.value = true
    }
  },
  {
    label: t('chat.sessionMenu.delete'),
    icon: 'i-heroicons-trash',
    color: 'error' as const,
    onSelect: () => {
      isDeleteModalOpen.value = true
    }
  }
])

// Handle save
async function handleSave() {
  if (!canSave.value) return

  try {
    await mutateAsync({
      sessionId: props.sessionId,
      sessionName: editedName.value.trim(),
      agentId: props.agentId
    })
    toast.add({
      title: t('chat.sessionMenu.editSuccess'),
      color: 'success'
    })
    isModalOpen.value = false
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t('chat.sessionMenu.editError')
    toast.add({
      title: t('common.error'),
      description: message,
      color: 'error'
    })
  }
}

// Handle cancel
function handleCancel() {
  editedName.value = props.sessionName
  isModalOpen.value = false
}

// Handle delete
async function handleDelete() {
  try {
    await deleteSession({
      sessionId: props.sessionId,
      agentId: props.agentId
    })
    toast.add({
      title: t('chat.sessionMenu.deleteSuccess'),
      color: 'success'
    })
    isDeleteModalOpen.value = false
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t('chat.sessionMenu.deleteError')
    toast.add({
      title: t('common.error'),
      description: message,
      color: 'error'
    })
  }
}

// Reset edited name when props change (e.g., external update)
watch(() => props.sessionName, (newName) => {
  if (!isModalOpen.value) {
    editedName.value = newName
  }
})

// Focus input when modal opens
watch(isModalOpen, (open) => {
  if (open) {
    nextTick(() => {
      inputRef.value?.inputRef?.el?.focus()
    })
  }
})
</script>
