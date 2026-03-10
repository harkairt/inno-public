<template>
  <div class="flex flex-col h-full">
    <!-- Mobile: full-page session list -->
    <ChatListPanel v-if="isMobile" />

    <!-- Desktop: empty state / welcome content (session list is in parent wrapper) -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="max-w-4xl w-full mx-auto px-4 pt-6 sm:pt-24 pb-8 space-y-8">

        <!-- Virtual Agents Section -->
        <section v-if="virtualAgents.length > 0" class="space-y-4">
          <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {{ t('emptyPage.startConversation') }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AgentTile
              v-for="(agent, index) in virtualAgents"
              :key="agent.id"
              :agent="agent"
              :style="{ animationDelay: `${index * 100}ms` }"
              class="animate-fade-in-up"
              @click="navigateTo(`/chats/new/${agent.id}`)"
            />
          </div>
        </section>

        <!-- Unread Chats Section -->
        <section v-if="unreadChats.length > 0" class="space-y-4">
          <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {{ t('emptyPage.unreadMessages') }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <UnreadChatCard
              v-for="(chat, index) in unreadChats"
              :key="chat.sessionId"
              :session="chat"
              :selectable-users="users ?? []"
              :style="{ animationDelay: `${(virtualAgents.length + index) * 100}ms` }"
              class="animate-fade-in-up"
              @click="navigateTo(`/chats/${chat.sessionId}`)"
            />
          </div>
        </section>

        <!-- Empty Fallback -->
        <div
          v-if="virtualAgents.length === 0 && unreadChats.length === 0 && !isLoading"
          class="flex-1 flex items-center justify-center min-h-[400px]"
        >
          <div class="text-center">
            <UIcon
              name="i-heroicons-chat-bubble-left-right"
              class="w-32 h-32 text-muted-foreground/20"
            />
            <p class="mt-4 text-muted-foreground">
              {{ t('chat.selectChatInstruction') }}
            </p>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="space-y-8">
          <div class="space-y-4">
            <USkeleton class="h-4 w-40" />
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <USkeleton v-for="i in 3" :key="i" class="h-24 rounded-lg" />
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import { useSelectableUsers } from '~/composables/useUsers'
import { useChatSessions, useUnreadMessageCounts } from '~/composables/useChatQueries'
import ChatListPanel from '~/components/chat/ChatListPanel.vue'
import AgentTile from '~/components/chat/AgentTile.vue'
import UnreadChatCard from '~/components/chat/UnreadChatCard.vue'

const { t } = useI18n()
const { isMobile } = useNavigationVisibility()

definePageMeta({
  title: 'Chat History',
  description: 'View your previous chat conversations',
})

useSeoMeta({
  title: 'Chat History',
  description: 'View and manage your previous conversations',
})

// Data fetching (only used for desktop empty state)
const { data: users, isLoading: usersLoading } = useSelectableUsers()
const { data: sessions, isLoading: sessionsLoading } = useChatSessions()
const { data: unreadCounts, isLoading: unreadLoading } = useUnreadMessageCounts()

const isLoading = computed(() => usersLoading.value || sessionsLoading.value || unreadLoading.value)

const virtualAgents = computed(() =>
  (users.value ?? [])
    .filter(user => user.isVirtual)
    .slice(0, 3),
)

const unreadChats = computed(() => {
  if (!sessions.value || !unreadCounts.value) return []

  return sessions.value
    .map(session => {
      const unread = unreadCounts.value?.find(u => u.sessionId === session.sessionId)
      return {
        ...session,
        unreadCount: unread?.unreadMessageCount ?? 0,
      }
    })
    .filter(session => session.unreadCount > 0)
    .sort((a, b) => new Date(b.insertDate).getTime() - new Date(a.insertDate).getTime())
})
</script>

<style scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out forwards;
  opacity: 0;
}
</style>
