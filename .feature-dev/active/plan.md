# Public Chat Feature - Implementation Plan

## Overview

**Feature**: Public Chat Mode for iframe embedding as a chatbot widget
**Architecture**: Minimal Overlay Approach
**Estimated Scope**: ~500 lines new code, ~80 lines modifications

---

## Requirements Summary

### Core Behavior
- Config-driven activation via `publicMode=1` in `config.json`
- Embedded chatbot experience (designed for iframe)
- Fresh session every visit (no history persistence)
- Single agent only (from `config.publicAgent`)

### Config Properties
```json
{
  "publicMode": 1,
  "publicLoginEmail": "ugyfel@innochat.hu",
  "publicLoginPassword": "ugyfel",
  "publicAgent": 1
}
```

### Authentication
- Clear any existing localStorage auth on public mode
- Auto-authenticate with config credentials
- Store tokens in `sessionStorage` (per-tab isolation)
- No SignalR connection (REST polling only)
- Token refresh during session (no timeout)

### Routing
| Route | Purpose |
|-------|---------|
| `/chats/public/new/[agentId]` | Entry point - new public chat |
| `/chats/public/[sessionId]` | Continue existing session |

**Route Protection**:
- `publicMode=1`: All non-public routes redirect to `/chats/public/new/[publicAgent]`
- `publicMode=0`: Public routes redirect to `/login`
- Wrong `agentId` redirects to correct one from config

### UI Simplifications
| Feature | Public Mode |
|---------|-------------|
| Sidebar | Hidden |
| AppBar | Hidden |
| Message Rating | Hidden |
| Typing Indicators | Disabled |
| STT (Speech-to-Text) | Disabled |
| Agent Selection Buttons | Hidden (single agent) |
| Session Title Edit | N/A |
| Member Management | N/A |
| Welcome Message | Shown |
| Markdown Rendering | Enabled |
| Theme | System preference |
| Language | Fixed Hungarian |

### Chat Behavior
- Disable send button while waiting for AI response (user can still type)
- No retry mechanism on failure
- Navigate with `replace` (no browser back button history)
- No draft persistence across page refresh

### Error Handling
- Auth failure: Show "Something went wrong" error
- Agent not found: Show "Something went wrong" error
- AI response failure: Just show user's message (no extra error UI)

---

## Architecture Design

### Chosen Approach: Minimal Overlay

**Rationale**:
- Maximizes code reuse (90% of existing chat components work as-is)
- Minimal surface area for bugs
- Fast to implement and test
- Aligns with focused iframe use case

### Component Reuse Strategy

| Existing Component | Reuse in Public | Modifications |
|-------------------|-----------------|---------------|
| `ChatMessages.vue` | Full reuse | None |
| `MarkdownContent.vue` | Full reuse | None |
| `MessageInput.vue` | Reuse with prop | Add `disableSignalR` prop |
| `useChatQueries.ts` | Full reuse | None |
| `useChatMutations.ts` | Full reuse | None |
| `useAuthStore` | Reuse with extension | Add sessionStorage mode |
| `useConfigStore` | Full reuse | None |

---

## Files to Create

### 1. `app/layouts/public.vue`
**Purpose**: Minimal layout wrapper for public chat pages

**Responsibilities**:
- Full-height container with no sidebar or AppBar
- Loading spinner while config loads
- Theme follows system preference
- Fixed Hungarian locale

**Template Structure**:
```vue
<template>
  <!-- Loading state while config loads -->
  <div v-if="!configStore.isLoaded" class="loading-spinner">
    <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
  </div>

  <!-- Error state -->
  <div v-else-if="hasError" class="error-state">
    Something went wrong
  </div>

  <!-- Main content -->
  <div v-else class="h-dvh flex flex-col">
    <slot />
  </div>
</template>
```

**Key Logic**:
- Watch `configStore.isLoaded` to show/hide loading
- Set locale to 'hu' on mount
- No sidebar components imported

---

### 2. `app/plugins/public-auth.client.ts`
**Purpose**: Auto-authenticate in public mode before routing

**Execution Order**: After `config-init.client.ts`

**Responsibilities**:
1. Wait for config to be loaded
2. Check if `publicMode === 1`
3. If public mode:
   - Clear existing localStorage auth (`authStore.clearAuth()`)
   - Set auth to use sessionStorage mode
   - Login with `publicLoginEmail` and `publicLoginPassword`
   - Handle auth errors gracefully

**Key Logic**:
```typescript
export default defineNuxtPlugin({
  name: 'public-auth',
  dependsOn: ['config-init'],
  async setup() {
    const configStore = useConfigStore()
    const authStore = useAuthStore()

    // Only run in public mode
    if (configStore.config.publicMode !== 1) return

    // Clear any existing auth (localStorage)
    authStore.clearAuth()

    // Enable sessionStorage mode
    authStore.setStorageMode('session')

    // Auto-login with config credentials
    const { publicLoginEmail, publicLoginPassword } = configStore.config
    if (publicLoginEmail && publicLoginPassword) {
      const result = await authStore.login({
        email: publicLoginEmail,
        password: publicLoginPassword,
        mode: AuthenticationMode.Basic
      })

      if (result.isErr()) {
        // Set error state for layout to display
        configStore.setPublicAuthError(true)
      }
    }
  }
})
```

---

### 3. `app/composables/usePublicMode.ts`
**Purpose**: Centralized public mode detection and utilities

**Exports**:
```typescript
export function usePublicMode() {
  const configStore = useConfigStore()

  // Computed: Is app in public mode?
  const isPublicMode = computed(() =>
    configStore.config.publicMode === 1
  )

  // Computed: The configured public agent ID
  const publicAgentId = computed(() =>
    configStore.config.publicAgent
  )

  // Computed: Did public auth fail?
  const hasPublicAuthError = computed(() =>
    configStore.publicAuthError
  )

  // Helper: Check if path is a public route
  function isPublicRoute(path: string): boolean {
    return path.startsWith('/chats/public/')
  }

  // Helper: Get the canonical public chat entry URL
  function getPublicEntryRoute(): string {
    return `/chats/public/new/${configStore.config.publicAgent}`
  }

  // Helper: Validate agent ID matches config
  function isValidPublicAgent(agentId: number | string): boolean {
    return Number(agentId) === configStore.config.publicAgent
  }

  return {
    isPublicMode,
    publicAgentId,
    hasPublicAuthError,
    isPublicRoute,
    getPublicEntryRoute,
    isValidPublicAgent
  }
}
```

---

### 4. `app/pages/chats/public/new/[agentId].vue`
**Purpose**: Entry point for new public chat sessions

**Layout**: `public`

**Responsibilities**:
1. Validate `agentId` matches `config.publicAgent`
2. Redirect if wrong agent
3. Generate fresh `sessionId` (UUID)
4. Fetch and display welcome message
5. Render chat UI (reuse components)
6. On first message sent, navigate to `/chats/public/[sessionId]`

**Template Structure**:
```vue
<template>
  <div class="flex flex-col h-full">
    <!-- Messages area -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 flex flex-col">
      <div class="flex-1" />
      <ChatMessages
        :messages="messages"
        :welcome-message="welcomeMessage"
        :agent-id="agentId"
        :agent-name="agentName"
      />
    </div>

    <!-- Message input -->
    <MessageInput
      :session-id="sessionId"
      :agent-id="agentId"
      :selected-agent-id="agentId"
      :selectable-agents="[]"
      :members="members"
      :disable-signal-r="true"
      @message-sent="handleMessageSent"
      @scroll-to-bottom="scrollToBottom"
    />
  </div>
</template>
```

**Key Logic**:
- `onMounted`: Validate agentId, redirect if invalid
- Generate `sessionId` using `generateUUID()`
- Fetch welcome message using `useWelcomeMessage(agentId)`
- `handleMessageSent`: Navigate to `/chats/public/[sessionId]` with `replace: true`

---

### 5. `app/pages/chats/public/[sessionId].vue`
**Purpose**: Continue an existing public chat session

**Layout**: `public`

**Responsibilities**:
1. Fetch session data using `useChatSession(sessionId)`
2. Display messages
3. Handle message sending
4. Validate session belongs to public agent

**Template Structure**:
```vue
<template>
  <div class="flex flex-col h-full">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <USkeleton class="h-16 w-3/4" />
    </div>

    <!-- Error state -->
    <div v-else-if="isError" class="flex-1 flex items-center justify-center">
      <p class="text-muted-foreground">Something went wrong</p>
    </div>

    <!-- Chat content -->
    <template v-else-if="session">
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 flex flex-col">
        <div class="flex-1" />
        <ChatMessages
          :messages="messages"
          :welcome-message="welcomeMessage"
          :agent-id="session.agentId"
          :agent-name="agentName"
        />
      </div>

      <MessageInput
        :session-id="sessionId"
        :agent-id="session.agentId"
        :selected-agent-id="session.agentId"
        :selectable-agents="[]"
        :members="session.members"
        :disable-signal-r="true"
        @message-sent="handleMessageSent"
        @scroll-to-bottom="scrollToBottom"
      />
    </template>
  </div>
</template>
```

**Key Logic**:
- Use `useChatSession(sessionId)` to fetch session
- Get welcome message for the agent
- No navigation on message sent (stay on same page)
- Auto-scroll on new messages

---

## Files to Modify

### 1. `app/stores/auth.ts`
**Changes**: Add sessionStorage support for public mode

**New State**:
```typescript
// Storage mode: 'local' (default) or 'session' (public mode)
const storageMode = ref<'local' | 'session'>('local')
```

**New Action**:
```typescript
function setStorageMode(mode: 'local' | 'session') {
  storageMode.value = mode
}
```

**Modified Functions**:

`saveAuthStateToStorage`:
```typescript
function saveAuthStateToStorage(user, accessToken, refreshToken) {
  const storage = storageMode.value === 'session'
    ? sessionStorage
    : localStorage

  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    user,
    accessToken,
    refreshToken,
    timestamp: new Date().toISOString()
  }))
}
```

`loadAuthStateFromStorage`:
```typescript
function loadAuthStateFromStorage() {
  const storage = storageMode.value === 'session'
    ? sessionStorage
    : localStorage

  const stored = storage.getItem(AUTH_STORAGE_KEY)
  // ... rest of existing logic
}
```

`clearAuthStateFromStorage`:
```typescript
function clearAuthStateFromStorage() {
  // Always clear both to ensure clean state
  localStorage.removeItem(AUTH_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}
```

**Exports to Add**:
```typescript
return {
  // ... existing exports
  storageMode,
  setStorageMode,
}
```

---

### 2. `app/stores/config.ts`
**Changes**: Add public auth error state

**New State**:
```typescript
const publicAuthError = ref(false)
```

**New Action**:
```typescript
function setPublicAuthError(hasError: boolean) {
  publicAuthError.value = hasError
}
```

**Exports to Add**:
```typescript
return {
  // ... existing exports
  publicAuthError,
  setPublicAuthError,
}
```

---

### 3. `app/middleware/auth.global.ts`
**Changes**: Handle public mode routing logic

**New Logic** (add at beginning of middleware):
```typescript
export default defineNuxtRouteMiddleware((to) => {
  const configStore = useConfigStore()
  const authStore = useAuthStore()

  // Check if config is loaded and we're in public mode
  const isPublicMode = configStore.isLoaded && configStore.config.publicMode === 1
  const isPublicRoute = to.path.startsWith('/chats/public/')

  // PUBLIC MODE ROUTING
  if (isPublicMode) {
    // Allow public routes
    if (isPublicRoute) {
      // Validate agent ID for /chats/public/new/[agentId]
      if (to.path.startsWith('/chats/public/new/')) {
        const agentId = Number(to.params.agentId)
        if (agentId !== configStore.config.publicAgent) {
          // Wrong agent - redirect to correct one
          return navigateTo(
            `/chats/public/new/${configStore.config.publicAgent}`,
            { replace: true }
          )
        }
      }
      return // Allow navigation
    }

    // Non-public route in public mode - redirect to public chat
    return navigateTo(
      `/chats/public/new/${configStore.config.publicAgent}`,
      { replace: true }
    )
  }

  // PRIVATE MODE: Block public routes
  if (!isPublicMode && isPublicRoute) {
    return navigateTo('/login')
  }

  // ... rest of existing auth middleware logic
})
```

---

### 4. `app/components/chat/MessageInput.vue`
**Changes**: Add `disableSignalR` prop to skip typing indicators

**Props Interface Update**:
```typescript
interface Props {
  sessionId: string
  agentId: number
  draftKey?: string
  members?: string[]
  selectableAgents?: UserDTO[]
  selectedAgentId?: number | undefined
  selectedAgentName?: string
  disableSignalR?: boolean  // NEW: Disable SignalR typing indicators
}

const props = withDefaults(defineProps<Props>(), {
  // ... existing defaults
  disableSignalR: false,  // NEW
})
```

**Modified Logic** (typing indicator watch):
```typescript
// Watch messageText for changes - typing indicator
watch(messageText, (newValue) => {
  // Skip SignalR typing indicators if disabled
  if (props.disableSignalR) return

  // ... rest of existing typing indicator logic
})
```

**Modified Logic** (cleanup on unmount):
```typescript
onUnmounted(() => {
  if (typingTimeoutId) clearTimeout(typingTimeoutId)

  // Only send stop typing if SignalR is enabled
  if (!props.disableSignalR && isTypingActive.value) {
    sendStoppedTypingIndicator(props.sessionId, props.members)
  }
})
```

**Modified Logic** (submit handler):
```typescript
async function handleSubmit() {
  if (!canSend.value) return

  // Clear typing indicator immediately on send (only if SignalR enabled)
  if (!props.disableSignalR) {
    if (typingTimeoutId) clearTimeout(typingTimeoutId)
    if (isTypingActive.value) {
      isTypingActive.value = false
      sendStoppedTypingIndicator(props.sessionId, props.members)
    }
  }

  // ... rest of existing submit logic
}
```

---

## Data Flow Diagrams

### App Initialization (Public Mode)

```
┌─────────────────────────────────────────────────────────────────┐
│                         APP START                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  config-init.client.ts                                          │
│  ─────────────────────                                          │
│  1. Fetch config.json from backend                              │
│  2. configStore.loadConfig()                                    │
│  3. configStore.isLoaded = true                                 │
│  4. Apply CSS variables                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  public-auth.client.ts (dependsOn: config-init)                 │
│  ─────────────────────────────────────────────────              │
│  IF config.publicMode === 1:                                    │
│    1. authStore.clearAuth()  → clears localStorage              │
│    2. authStore.setStorageMode('session')                       │
│    3. authStore.login(publicLoginEmail, publicLoginPassword)    │
│    4. Tokens stored in sessionStorage                           │
│    5. SignalR NOT initialized (skipped for public mode)         │
│  ELSE:                                                          │
│    Skip (private mode continues normally)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  auth.global.ts middleware                                      │
│  ─────────────────────────                                      │
│  IF publicMode AND NOT public route:                            │
│    → Redirect to /chats/public/new/[publicAgent]                │
│  IF NOT publicMode AND public route:                            │
│    → Redirect to /login                                         │
│  IF publicMode AND wrong agentId:                               │
│    → Redirect to correct agent                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Page Render (public.vue layout)                                │
│  ─────────────────────────────────                              │
│  1. Check configStore.isLoaded                                  │
│  2. Check publicAuthError                                       │
│  3. Set locale to 'hu'                                          │
│  4. Render page content (no sidebar)                            │
└─────────────────────────────────────────────────────────────────┘
```

### New Public Chat Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /chats/public/new/[agentId]                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Validate agentId                                               │
│  ─────────────────                                              │
│  IF agentId !== config.publicAgent:                             │
│    → navigateTo(/chats/public/new/[config.publicAgent])         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Initialize Page                                                │
│  ──────────────                                                 │
│  1. Generate sessionId = generateUUID()                         │
│  2. Fetch agent details from useSelectableUsers()               │
│  3. Fetch welcome message from useWelcomeMessage(agentId)       │
│  4. Render ChatMessages + MessageInput                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  User Types Message                                             │
│  ──────────────────                                             │
│  1. MessageInput receives input                                 │
│  2. disableSignalR=true → No typing indicators sent             │
│  3. Draft saved to chatStore (sessionStorage key)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  User Clicks Send                                               │
│  ────────────────                                               │
│  1. useSendMessage mutation triggered                           │
│  2. Optimistic update to TanStack Query cache                   │
│  3. API request with sessionId, agentId, question               │
│  4. Wait for AI response                                        │
│  5. Clear draft from chatStore                                  │
│  6. Emit 'messageSent' event                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Handle Message Sent                                            │
│  ───────────────────                                            │
│  navigateTo(`/chats/public/${sessionId}`, { replace: true })    │
└─────────────────────────────────────────────────────────────────┘
```

### Continue Public Chat Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /chats/public/[sessionId]                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Load Session                                                   │
│  ────────────                                                   │
│  1. useChatSession(sessionId) → fetch session + messages        │
│  2. Get agent details from session.agentId                      │
│  3. Fetch welcome message for timeline display                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Render Chat                                                    │
│  ───────────                                                    │
│  1. ChatMessages with messages + welcomeMessage                 │
│  2. MessageInput with disableSignalR=true                       │
│  3. No typing indicators, no agent buttons                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  User Sends More Messages                                       │
│  ────────────────────────                                       │
│  1. Same flow as new chat                                       │
│  2. Stay on same page (no navigation)                           │
│  3. Auto-scroll on new messages                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Sequence

### Phase 1: Infrastructure Foundation
**Goal**: Set up the core infrastructure for public mode

1. **Modify `app/stores/auth.ts`**
   - Add `storageMode` ref and `setStorageMode` action
   - Update storage functions to support sessionStorage
   - Test: Verify tokens can be stored/retrieved from sessionStorage

2. **Modify `app/stores/config.ts`**
   - Add `publicAuthError` state and setter
   - Test: Verify error state can be set/read

3. **Create `app/composables/usePublicMode.ts`**
   - Implement all computed properties and helpers
   - Test: Verify `isPublicMode` returns correct value based on config

### Phase 2: Layout & Plugin
**Goal**: Create the minimal layout and auto-auth plugin

4. **Create `app/layouts/public.vue`**
   - Minimal full-height container
   - Loading spinner while config loads
   - Error state display
   - Set Hungarian locale on mount
   - Test: Verify layout renders without sidebar/AppBar

5. **Create `app/plugins/public-auth.client.ts`**
   - Implement auto-authentication logic
   - Handle errors gracefully
   - Test: Verify auto-login works with config credentials

### Phase 3: Middleware
**Goal**: Implement route protection logic

6. **Modify `app/middleware/auth.global.ts`**
   - Add public mode routing logic at the beginning
   - Handle agent ID validation
   - Handle mode-based redirects
   - Test: Verify all redirect scenarios work correctly

### Phase 4: Chat Components
**Goal**: Add SignalR disable support

7. **Modify `app/components/chat/MessageInput.vue`**
   - Add `disableSignalR` prop
   - Guard typing indicator logic
   - Test: Verify no SignalR calls when prop is true

### Phase 5: Public Pages
**Goal**: Create the public chat pages

8. **Create `app/pages/chats/public/new/[agentId].vue`**
   - Implement agent validation
   - Generate session UUID
   - Fetch welcome message
   - Handle message sent navigation
   - Test: Full flow from landing to first message

9. **Create `app/pages/chats/public/[sessionId].vue`**
   - Load session with useChatSession
   - Display messages with ChatMessages
   - Handle ongoing conversation
   - Test: Full conversation flow

### Phase 6: Integration Testing
**Goal**: Verify all pieces work together

10. **Test public mode flow end-to-end**
    - Config with publicMode=1 → auto-auth → redirect → chat → message → navigate

11. **Test private mode isolation**
    - Config with publicMode=0 → public routes blocked → private flow unaffected

12. **Test edge cases**
    - Wrong agent ID → correct redirect
    - Auth failure → error display
    - Session refresh → fresh start

---

## Testing Checklist

### Unit Tests
- [ ] `usePublicMode` composable returns correct values
- [ ] Auth store sessionStorage mode works correctly
- [ ] Config store publicAuthError state works

### Integration Tests
- [ ] Public auth plugin auto-authenticates
- [ ] Middleware redirects work correctly
- [ ] MessageInput skips SignalR when disabled

### E2E Tests
- [ ] Full public chat flow (new → send → session → send more)
- [ ] Agent ID validation and redirect
- [ ] Public mode blocks private routes
- [ ] Private mode blocks public routes
- [ ] Session refresh creates fresh session
- [ ] Send button disables while waiting for response

### Manual Tests
- [ ] Iframe embedding works
- [ ] Theme follows system preference
- [ ] Language is fixed to Hungarian
- [ ] Markdown renders correctly
- [ ] Welcome message displays
- [ ] No sidebar or AppBar visible
- [ ] No typing indicators

---

## Security Considerations

1. **Credentials in config.json**: Backend responsibility to secure
2. **sessionStorage**: Per-tab isolation, cleared on tab close
3. **Route protection**: Middleware prevents cross-mode access
4. **Agent restriction**: Only publicAgent from config accessible
5. **No localStorage pollution**: Public mode clears localStorage first

---

## Performance Notes

1. **Bundle size**: Minimal impact (reuse existing components)
2. **Initial load**: Config already optimized
3. **No SignalR overhead**: REST-only in public mode
4. **TanStack Query**: Existing caching works for public sessions

---

## Future Considerations (Out of Scope)

- Multiple public agents
- Public chat analytics
- Rate limiting
- CAPTCHA protection
- Custom branding per public agent
- Persistent session history

---

## File Summary

### Files to Create (5)
| File | Lines (est.) | Purpose |
|------|--------------|---------|
| `app/layouts/public.vue` | ~50 | Minimal layout |
| `app/plugins/public-auth.client.ts` | ~60 | Auto-authentication |
| `app/composables/usePublicMode.ts` | ~50 | Mode detection utilities |
| `app/pages/chats/public/new/[agentId].vue` | ~150 | New public chat |
| `app/pages/chats/public/[sessionId].vue` | ~150 | Continue public chat |

### Files to Modify (4)
| File | Changes | Lines (est.) |
|------|---------|--------------|
| `app/stores/auth.ts` | Add sessionStorage mode | +30 |
| `app/stores/config.ts` | Add publicAuthError state | +10 |
| `app/middleware/auth.global.ts` | Add public routing logic | +30 |
| `app/components/chat/MessageInput.vue` | Add disableSignalR prop | +10 |

**Total**: ~540 lines new/modified code
