<template>
  <UDashboardGroup
    storage="cookie"
    storage-key="vonno-sidebar"
  >
    <UDashboardSidebar
      v-model:collapsed="collapsed"
      v-model:open="open"
      collapsible
      resizable
      mode="slideover"
      :default-size="25"
      :max-size="35"
      :min-size="20"
      :menu="{
        ui: {
          content: 'w-3/4 sm:w-full sm:max-w-md'
        }
      }"
    >
      <!-- Header slot with logo/app name -->
      <template #header="{ collapsed: _isCollapsed }">
        <NuxtLink
          to="/chats"
          class="cursor-pointer"
          :class="{ 'w-full': _isCollapsed }"
        >
          <div v-if="!_isCollapsed" class="font-display font-semibold text-lg tracking-tight">
            {{ t('pwa.appName') }}
          </div>
          <div v-else class="flex justify-center w-full">
            <UIcon name="i-heroicons-squares-2x2" class="size-5" />
          </div>
        </NuxtLink>
      </template>

      <!-- Default slot with navigation menu -->
      <template #default="{ collapsed: _isCollapsed }">
        <!-- Collapsed state: Icon-only buttons -->
        <div v-if="_isCollapsed" class="flex flex-col items-center gap-2 p-2">
          <UButton
            icon="i-heroicons-users"
            square
            variant="ghost"
            color="neutral"
            @click="collapsed = false"
          />
          <UButton
            icon="i-heroicons-chat-bubble-left-right"
            square
            variant="ghost"
            color="neutral"
            @click="collapsed = false"
          />
        </div>

        <!-- Expanded state: Full accordion -->
        <UAccordion
v-else
          type="multiple"
          :default-value="['sessions']"
          :items="accordionItems"
          class="w-full"
          :ui="{
            item: 'border-b border-transparent last:border-b-0',
            header: 'flex items-center gap-2 py-0.5 px-2.5 hover:bg-[hsl(var(--sidebar-accent))] rounded-lg mx-1 transition-colors duration-150',
            trigger: 'group flex items-center gap-3 font-medium text-sm focus:outline-none focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 focus-visible:before:ring-primary min-w-0',
            content: 'data-[state=open]:animate-[accordion-down_200ms_ease-out] data-[state=closed]:animate-[accordion-up_200ms_ease-out] overflow-hidden focus:outline-none',
            leadingIcon: 'shrink-0 size-5',
            trailingIcon: 'shrink-0 size-5 ms-auto group-data-[state=open]:rotate-180 transition-transform duration-200',
            label: 'text-start break-words text-sm font-medium'
          }"
        >
          <!-- Users content slot -->
          <template #users>
            <div class="space-y-4">
              <UInput
                v-model="userSearchQuery"
                icon="i-heroicons-magnifying-glass"
                :placeholder="t('sidebar.searchUsers')"
                size="sm"
                class="w-full"
                :ui="{ root: 'w-full' }"
              />

              <div v-if="isLoadingUsers" class="space-y-2">
                <USkeleton v-for="i in 3" :key="i" class="h-12" />
              </div>

              <UAlert v-else-if="usersError" color="error" variant="soft">
                {{ usersError.message }}
              </UAlert>

              <UEmpty
                v-else-if="filteredUsers.length === 0"
                :description="t('sidebar.noUsersFound')"
              />

              <div v-else>
                <div
                  v-for="user in filteredUsers"
                  :key="user.id"
                  class="sidebar-item"
                  @click="navigateToNewChat(user.id)"
                >
                  <!-- Row 1: Avatar + Name -->
                  <div class="flex items-center gap-2">
                    <UserAvatar
                      :alt="user.name || user.email"
                      :image="user.image"
                      :dark-image="user.darkImage"
                      size="2xs"
                      class="flex-shrink-0"
                    >
                      {{ getInitials(user.name || user.email) }}
                    </UserAvatar>
                    <p class="font-display text-sm font-medium tracking-tight line-clamp-1 flex-1 min-w-0">
                      {{ user.name || user.email }}
                    </p>
                  </div>

                  <!-- Row 2: Available-indicator + Email -->
                  <p class="flex items-center gap-1.5 text-xs text-muted tracking-wide mt-1">
                    <span
                      v-if="user.status === 'active'"
                      class="w-2 h-2 rounded-full bg-[hsl(var(--success,142_71%_45%))] shrink-0"
                    />
                    <span class="line-clamp-1">
                      {{ user.email }}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </template>

          <!-- Sessions content slot -->
          <template #sessions>
            <div class="space-y-4">
              <UInput
                v-model="sessionSearchQuery"
                icon="i-heroicons-magnifying-glass"
                :placeholder="t('sidebar.searchSessions')"
                size="sm"
                class="w-full"
                :ui="{ root: 'w-full' }"
              />

              <div v-if="isLoadingSessions" class="space-y-2">
                <USkeleton v-for="i in 3" :key="i" class="h-16" />
              </div>

              <UAlert v-else-if="sessionsError" color="error" variant="soft">
                {{ sessionsError.message }}
              </UAlert>

              <UEmpty
                v-else-if="filteredSessions.length === 0"
                :description="t('sidebar.noSessionsFound')"
              />

              <div
                v-else
                ref="sessionsScrollContainer"
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
                    @click="session.sessionId === activeSessionId && closeSidebarForNavigation()"
                  >
                    <!-- Row 1: Avatars + Session name -->
                    <div class="flex items-center gap-2">
                      <SessionMembers
                        :members="getOtherMembers(session.members)"
                        :selectable-users="users || []"
                        size="2xs"
                        class="flex-shrink-0"
                      />
                      <h3 class="font-display text-sm font-medium tracking-tight line-clamp-1 flex-1 min-w-0">
                        {{ session.sessionName }}
                      </h3>
                    </div>

                    <!-- Row 2: unread dot (if any) + time · member names -->
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

                  <!-- 3-dot menu - appears on hover -->
                  <div class="absolute top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <SessionItemMenu
                      :session-id="session.sessionId"
                      :session-name="session.sessionName"
                      :agent-id="session.agentId"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </UAccordion>
      </template>

      <!-- Footer slot with theme switcher and logout -->
      <template #footer="{ collapsed: _isCollapsed }">
        <!-- SignalR Connection Status (hidden when collapsed) -->
        <SignalRConnectionStatus v-if="!_isCollapsed" :collapsed="_isCollapsed" />

        <!-- Divider to separate status from buttons (hidden when collapsed) -->
        <UDivider v-if="!_isCollapsed" class="my-2" />

        <div class="flex items-center gap-2 w-full" :class="{ 'justify-center': _isCollapsed }">
          <UButton
            icon="i-heroicons-arrow-left-on-rectangle"
            square
            variant="ghost"
            color="neutral"
            :loading="isLoggingOut"
            :aria-label="t('sidebar.logout')"
            @click="handleLogout"
          />

          <template v-if="!_isCollapsed">
            <div class="flex-1" />

            <UButton
              :label="currentLocale === 'en' ? 'EN' : 'HU'"
              variant="ghost"
              color="neutral"
              @click="toggleLocale"
            />

            <UColorModeButton />
          </template>
        </div>
      </template>
    </UDashboardSidebar>

    <!-- Main content area -->
    <div class="flex flex-1 h-dvh flex-col overflow-hidden">
      <slot />
    </div>
  </UDashboardGroup>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useScroll } from '@vueuse/core'
import { useSelectableUsers } from '~/composables/useUsers'
import { useChatSessions, useUnreadMessageCounts } from '~/composables/useChatQueries'
import { useClientSideUserSearch } from '~/composables/useClientSideUserSearch'
import { useSidebar } from '~/composables/useSidebar'
import { useLogout } from '~/composables/useAuth'
import { useAuthStore } from '~/stores/auth'
import SignalRConnectionStatus from '@/app/components/chat/SignalRConnectionStatus.vue'
import SessionItemMenu from '@/app/components/chat/SessionItemMenu.vue'
import SessionMembers from '@/app/components/chat/SessionMembers.vue'

// i18n
const { t, locale, setLocale } = useI18n()
const currentLocale = computed(() => locale.value)

// Route and active session tracking
const route = useRoute()
const activeSessionId = computed(() => route.params.sessionId as string)

// Sidebar state - use shared composable
const collapsed = ref(false)
const open = ref(false)
const { registerSidebarState, isMobile, handleResize, cleanupBackButtonHandler, closeSidebarForNavigation, navigateToNewChat } = useSidebar()
const { formatRelativeDate } = useRelativeDate()

// Logout functionality
const { mutate: logout, isPending: isLoggingOut } = useLogout()

// Auth store for current user
const authStore = useAuthStore()

// TanStack Query - Users
const { data: users, isLoading: isLoadingUsers, error: usersError } = useSelectableUsers()

// TanStack Query - Chat Sessions
const { data: sessions, isLoading: isLoadingSessions, error: sessionsError } = useChatSessions()

// TanStack Query - Unread Message Counts
const { data: unreadCounts } = useUnreadMessageCounts()

// Search state
const userSearchQuery = ref('')
const sessionSearchQuery = ref('')

// Filtered users using client-side search composable
const { filteredUsers } = useClientSideUserSearch(users, userSearchQuery)

// Filtered sessions computed - sorted with unread messages first
const filteredSessions = computed(() => {
  if (!sessions.value) return []

  // Filter by search query
  const query = sessionSearchQuery.value.toLowerCase()
  const filtered = query
    ? sessions.value.filter(session =>
        session.sessionName.toLowerCase().includes(query) ||
        session.agentId.toString().includes(query)
      )
    : [...sessions.value]

  // Sort: unread messages first, then by insertDate (newest first)
  return filtered.sort((a, b) => {
    const unreadA = getUnreadCount(a.sessionId)
    const unreadB = getUnreadCount(b.sessionId)

    // If one has unread and the other doesn't, prioritize the one with unread
    if (unreadA > 0 && unreadB === 0) return -1
    if (unreadB > 0 && unreadA === 0) return 1

    // If both have unread or both don't, sort by date (newest first)
    return new Date(b.insertDate).getTime() - new Date(a.insertDate).getTime()
  })
})

// Helper: Get unread count for a session
const getUnreadCount = (sessionId: string): number => {
  if (!unreadCounts.value) return 0
  const entry = unreadCounts.value.find(u => u.sessionId === sessionId)
  return entry?.unreadMessageCount ?? 0
}

// Helper: Get other session members (excluding current user)
const getOtherMembers = (members: string[]): string[] => {
  const currentUserEmail = authStore.user?.email
  if (!currentUserEmail) return members
  return members.filter(email => email !== currentUserEmail)
}

// Helper: Get member names as a compact string
const getMemberNames = (members: string[]): string => {
  const otherMembers = getOtherMembers(members)
  if (otherMembers.length === 0) return t('sidebar.you')

  const names = otherMembers.slice(0, 2).map(email => {
    const user = users.value?.find(u => u.email === email)
    return user?.name?.split(' ')[0] || email.split('@')[0]
  })

  if (otherMembers.length > 2) {
    return `${names.join(', ')} +${otherMembers.length - 2}`
  }
  return names.join(', ')
}

// Helper: Get user initials for avatar
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Toggle locale function
const toggleLocale = () => {
  const newLocale = currentLocale.value === 'en' ? 'hu' : 'en'
  setLocale(newLocale)
}

// Navigation items for accordion
const accordionItems = computed(() => [
  {
    label: t('sidebar.users'),
    icon: 'i-heroicons-users',
    value: 'users',
    slot: 'users'
  },
  {
    label: t('sidebar.chatSessions'),
    icon: 'i-heroicons-chat-bubble-left-right',
    value: 'sessions',
    slot: 'sessions'
  }
])

// Scroll position persistence for sessions
const sessionsScrollContainer = ref<HTMLElement>()

// Restore scroll position on mount
onMounted(() => {
  if (sessionsScrollContainer.value) {
    const savedPosition = sessionStorage.getItem('chat-sessions-scroll-position')
    if (savedPosition) {
      sessionsScrollContainer.value.scrollTop = parseInt(savedPosition, 10)
    }
  }
})

// Save scroll position when scrolling
const { y: scrollY } = useScroll(sessionsScrollContainer)
watch(scrollY, (newY) => {
  sessionStorage.setItem('chat-sessions-scroll-position', newY.toString())
})

// Handle logout
const handleLogout = async () => {
  try {
    await logout()
    await navigateTo('/login')
  } catch (error) {
    // Error handling already managed by useLogout composable
    console.error('Logout failed:', error)
  }
}

// Register sidebar state with composable
onMounted(() => {
  registerSidebarState(collapsed, open)
})

// Cleanup back button handler on unmount
onUnmounted(() => {
  cleanupBackButtonHandler()
})

// Auto-close mobile slideover on route change
watch(route, () => {
  if (isMobile.value) {
    closeSidebarForNavigation()
  }
})

// Handle window resize - keep desktop expanded
watch(isMobile, (currentlyMobile, wasMobile) => {
  // When transitioning from mobile to desktop
  if (wasMobile && !currentlyMobile) {
    handleResize()
  }
})

// Keyboard shortcuts - Cmd/Ctrl+B to toggle sidebar
defineShortcuts({
  'meta_b': {
    handler: () => {
      if (isMobile.value) {
        open.value = !open.value
      } else {
        collapsed.value = !collapsed.value
      }
    }
  }
})
</script>
