<template>
  <div
    class="flex flex-col h-full overflow-hidden bg-white dark:bg-[var(--ui-bg)]"
    data-testid="chat-list-panel"
  >
    <div class="px-5 py-3">
      <div class="flex items-center justify-between mt-1 mb-4">
        <h1 class="font-display text-lg font-semibold tracking-tight">
          {{ t('navigation.conversations') }}
        </h1>
        <NuxtLink
          to="/users?focus=search"
          class="flex items-center justify-center size-[34px] rounded-[10px] text-[var(--ui-text-muted)] border border-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)] hover:border-[var(--ui-border-accented)] hover:text-[var(--ui-text)] transition-colors"
          :aria-label="t('navigation.newConversation')"
          data-testid="new-conversation-button"
        >
          <UIcon
            name="i-heroicons-plus"
            class="size-5"
          />
        </NuxtLink>
      </div>
      <SearchInput
        v-model="sessionSearchQuery"
        :placeholder="t('sidebar.searchSessions')"
        data-testid="session-search-input"
      />

      <div class="mt-3">
        <div class="flex items-center justify-between mb-2 min-h-[28px]">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ t('sidebar.filters.heading') }}
          </span>
          <Transition name="fade">
            <UButton
              v-if="hasActiveFilters"
              :label="t('sidebar.filters.clearAll')"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              trailing
              data-testid="filter-clear-all"
              @click="clearAll"
            />
          </Transition>
        </div>

        <UFieldGroup
          class="w-full"
          size="sm"
        >
          <UButton
            v-for="option in participantOptions"
            :key="option.value"
            :label="t(option.label)"
            :color="participantType === option.value ? 'primary' : 'neutral'"
            :variant="participantType === option.value ? 'subtle' : 'outline'"
            class="flex-1 justify-center"
            :data-testid="`filter-participant-${option.value}`"
            @click="participantType = option.value"
          />
        </UFieldGroup>

        <div class="flex gap-2 mt-2">
          <UButton
            size="sm"
            :color="unreadOnly ? 'primary' : 'neutral'"
            :variant="unreadOnly ? 'subtle' : 'outline'"
            :disabled="totalUnreadCount === 0"
            class="flex-1 justify-center disabled:!opacity-40"
            data-testid="filter-unread"
            @click="unreadOnly = !unreadOnly"
          >
            <span
              v-if="totalUnreadCount > 0"
              class="unread-badge mr-1"
              >{{ totalUnreadCount }}</span
            >
            {{ t('sidebar.filters.unread') }}
          </UButton>
          <UButton
            :label="t('sidebar.filters.favorites')"
            size="sm"
            :color="favoritesOnly ? 'primary' : 'neutral'"
            :variant="favoritesOnly ? 'subtle' : 'outline'"
            :disabled="!hasFavorites"
            class="flex-1 justify-center disabled:!opacity-40"
            data-testid="filter-favorites"
            @click="favoritesOnly = !favoritesOnly"
          />
        </div>
      </div>
    </div>

    <div
      v-if="isLoadingSessions"
      class="space-y-2 px-4"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-16"
      />
    </div>

    <UAlert
      v-else-if="sessionsError"
      color="error"
      variant="soft"
      class="mx-4"
    >
      {{ sessionsError.message }}
    </UAlert>

    <div
      v-else-if="filteredSessions.length === 0 && filteredDraftSessions.length === 0"
      class="px-5 py-8"
    >
      <UEmpty
        :description="t(hasActiveFilters ? 'sidebar.noFilterResults' : 'sidebar.noSessionsFound')"
      />
      <div
        v-if="hasActiveFilters"
        class="flex justify-center mt-3"
      >
        <UButton
          :label="t('sidebar.filters.clearFilters')"
          size="sm"
          color="primary"
          variant="outline"
          data-testid="empty-clear-filters"
          @click="clearAll"
        />
      </div>
    </div>

    <div
      v-else
      ref="scrollContainer"
      class="flex-1 overflow-y-auto px-3"
    >
      <div
        v-if="filteredDraftSessions.length > 0"
        class="px-3 pt-3 pb-2"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">
          {{ t('sidebar.draftChats') }}
        </h2>
      </div>
      <div
        v-for="draft in filteredDraftSessions"
        :key="draft.draftId"
        class="group relative"
      >
        <NuxtLink
          :to="draft.route"
          class="sidebar-item block pr-10"
          :data-testid="`draft-item-${draft.userId}`"
        >
          <div class="flex items-center gap-2">
            <SessionMembers
              :members="[draft.userEmail]"
              :selectable-users="users || []"
              size="2xs"
              class="flex-shrink-0"
            />
            <h3
              class="font-display-family text-sm font-medium tracking-tight line-clamp-1 flex-1 min-w-0"
            >
              {{ draft.userName }}
            </h3>
          </div>

          <p class="flex items-center gap-1.5 text-xs text-muted tracking-wide mt-1">
            <span class="line-clamp-1 italic">
              {{ draft.preview }}
            </span>
          </p>
        </NuxtLink>

        <div
          class="absolute top-3 right-2 transition-opacity"
          :class="isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
        >
          <UButton
            icon="i-heroicons-trash"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('sidebar.clearDraft')"
            :data-testid="`draft-clear-${draft.userId}`"
            @click.stop="handleClearDraft(draft.draftKey, draft.route)"
          />
        </div>
      </div>

      <div
        v-if="filteredDraftSessions.length > 0"
        class="px-3 pt-3 pb-2"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">
          {{ t('sidebar.chatSessions') }}
        </h2>
      </div>
      <TransitionGroup
        name="session-list"
        tag="div"
        class="flex flex-col gap-0.5"
      >
        <SessionListItem
          v-for="session in filteredSessions"
          :key="session.sessionId"
          :session="session"
          :users="users || []"
          :is-active="session.sessionId === activeSessionId"
          :unread-count="getUnreadCount(session.sessionId)"
          :display-name="getDisplayName(session)"
          :member-names="getMemberNames(session.members)"
          :other-members="getOtherMembers(session.members)"
          :is-primary-session="isPrimarySessionCheck(session)"
          :is-mobile="isMobile"
        />
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useScroll } from '@vueuse/core'
import { useChatListData } from '~/composables/useChatListData'
import { useChatListFilters, type ParticipantType } from '~/composables/useChatListFilters'
import { useUserFavorites } from '~/composables/useUserFavorites'
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import SessionMembers from '~/components/chat/SessionMembers.vue'
import SessionListItem from '~/components/chat/SessionListItem.vue'

const { t } = useI18n()
const route = useRoute()
const { isMobile } = useNavigationVisibility()

const {
  users,
  filteredSessions,
  filteredDraftSessions,
  isLoadingSessions,
  sessionsError,
  sessionSearchQuery,
  totalUnreadCount,
  getUnreadCount,
  getOtherMembers,
  getMemberNames,
  getDisplayName,
  isPrimarySessionCheck,
  clearDraftConversation,
} = useChatListData()

const { participantType, unreadOnly, favoritesOnly, hasActiveFilters, clearAll } =
  useChatListFilters()
const { favoriteIds } = useUserFavorites()
const hasFavorites = computed(() => favoriteIds.value.length > 0)

const participantOptions: { value: ParticipantType; label: string }[] = [
  { value: 'all', label: 'sidebar.filters.all' },
  { value: 'ai', label: 'sidebar.filters.ai' },
  { value: 'people', label: 'sidebar.filters.people' },
]

const activeSessionId = computed(() => route.params.sessionId as string)

watch(totalUnreadCount, (count) => {
  if (count === 0 && unreadOnly.value) {
    unreadOnly.value = false
  }
})

watch(hasFavorites, (has) => {
  if (!has && favoritesOnly.value) {
    favoritesOnly.value = false
  }
})

async function handleClearDraft(draftKey: string, draftRoute: string) {
  clearDraftConversation(draftKey)
  if (route.path === draftRoute) {
    await navigateTo('/chats')
  }
}

// Scroll position persistence
const scrollContainer = ref<HTMLElement>()

onMounted(() => {
  if (scrollContainer.value) {
    try {
      const savedPosition = sessionStorage.getItem('chat-sessions-scroll-position')
      if (savedPosition) {
        scrollContainer.value.scrollTop = parseInt(savedPosition, 10)
      }
    } catch {
      // Blocked Storage — skip scroll restore.
    }
  }
})

const { y: scrollY } = useScroll(scrollContainer)
watch(scrollY, (newY) => {
  try {
    sessionStorage.setItem('chat-sessions-scroll-position', newY.toString())
  } catch {
    // Blocked Storage — skip scroll persistence.
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
