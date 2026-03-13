<template>
  <UPopover>
    <!-- Trigger Button -->
    <template #default>
      <UButton
        icon="i-heroicons-user-plus-20-solid"
        variant="ghost"
        size="sm"
        aria-label="Manage session members"
      />
    </template>

    <!-- Popover Content -->
    <template #content>
      <div class="w-[400px] max-w-[90vw]">
        <!-- Search Input -->
        <div class="p-3 border-b border-border">
          <UInput
            v-model="searchQuery"
            :placeholder="t('chat.manageUsers.searchPlaceholder')"
            icon="i-heroicons-magnifying-glass-20-solid"
            autocomplete="off"
            size="md"
            class="w-full"
            :ui="{ root: 'w-full' }"
          />
        </div>

        <!-- User List -->
        <div class="max-h-[60vh] md:max-h-[400px] overflow-y-auto">
          <!-- Loading State -->
          <div v-if="isLoading" class="p-6 space-y-3">
            <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
          </div>

          <!-- Empty State (No Users) -->
          <div v-else-if="mutuallyVisibleUsers?.length === 0" class="p-6">
            <UEmpty
              :title="t('chat.manageUsers.noUsers')"
              :description="t('chat.manageUsers.noUsersDescription')"
              icon="i-heroicons-user-group-20-solid"
            />
          </div>

          <!-- Empty State (No Search Results) -->
          <div v-else-if="filteredUsers.length === 0" class="p-6">
            <UEmpty
              :title="t('chat.manageUsers.noUsersFound')"
              :description="t('chat.manageUsers.tryDifferentSearch')"
              icon="i-heroicons-magnifying-glass-20-solid"
            />
          </div>

          <!-- User List Items -->
          <div v-else>
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="flex items-center gap-3 px-3 py-2 hover:bg-elevated/50 transition-colors"
            >
              <!-- Checkbox (disabled during any mutation) -->
              <UCheckbox
                :model-value="isUserInSession(user)"
                :disabled="isAnyMutationPending"
                @update:model-value="handleUserToggle(user, isUserInSession(user))"
              />

              <!-- User Avatar -->
              <UserAvatar
                :image="user.image"
                :dark-image="user.darkImage"
                :alt="user.name || user.email"
                size="sm"
              >
                {{ getInitials(user.name || user.email) }}
              </UserAvatar>

              <!-- User Info -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">
                  {{ user.name || user.email }}
                </p>
                <p
                  v-if="user.email && user.email !== user.name"
                  class="text-xs text-muted-foreground truncate"
                >
                  {{ user.email }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import type { UserDTO } from '@/types/api/schemas'
import { getInitials } from '@/app/utils/user'
import { useMutuallyVisibleUsers } from '@/app/composables/useMutuallyVisibleUsers'

const { t } = useI18n()

const props = defineProps<{
  sessionId: string
  agentId: number
  members: string[]
}>()

// Local state
const searchQuery = ref('')
const pendingUserEmail = ref<string | null>(null)

// Queries
const { data: selectableUsers, isLoading } = useSelectableUsers()

// Filter to only mutually visible users
const { mutuallyVisibleUsers } = useMutuallyVisibleUsers(selectableUsers)

// Mutations
const addUserMutation = useAddUserToSession()
const removeUserMutation = useRemoveUserFromSession()

// Toast for error notifications
const toast = useToast()

// Computed: Check if ANY mutation is currently pending
// This disables ALL checkboxes to prevent concurrent operations
const isAnyMutationPending = computed(() =>
  addUserMutation.isPending.value ?? removeUserMutation.isPending.value
)

// Helper: Check if a user is currently in the session
const isUserInSession = (user: UserDTO): boolean => {
  return props.members.includes(user.email)
}

// Computed: Filter and sort users
const filteredUsers = computed(() => {
  if (!mutuallyVisibleUsers.value) return []

  const query = searchQuery.value.toLowerCase().trim()

  // Filter by search query
  const filtered = mutuallyVisibleUsers.value.filter(user => {
    if (!query) return true
    const name = (user.name ?? '').toLowerCase()
    const email = user.email.toLowerCase()
    return name.includes(query) || email.includes(query)
  })

  // Sort alphabetically by name (or email if no name)
  // Members appear checked in their alphabetical position
  return filtered.sort((a, b) => {
    const nameA = (a.name || a.email).toLowerCase()
    const nameB = (b.name || b.email).toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

// Handler: Toggle user membership in session
const handleUserToggle = async (user: UserDTO, isCurrentlyChecked: boolean) => {
  // Safety check: prevent action if any mutation is pending
  if (isAnyMutationPending.value) return

  // Track which user's operation is in progress
  pendingUserEmail.value = user.email

  try {
    if (isCurrentlyChecked) {
      // User is currently in session → remove them
      await removeUserMutation.mutateAsync({
        sessionId: props.sessionId,
        userCode: user.email,
        agentId: props.agentId
      })
    } else {
      // User is not in session → add them
      await addUserMutation.mutateAsync({
        sessionId: props.sessionId,
        userCode: user.email,
        agentId: props.agentId
      })
    }
    // On success: TanStack Query auto-invalidates the session query
    // UI updates automatically when the session refetches
  } catch (error: unknown) {
    // Show error toast notification
    toast.add({
      title: t('common.error'),
      description: error instanceof Error ? error.message : t('errors.failedToUpdate'),
      color: 'error',
    })
  } finally {
    // Clear pending state (re-enables all checkboxes)
    pendingUserEmail.value = null
  }
}
</script>