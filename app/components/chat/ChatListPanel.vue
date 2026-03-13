<template>
  <div class="flex flex-col h-full overflow-hidden" data-testid="chat-list-panel">
    <div class="border-b border-[hsl(var(--border)/0.5)] px-4 py-3">
      <h1 class="font-display text-lg font-semibold tracking-tight mb-2">
        {{ t('navigation.conversations') }}
      </h1>
      <UInput
        v-model="sessionSearchQuery"
        icon="i-heroicons-magnifying-glass"
        :placeholder="t('sidebar.searchSessions')"
        size="md"
        class="w-full"
        :ui="{ root: 'w-full' }"
        data-testid="session-search-input"
      />
    </div>

    <div v-if="isLoadingSessions" class="space-y-2 px-3">
      <USkeleton v-for="i in 3" :key="i" class="h-16" />
    </div>

    <UAlert v-else-if="sessionsError" color="error" variant="soft" class="mx-3">
      {{ sessionsError.message }}
    </UAlert>

    <UEmpty
      v-else-if="filteredSessions.length === 0"
      :description="t('sidebar.noSessionsFound')"
      class="py-8"
    />

    <div
      v-else
      ref="scrollContainer"
      class="flex-1 overflow-y-auto"
    >
      <div
        v-for="session in filteredSessions"
        :key="session.sessionId"
        class="group relative"
      >
        <NuxtLink
          :to="`/chats/${session.sessionId}`"
          class="sidebar-item block pr-10"
          :class="{ 'sidebar-item-active': session.sessionId === activeSessionId }"
          :data-testid="`session-item-${session.sessionId}`"
        >
          <div class="flex items-center gap-2">
            <SessionMembers
              :members="getOtherMembers(session.members)"
              :selectable-users="users || []"
              size="2xs"
              class="flex-shrink-0"
            />
            <h3 class="font-display text-sm font-medium tracking-tight line-clamp-1 flex-1 min-w-0">
              {{ getDisplayName(session) }}
            </h3>
          </div>

          <p class="flex items-center gap-1.5 text-xs text-muted tracking-wide mt-1">
            <span
              v-if="getUnreadCount(session.sessionId) > 0"
              class="unread-dot"
            />
            <span class="line-clamp-1">
              {{ formatRelativeDate(session.insertDate) }} · {{ getMemberNames(session.members) }}
            </span>
          </p>
        </NuxtLink>

        <div
          class="absolute top-3 right-2 transition-opacity"
          :class="isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
        >
          <SessionItemMenu
            :session-id="session.sessionId"
            :session-name="session.sessionName"
            :agent-id="session.agentId"
            :is-primary-session="isPrimarySessionCheck(session)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useScroll } from '@vueuse/core'
import { useChatListData } from '~/composables/useChatListData'
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import SessionItemMenu from '~/components/chat/SessionItemMenu.vue'
import SessionMembers from '~/components/chat/SessionMembers.vue'

const { t } = useI18n()
const route = useRoute()
const { isMobile } = useNavigationVisibility()

const {
  users,
  filteredSessions,
  isLoadingSessions,
  sessionsError,
  sessionSearchQuery,
  getUnreadCount,
  getOtherMembers,
  getMemberNames,
  getDisplayName,
  isPrimarySessionCheck,
  formatRelativeDate,
} = useChatListData()

const activeSessionId = computed(() => route.params.sessionId as string)

// Scroll position persistence
const scrollContainer = ref<HTMLElement>()

onMounted(() => {
  if (scrollContainer.value) {
    const savedPosition = sessionStorage.getItem('chat-sessions-scroll-position')
    if (savedPosition) {
      scrollContainer.value.scrollTop = parseInt(savedPosition, 10)
    }
  }
})

const { y: scrollY } = useScroll(scrollContainer)
watch(scrollY, (newY) => {
  sessionStorage.setItem('chat-sessions-scroll-position', newY.toString())
})
</script>
