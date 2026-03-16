<template>
  <div class="flex flex-col h-full overflow-hidden" data-testid="users-page">
    <div class="border-b border-[hsl(var(--border)/0.5)] px-4 py-3">
      <h1 class="font-display text-lg font-semibold tracking-tight mb-2">
        {{ t('navigation.users') }}
      </h1>
      <UInput
        v-model="userSearchQuery"
        icon="i-heroicons-magnifying-glass"
        :placeholder="t('sidebar.searchUsers')"
        size="sm"
        class="w-full"
        :ui="{ root: 'w-full' }"
        data-testid="user-search-input"
      />
    </div>

    <div v-if="isLoadingUsers" class="space-y-2 p-4">
      <USkeleton v-for="i in 5" :key="i" class="h-14" />
    </div>

    <UAlert v-else-if="usersError" color="error" variant="soft" class="m-4">
      {{ usersError.message }}
    </UAlert>

    <UEmpty
      v-else-if="filteredUsers.length === 0"
      :description="userSearchQuery ? t('sidebar.noUsersFound') : t('sidebar.noUsersFound')"
      class="py-12"
    />

    <div v-else class="flex-1 overflow-y-auto">
      <button
        v-for="user in filteredUsers"
        :key="user.id"
        class="sidebar-item w-full text-left flex items-center gap-3"
        :data-testid="`user-item-${user.id}`"
        @click="onUserClick(user.id)"
      >
        <UserAvatar
          :image="user.image"
          :dark-image="user.darkImage"
          :alt="user.name"
          size="sm"
          class="flex-shrink-0"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium truncate">{{ user.name }}</p>
          <p class="text-xs text-[hsl(var(--muted-foreground))] truncate">
            {{ user.isVirtual ? t('users.aiAgent') : user.email }}
          </p>
        </div>
        <UIcon
          v-if="user.isVirtual"
          name="i-heroicons-sparkles"
          class="size-4 text-[hsl(var(--primary)/0.6)] flex-shrink-0"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatListData } from '~/composables/useChatListData'
import UserAvatar from '~/components/UserAvatar.vue'

const { t } = useI18n()
const router = useRouter()

const {
  filteredUsers,
  isLoadingUsers,
  usersError,
  userSearchQuery,
  handleUserClick,
} = useChatListData()

function onUserClick(userId: number) {
  const target = handleUserClick(userId)
  if (target) {
    router.push(target)
  }
}
</script>
