<template>
  <NuxtErrorBoundary @error="handleError">
    <main
      id="main-content"
      class="flex flex-col h-full w-full"
    >
      <!-- Header Section -->
      <div
        class="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border)/0.5)] min-h-[73px] bg-[hsl(var(--card))]"
      >
        <!-- Mobile: back button to session list -->
        <UButton
          v-if="isMobile"
          icon="i-heroicons-arrow-left"
          variant="ghost"
          color="neutral"
          square
          size="sm"
          :aria-label="t('errors.backToChats')"
          data-testid="back-to-chats"
          @click="
            () => {
              navigateTo('/chats')
            }
          "
        />

        <UserAvatar
          v-if="session && headerAgent"
          :image="headerAgent.image"
          :dark-image="headerAgent.darkImage"
          :alt="headerAgent.name"
          :round="headerAgent.isVirtual"
          size="md"
          class="flex-shrink-0"
          :style="!hasAvatar(headerAgent.image) ? headerAvatarStyle : undefined"
        >
          {{ headerInitials }}
        </UserAvatar>

        <div
          v-if="session"
          class="min-w-0 flex-1 group"
        >
          <!-- View mode: title + pencil icon (pencil hidden for primary sessions) -->
          <div
            v-if="!isEditingTitle"
            class="flex items-center gap-2"
          >
            <h1
              class="text-xl font-semibold text-foreground truncate"
              data-testid="session-title"
            >
              {{ headerTitle }}
            </h1>
            <button
              v-if="canEditTitle"
              type="button"
              class="opacity-0 group-hover:opacity-100 transition-opacity text-foreground hover:bg-[hsl(var(--accent))] rounded-md flex-shrink-0"
              :aria-label="t('chat.sessionMenu.editName')"
              data-testid="edit-title-button"
              @click="startEditingTitle"
            >
              <UIcon
                name="i-lucide-pencil"
                class="size-4"
              />
            </button>
          </div>

          <!-- Edit mode: input field -->
          <input
            v-else
            ref="titleInputRef"
            v-model="editedTitle"
            type="text"
            class="text-xl font-semibold text-foreground bg-transparent border-none outline-none w-full p-0 m-0 focus:ring-0"
            data-testid="session-title-input"
            :disabled="isUpdatingTitle"
            @keydown="handleTitleKeydown"
            @blur="saveTitle"
          />

          <p
            v-if="otherParticipantNames"
            class="text-sm text-muted-foreground truncate"
          >
            {{ otherParticipantNames }}
          </p>
        </div>

        <!-- Shimmer skeleton fallback when session data isn't available yet -->
        <div
          v-else
          class="min-w-0 flex-1 space-y-2"
        >
          <USkeleton class="h-6 w-48" />
          <USkeleton class="h-4 w-32" />
        </div>

        <!-- Focus sidebar toggle (desktop only) -->
        <UButton
          v-if="!isMobile && session"
          variant="ghost"
          color="neutral"
          square
          size="sm"
          :aria-label="t('chat.focus.toggleSidebar')"
          data-testid="focus-sidebar-toggle"
          @click="focusSidebarOpen = !focusSidebarOpen"
        >
          <div class="relative flex items-center justify-center">
            <UIcon
              :name="focusSidebarOpen ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'"
              class="size-6"
            />
            <span
              v-if="focusedIds.length > 0"
              class="absolute text-[9px] font-bold leading-none"
              :class="
                focusSidebarOpen
                  ? 'text-[hsl(var(--background))]'
                  : 'text-[hsl(var(--muted-foreground))]'
              "
              style="padding-bottom: 2px"
            >
              {{ focusedIds.length }}
            </span>
          </div>
        </UButton>

        <!-- Session Members Avatar Stack (hidden for primary sessions) -->
        <SessionMembers
          v-if="session && session.members.length > 0 && selectableUsers && !isPrimarySession"
          :members="session.members"
          :selectable-users="selectableUsers"
        />

        <!-- Manage Session Members Button (hidden for primary sessions) -->
        <ManageSessionUsers
          v-if="session && !isPrimarySession"
          :session-id="session.sessionId"
          :agent-id="session.agentId"
          :members="session.members"
        />

        <!-- Create new session button (shown only for primary sessions) -->
        <UButton
          v-if="session && isPrimarySession && otherMemberId"
          icon="i-heroicons-plus"
          variant="ghost"
          color="neutral"
          size="sm"
          :aria-label="t('chat.createNewSession')"
          data-testid="create-new-session-button"
          @click="
            () => {
              navigateTo(`/chats/new/${otherMemberId}`)
            }
          "
        />
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex items-center justify-center h-full p-4"
      >
        <div class="w-full max-w-md space-y-3 animate-[fade-in_0.4s_ease_both]">
          <div class="flex justify-end">
            <USkeleton
              class="h-12 w-[50%] !bg-[hsl(var(--muted-foreground)/0.08)]"
              style="border-radius: var(--config-message-border-radius)"
            />
          </div>
          <div class="flex justify-start">
            <USkeleton
              class="h-28 w-[70%] !bg-[hsl(var(--muted-foreground)/0.08)]"
              style="border-radius: var(--config-message-border-radius)"
            />
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div
        v-else-if="isError"
        class="flex items-center justify-center p-6 h-full"
      >
        <div class="text-center max-w-md">
          <UAlert
            variant="soft"
            :title="t('errors.sessionNotFound')"
            :description="errorMessage"
            class="mb-4"
          >
            <template #actions>
              <div class="flex space-x-2">
                <UButton
                  size="xs"
                  variant="outline"
                  @click="
                    () => {
                      refetch()
                    }
                  "
                >
                  {{ t('errors.tryAgain') }}
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  @click="
                    () => {
                      navigateTo('/chats')
                    }
                  "
                >
                  {{ t('errors.backToChats') }}
                </UButton>
              </div>
            </template>
          </UAlert>
        </div>
      </div>

      <!-- Chat Content -->
      <div
        v-else-if="session"
        class="flex h-full min-h-0"
        @dragenter="onDragEnter"
        @dragleave="onDragLeave"
        @dragover.prevent="onDragOver"
        @drop.prevent="onDrop"
      >
        <div
          v-if="isDraggingOver"
          class="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--primary)/0.1)] border-2 border-dashed border-[hsl(var(--primary))] rounded-lg pointer-events-none"
        >
          <span class="text-sm font-medium text-[hsl(var(--primary))]">
            {{ t('chat.messageInput.dropZone') }}
          </span>
        </div>
        <div class="flex flex-col flex-1 min-w-0 h-full relative">
          <div class="relative flex-1 overflow-hidden min-h-0">
            <div
              ref="messagesContainer"
              class="h-full overflow-y-auto py-4 flex flex-col"
            >
              <div
                class="max-w-(--container-chat) mx-auto w-full px-4 md:px-[26px] flex flex-col flex-1"
              >
                <div class="flex-1" />
                <Transition
                  name="shimmer-swap"
                  mode="out-in"
                  @enter="onMessagesEnter"
                  @after-enter="onMessagesEntered"
                >
                  <!-- Show bubble-shaped skeletons while waiting for real data -->
                  <div
                    v-if="!isMessagesReady"
                    key="shimmer"
                    data-testid="messages-shimmer"
                    class="space-y-3 animate-[fade-in_0.4s_ease_both]"
                  >
                    <div class="flex justify-end">
                      <USkeleton
                        class="h-12 w-[50%] !bg-[hsl(var(--muted-foreground)/0.08)]"
                        style="border-radius: var(--config-message-border-radius)"
                      />
                    </div>
                    <div class="flex justify-start">
                      <USkeleton
                        class="h-28 w-[70%] !bg-[hsl(var(--muted-foreground)/0.08)]"
                        style="border-radius: var(--config-message-border-radius)"
                      />
                    </div>
                  </div>
                  <ChatMessages
                    v-else
                    key="messages"
                    :messages="messages"
                    :welcome-message="trimmedWelcomeMessage"
                    :agent-id="session?.agentId ?? virtualAgentFromSession?.agentId"
                    :agent-name="virtualAgentFromSession?.agentName"
                    :welcome-message-date="virtualAgentFromSession?.firstMessageDate"
                    :member-count="session?.members?.length ?? 2"
                    :active-options-message-id="lastUnansweredOptionsMessageId"
                    :skip-entrance-animation="skipEntranceAnimation"
                    :focused-ids="focusedIds"
                    @option-submitted="handleOptionSubmitted"
                    @toggle-focus="toggleFocus"
                  />
                </Transition>
              </div>
            </div>
            <!-- Bottom fade gradient -->
            <div
              class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-[hsl(var(--background))] to-transparent pointer-events-none"
            />
          </div>

          <!-- Typing Indicator - fixed height, doesn't push messages -->
          <TypingIndicator
            :typing-users="typingUsers"
            :thinking-agents="thinkingAgents"
          />

          <MessageInput
            v-if="!isOptionsMode"
            ref="messageInputRef"
            :session-id="sessionId"
            :agent-id="authStore.user?.id || 1"
            :selected-agent-id="selectedTargetAgentId"
            :selectable-agents="isSingleVirtualAgentSession ? [] : selectableTargetAgents"
            :selected-agent-name="selectedAgentName"
            :members="session.members || []"
            :is-new-conversation="isPlaceholderData ? undefined : messages.length === 0"
            class="flex-shrink-0 sticky bottom-0"
            @message-sent="handleMessageSent"
            @scroll-to-bottom="scrollToBottom"
            @target-agent-changed="handleTargetAgentChanged"
          />
        </div>

        <FocusedMessagesSidebar
          v-if="!isMobile"
          v-model:sidebar-open="focusSidebarOpen"
          :messages="messages"
          :focused-ids="focusedIds"
          @toggle-focus="toggleFocus"
          @clear-all="(clearAll(), (focusSidebarOpen = false))"
        />
      </div>

      <!-- Session Not Found -->
      <div
        v-else
        class="flex items-center justify-center p-6 h-full"
      >
        <div class="text-center max-w-md">
          <UAlert
            variant="soft"
            :title="t('errors.sessionNotFound')"
            :description="t('errors.accessDenied')"
            class="mb-4"
          >
            <template #actions>
              <UButton
                size="xs"
                variant="outline"
                @click="
                  () => {
                    navigateTo('/chats')
                  }
                "
              >
                {{ t('errors.backToChats') }}
              </UButton>
            </template>
          </UAlert>
        </div>
      </div>
    </main>
    <!-- Error Boundary Fallback -->
    <template #error="{ error, clearError }">
      <div class="min-h-screen flex items-center justify-center p-6 bg-background">
        <div class="text-center max-w-md">
          <UAlert
            variant="soft"
            :title="t('errors.unexpectedError')"
            :description="getUserFriendlyMessage(error)"
            class="mb-4"
          >
            <template #actions>
              <div class="flex space-x-2">
                <UButton
                  size="xs"
                  variant="outline"
                  @click="clearError"
                >
                  {{ t('errors.tryAgain') }}
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  @click="
                    () => {
                      navigateTo('/chats')
                    }
                  "
                >
                  {{ t('errors.backToChats') }}
                </UButton>
              </div>
            </template>
          </UAlert>
        </div>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>

<script setup lang="ts">
import { useChatSession, useChatSessions } from '@/app/composables/useChatQueries'
import { useMarkMessagesRead, useSendMessage } from '@/app/composables/useChatMutations'
import { useChatMessages } from '@/app/composables/useChatMessages'
import { useTrimmedWelcomeMessage } from '@/app/composables/useTrimmedWelcomeMessage'
import { useFileDrop } from '@/app/composables/useFileDrop'
import { useTitleEdit } from '@/app/composables/useTitleEdit'
import { useSelectableUsers } from '@/app/composables/useUsers'
import { useAuthStore } from '@/app/stores/auth'
import { useChatStore } from '@/app/stores/chat'
import { useNavigationVisibility } from '~/composables/useNavigationVisibility'
import { usePrimarySession } from '@/app/composables/usePrimarySession'
import { AIQuestionType } from '@/types/enums'
import type { AiQuestionRequestDTO } from '@/types/api/schemas'
import { resolveWelcomeAgent } from '@/app/utils/welcomeAgent'
import { useChatAutoScroll } from '@/app/composables/useChatAutoScroll'
import MessageInput from '@/app/components/chat/MessageInput.vue'
import SessionMembers from '@/app/components/chat/SessionMembers.vue'
import ManageSessionUsers from '@/app/components/chat/ManageSessionUsers.vue'
import TypingIndicator from '@/app/components/chat/TypingIndicator.vue'
import UserAvatar from '~/components/UserAvatar.vue'
import { getInitials, getAvatarStyle, hasAvatar } from '@/app/utils/user'
import { useMessageFocus } from '@/app/composables/useMessageFocus'
import FocusedMessagesSidebar from '@/app/components/chat/FocusedMessagesSidebar.vue'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ChatSession')

const { t } = useI18n()

const route = useRoute()
const sessionId = route.params.sessionId as string

const authStore = useAuthStore()
const chatStore = useChatStore()

const { focusedIds, toggleFocus: rawToggleFocus, clearAll } = useMessageFocus(sessionId)
const focusSidebarOpen = ref(false)

function toggleFocus(messageId: string): void {
  const wasEmpty = focusedIds.value.length === 0
  rawToggleFocus(messageId)
  if (wasEmpty && focusedIds.value.length > 0 && !focusSidebarOpen.value) {
    focusSidebarOpen.value = true
  }
}

// Consume one-shot flag: skip entrance animation when arriving from /chats/new/*
chatStore.setActiveSession(sessionId)

const skipEntranceAnimation = chatStore.skipNextEntranceAnimation
chatStore.skipNextEntranceAnimation = false

// Consume one-shot flag: true only for the mount that directly follows creating this
// conversation on /chats/new/*. Any later visit is an existing conversation, and the
// agent greeting must not be fetched or shown there.
const isFreshlyCreatedSession = chatStore.nextSessionIsFreshlyCreated
chatStore.nextSessionIsFreshlyCreated = false

// Navigation visibility for mobile detection
const { isMobile } = useNavigationVisibility()

// Messages container ref for scrolling
const messagesContainer = ref<HTMLElement | null>(null)

// Message input ref for focus control and file drop forwarding
const messageInputRef = ref<{
  focus: () => void
  handleDroppedFiles: (files: FileList) => void
} | null>(null)

const { isDraggingOver, onDragEnter, onDragLeave, onDragOver, onDrop } = useFileDrop((files) =>
  messageInputRef.value?.handleDroppedFiles(files),
)

// Chat auto-scroll composable
const { isAtBottom, scrollToBottom, scrollToElement } = useChatAutoScroll(messagesContainer, {
  bottomThreshold: 50,
  smooth: true,
})

// Track if user was at bottom when they sent their message
// Used to decide scroll behavior when AI responds
const wasAtBottomWhenUserSentMessage = ref(true)

// Track whether initial scroll-to-bottom has happened (prevents duplicate scrolls)
const hasInitiallyScrolled = ref(false)

// Fetch session with messages
// The composable handles enabled logic internally (auth + sessionId check)
const {
  data: session,
  isLoading,
  isError,
  isPlaceholderData,
  error: chatError,
  refetch,
} = useChatSession(sessionId)

// Fetch all sessions for primary session detection
const { data: allSessions } = useChatSessions()

const { mutate: markMessagesRead } = useMarkMessagesRead()

const lastSeenMessageCount = ref(0)

watch(
  () => session.value?.messages?.length ?? 0,
  (count) => {
    if (count > lastSeenMessageCount.value && session.value && authStore.user?.email) {
      markMessagesRead({
        sessionId,
        agentId: session.value.agentId,
        userCode: authStore.user.email,
      })
    }
    lastSeenMessageCount.value = count
  },
  { immediate: true },
)

// Focus chat input on desktop when session loads
watch(
  () => session.value,
  (newSession) => {
    if (newSession && !isMobile.value) {
      void nextTick(() => {
        messageInputRef.value?.focus()
      })
    }
  },
  { immediate: true },
)

// Fetch selectable users to determine target agentId
const { data: selectableUsers, isLoading: isSelectableUsersLoading } = useSelectableUsers()

// Primary session detection
const currentUserEmail = computed(() => authStore.user?.email)
const { isPrimarySession, otherMemberName, otherMemberId } = usePrimarySession(
  session,
  allSessions,
  selectableUsers,
  currentUserEmail,
)

const { messages, typingUsers, thinkingAgents, lastUnansweredOptionsMessageId, isOptionsMode } =
  useChatMessages(sessionId, session)

// Header title: server-assigned name, or the user's first message for a freshly
// created session the server hasn't named yet (mirrors the optimistic sidebar entry).
const headerTitle = computed(() => {
  if (isPrimarySession.value) return otherMemberName.value
  if (session.value?.sessionName) return session.value.sessionName
  const email = authStore.user?.email
  return messages.value.find((m) => m.senderUserCode === email)?.messageText ?? ''
})

// Renaming is only offered once the server has named the session — not for primary
// sessions, and not while the header shows the temporary optimistic title.
const canEditTitle = computed(() => !isPrimarySession.value && !!session.value?.sessionName)

const {
  isEditingTitle,
  editedTitle,
  isUpdatingTitle,
  startEditingTitle,
  saveTitle,
  handleTitleKeydown,
  titleInputRef,
} = useTitleEdit(sessionId, {
  canEdit: canEditTitle,
  sessionName: computed(() => session.value?.sessionName),
  agentId: computed(() => session.value?.agentId),
})

// Compute selectable target agents from session members (only virtual agents)
const selectableTargetAgents = computed(() => {
  if (!session.value?.members || !selectableUsers.value) {
    return []
  }

  // Filter to only virtual agents who are session members
  return selectableUsers.value.filter(
    (user) => session.value.members.includes(user.email) && user.isVirtual,
  )
})

// Selected target agent ID (undefined = no selection, falls back to current user)
const selectedTargetAgentId = ref<number | undefined>(undefined)

// Options message mutation + logic
const optionMutation = useSendMessage()

async function handleOptionSubmitted(answer: string) {
  if (!session.value) return
  const targetAgentId = selectedTargetAgentId.value ?? authStore.user?.id ?? 1
  const request: AiQuestionRequestDTO = {
    userCode: authStore.user?.email ?? '',
    sessionId,
    agentId: targetAgentId,
    members: session.value.members ?? [],
    question: answer,
    group: '',
    pquestionType: AIQuestionType.Text,
    options: [],
    files: [],
  }
  try {
    await optionMutation.mutateAsync(request)
    scrollToBottom()
  } catch {
    // Error handled by mutation error state
  }
}

// Detect virtual agent for welcome message display (member-based → stable across GetSessionById)
const virtualAgentFromSession = computed(() =>
  resolveWelcomeAgent(
    session.value?.members,
    selectableUsers.value,
    session.value?.messages,
    session.value?.insertDate,
  ),
)

const { trimmedWelcomeMessage, isLoading: isWelcomeMessageLoading } = useTrimmedWelcomeMessage(
  computed(() => virtualAgentFromSession.value?.agentId ?? 0),
  {
    enabled: computed(() => !!virtualAgentFromSession.value && isFreshlyCreatedSession),
    sessionId: sessionId,
    showOnlyWhen: isFreshlyCreatedSession,
  },
)

// Determine if all data needed for messages is ready (prevents layout jump).
// The welcome-message gate is scoped to an EMPTY thread only: on revisit the
// cached messages must render immediately (stale-while-revalidate), so the
// welcome query — which may pend/retry/error independently — must not hold them.
// We still gate a brand-new session (no messages yet) so it doesn't flash empty
// before the welcome text arrives.
const isMessagesReady = computed(() => {
  // Placeholder data has messages: [] — don't render messages yet
  if (isPlaceholderData.value) return false

  // Must have selectableUsers loaded to determine if we need welcome message
  if (isSelectableUsersLoading.value) return false

  // Empty thread with a pending welcome: wait so we don't flash an empty thread
  if (virtualAgentFromSession.value && isWelcomeMessageLoading.value && messages.value.length === 0)
    return false

  return true
})

// Check if this is a 2-member session with exactly 1 virtual agent
// In this case, auto-select the virtual agent and hide buttons
const isSingleVirtualAgentSession = computed(() => {
  if (!session.value?.members || !authStore.user?.email) {
    return false
  }
  // Session has exactly 2 members AND exactly 1 virtual agent
  return session.value.members.length === 2 && selectableTargetAgents.value.length === 1
})

// The single virtual agent (if applicable)
const singleVirtualAgent = computed(() => {
  if (isSingleVirtualAgentSession.value) {
    return selectableTargetAgents.value[0]
  }
  return undefined
})

// Auto-select the single virtual agent in 2-member sessions
watch(
  [isSingleVirtualAgentSession, singleVirtualAgent],
  () => {
    if (isSingleVirtualAgentSession.value && singleVirtualAgent.value) {
      selectedTargetAgentId.value = singleVirtualAgent.value.id
    }
  },
  { immediate: true },
)

// Get the name of the currently selected agent (for placeholder text)
const selectedAgentName = computed(() => {
  if (!selectedTargetAgentId.value) {
    return undefined
  }
  const agent = selectableTargetAgents.value.find((a) => a.id === selectedTargetAgentId.value)
  return agent?.name
})

// Participant names for header subtitle (excludes current user)
const otherParticipantNames = computed(() => {
  if (!session.value?.members || !selectableUsers.value) return ''
  const currentEmail = authStore.user?.email
  return session.value.members
    .filter((email) => email !== currentEmail)
    .map((email) => {
      const user = selectableUsers.value!.find((u) => u.email === email)
      return user?.name ?? email
    })
    .join(', ')
})

const headerAgent = computed(() => {
  if (!session.value?.members || !selectableUsers.value) return undefined
  const currentEmail = authStore.user?.email
  const otherEmails = session.value.members.filter((email) => email !== currentEmail)
  for (const email of otherEmails) {
    const user = selectableUsers.value.find((u) => u.email === email)
    if (user) return user
  }
  return undefined
})

const headerInitials = computed(() => getInitials(headerAgent.value?.name ?? ''))
const headerAvatarStyle = computed(() => getAvatarStyle(headerAgent.value?.email ?? ''))

// Handle target agent change
function handleTargetAgentChanged(agentId: number | undefined) {
  selectedTargetAgentId.value = agentId
}

// Error message
const errorMessage = computed(() => {
  if (!chatError.value) return t('errors.sessionNotFound')
  return chatError.value.message || t('errors.unexpectedError')
})

// Handle session not found or access denied
watchEffect(() => {
  if (isError.value && chatError.value) {
    const err = chatError.value as { code?: string; statusCode?: number }
    if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
      // Session not found - redirect to chats list after a short delay
      setTimeout(() => {
        void navigateTo('/chats')
      }, 3000)
    } else if (err.code === 'FORBIDDEN' || err.statusCode === 403) {
      // Access denied - redirect to chats list
      void navigateTo('/chats')
    }
  }
})

// Set page metadata
definePageMeta({
  description: 'View your conversation history',
})

// SEO
useSeoMeta({
  title: () => session.value?.sessionName ?? 'Chat Session',
  description: 'View and continue your conversation',
})

// Error boundary handler
function handleError(_error: unknown) {
  // Error boundary catches rendering errors
}

// Error message normalization
function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return t('errors.unexpectedCreateError')
}

// Handle message sent event
function handleMessageSent() {
  // Only scroll if user is still at the bottom (they may have scrolled up while waiting)
  if (isAtBottom.value) {
    scrollToBottom()
  }
  if (import.meta.dev) logger.debug('Message sent successfully, isAtBottom:', isAtBottom.value)
}

// Auto-scroll when messages change (new message arrives)
// NOTE: We check isAtBottom BEFORE DOM updates (default flush),
// then scroll functions use nextTick to wait for DOM
watch(
  messages,
  (newMessages, oldMessages) => {
    const oldCount = oldMessages?.length ?? 0
    const newCount = newMessages?.length ?? 0

    if (!isMessagesReady.value) return
    if (newCount <= oldCount) return

    const latestMessage = newMessages[newMessages.length - 1]
    const userEmail = authStore.user?.email
    const isUserMessage = latestMessage?.senderUserCode === userEmail

    if (isUserMessage) {
      // User actively sent a message — they want to follow the conversation
      // regardless of where they were scrolled. The isAtBottom check when AI
      // responds still protects against scrolling up after sending.
      wasAtBottomWhenUserSentMessage.value = true
      scrollToBottom()
    } else {
      // AI responded - only scroll if user was at bottom when they sent message AND still at bottom
      if (import.meta.dev)
        logger.debug('[auto-scroll] AI message received:', {
          wasAtBottomWhenUserSentMessage: wasAtBottomWhenUserSentMessage.value,
          isAtBottom: isAtBottom.value,
          willScroll: wasAtBottomWhenUserSentMessage.value && isAtBottom.value,
        })

      if (wasAtBottomWhenUserSentMessage.value && isAtBottom.value) {
        const userMessageIndex = newMessages.length - 2
        const userMessage = newMessages[userMessageIndex]

        if (userMessage) {
          scrollToElement(`[data-testid="message-${userMessage.messageID}"]`)
        } else {
          scrollToBottom()
        }
      }
    }
    // If user scrolled up before sending, don't auto-scroll on AI response
  },
  { deep: true },
)

// Scroll to bottom when messages become ready (handles cached data where Transition @after-enter won't fire).
// When data is cached, isMessagesReady is true from the first render — the shimmer is never shown,
// so the Transition never fires @after-enter. This watch catches that case.
watch(
  isMessagesReady,
  (ready) => {
    if (ready && !hasInitiallyScrolled.value) {
      hasInitiallyScrolled.value = true
      void nextTick(() => scrollToBottom(true))
    }
  },
  { immediate: true },
)

// Scroll to bottom as soon as messages enter the DOM (while still invisible at opacity: 0).
// The @enter hook fires before the fade-in CSS transition starts, so the user never sees
// the top of the thread — the scroll position is already at the bottom when messages become visible.
function onMessagesEnter() {
  hasInitiallyScrolled.value = true
  scrollToBottom(true)
}

// Safety net: ensure scroll position is correct after the fade-in animation completes.
function onMessagesEntered() {
  hasInitiallyScrolled.value = true
  scrollToBottom(true)
}
</script>

<style scoped>
.shimmer-swap-enter-active,
.shimmer-swap-leave-active {
  transition: opacity 0.15s ease;
}
.shimmer-swap-enter-from,
.shimmer-swap-leave-to {
  opacity: 0;
}
</style>
