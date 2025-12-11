# Public Chat Feature - Implementation Documentation

## Executive Summary

The "Public Chat" feature is a lightweight, authentication-bypass mode designed for embedding the InnoChat application into external websites via iframe. When enabled, it automatically authenticates with pre-configured credentials and provides a simplified chat interface with a single AI agent.

---

## 1. Feature Overview

**Purpose:** Allow external websites to embed a chat interface without requiring user login.

**Key Characteristics:**
- Configuration-driven mode switching (not URL parameters)
- Automatic authentication with pre-configured credentials
- Simplified UI (no headers, navigation, or session management)
- Single pre-configured AI agent interaction
- Suitable for iframe embedding due to minimal UI footprint

---

## 2. Configuration System

### Config File Location
`/public/api/settings/config.json`

### Public Mode Configuration Properties

| Property | Type | Description |
|----------|------|-------------|
| `publicMode` | `0 \| 1` | Toggle: 0 = disabled, 1 = enabled |
| `publicLoginEmail` | `string` | Pre-configured email for auto-login |
| `publicLoginPassword` | `string` | Pre-configured password for auto-login |
| `publicAgent` | `-1 \| number` | AI agent ID to chat with (-1 = none) |

### Example Configuration
```json
{
  "publicMode": 1,
  "publicLoginEmail": "public@example.com",
  "publicLoginPassword": "securepassword123",
  "publicAgent": 42,
  "backendUrl": "https://api.example.com",
  "baseUrl": "/"
}
```

### Config Validation Schema
**File:** `src/types/validationSchemas.ts` (lines 679-682)
```typescript
publicMode: z.union([z.literal(0), z.literal(1)]),
publicLoginEmail: z.string().email(),
publicLoginPassword: z.string(),
publicAgent: z.union([z.literal(-1), z.number().positive()]),
```

### Config Loading
**File:** `src/config.ts`
- Config is loaded at app startup from the backend
- Stored in a reactive object accessible throughout the app
- `initConfig()` function fetches and validates configuration

---

## 3. Routes

### Route Definition
**File:** `src/routes/index.ts` (lines 28-30)

```typescript
{
  name: 'publicchats',
  path: '/publicchats',
  component: () => import('@views/PublicChatView.vue'),
}
```

### Route Comparison

| Route | Path | Mode | Features |
|-------|------|------|----------|
| `chats` | `/chats` | Full | Multi-agent, session list, WebSocket |
| `publicchats` | `/publicchats` | Public | Single agent, no sessions, REST only |

---

## 4. Authentication Flow

### Auto-Login Mechanism
**File:** `src/views/LoginView.vue` (lines 60-84)

**On Component Mount:**
```typescript
onMounted(async () => {
  if (config.publicMode === 1) {
    // Auto-login with pre-configured credentials
    loginMutate({
      email: config.publicLoginEmail,
      password: config.publicLoginPassword,
    })
  }
})
```

**On Login Success:**
```typescript
watch(isGetUserProfileSuccess, async () => {
  if (isGetUserProfileSuccess.value) {
    if (config.publicMode === 1) {
      router.push({ name: 'publicchats' })  // Public route
    } else {
      await initChatConnection()  // WebSocket setup
      router.push({ name: 'chats' })  // Standard route
    }
  }
})
```

### Key Differences from Standard Login

| Aspect | Standard Mode | Public Mode |
|--------|---------------|-------------|
| Login Form | Displayed | Hidden/Bypassed |
| Credentials | User-entered | Config-provided |
| WebSocket | Initialized | NOT initialized |
| Destination | `/chats` | `/publicchats` |

---

## 5. Public Chat View Component

### File Location
`src/views/PublicChatView.vue` (840 lines)

### Initialization
```typescript
const { mutate: init } = useMutation<ApiResponse<AIPublicChatStartDTO>, AppError>({
  mutationFn: async () => {
    const request: StartPublicChatrequestDTO = {
      userEmail: config.publicLoginEmail,
      agentId: config.publicAgent,
    }
    const response = await axiosInstance.post<ApiResponse<AIPublicChatStartDTO>>(
      '/api/AIWebAPI/startPublicChat',
      request,
      { timeout: config.axiosTimeout }
    )
    return response.data
  },
  onSuccess: (data: ApiResponse<AIPublicChatStartDTO>) => {
    // Sets loggedInUser and selectedAgent
    // Generates new session and loads welcome message
  },
})

onMounted(async () => {
  await init()
})
```

### Features Supported
- Text message sending (`handleSendUserQuestion`)
- Option-based responses (`handleSendUserQuestionOption`)
- Boolean responses (`handleSendUserQuestionBool`)
- Message rating (`handleLikeDislikeMessage`)
- File download links
- New session creation

### Features NOT Supported (vs ChatView)
- Session history/list
- Agent switching
- Real-time WebSocket updates
- Header navigation
- Drawer menu

---

## 6. UI Customization for Public Mode

### Layout Component
**File:** `src/components/layout/TheLayout.vue`

**Public Account Detection (line 48):**
```typescript
const isPublicAccount = computed(() => config.publicMode === 1)
```

**Header Visibility (line 82):**
```vue
<q-header elevated class="text-white header" height-hint="98" v-if="!isPublicAccount">
  <!-- Entire header hidden in public mode -->
</q-header>
```

**Menu Button Visibility (line 92):**
```vue
<q-btn
  v-if="!isPublicAccount && isAuthenticated"
  dense
  flat
  round
  icon="menu"
  @click="toggleRightDrawer"
/>
```

### UI Comparison

| Element | Standard Mode | Public Mode |
|---------|---------------|-------------|
| Header | Visible | Hidden |
| Menu button | Visible | Hidden |
| Drawer | Available | Hidden |
| Logout button | Visible | Hidden |
| Session list | Available | Not shown |
| Chat content | Full | Simplified |

---

## 7. API Endpoints

### Public Chat Specific

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/AIWebAPI/startPublicChat` | POST | Initialize public chat session |
| `/api/AIWebAPI/welcomeText` | POST | Get agent welcome message |
| `/api/AIWebAPI/question/text` | POST | Send user message |
| `/api/AIWebAPI/getMessage` | POST | Poll for response status |
| `/api/AIWebAPI/Set_SessionMessagesRead` | POST | Mark messages as read |

### Request/Response DTOs
**File:** `src/types/index.ts` (lines 256-264)

```typescript
export type StartPublicChatrequestDTO = {
  userEmail: string    // From config.publicLoginEmail
  agentId: number      // From config.publicAgent
}

export type AIPublicChatStartDTO = {
  user: SelectableUserResponseDTO   // Auto-logged in user info
  agent: SelectableUserResponseDTO  // Pre-configured AI agent
}
```

---

## 8. Session Handling

### Composable
**File:** `src/composables/useAiChatHandler.ts`

The `handleSetMessagesUnread` function (lines 56, 71-73) handles both modes:

```typescript
const handleSetMessagesUnread = async (
  sessionId: string,
  agentId: number,
  userCode: string,
  mutateSetUnread: SetUnreadMutate,
  privateSessions?: Ref<SelectableAISessionListItem[]>,
  selectedPublicSession?: Ref<SelectableAISessionListItem | null>
) => {
  if (privateSessions) {
    // ChatView branch - multiple sessions
    privateSessions.value.find(...)?.messages.forEach(...)
  } else if (selectedPublicSession) {
    // PublicChatView branch - single session
    selectedPublicSession.value?.messages.forEach(...)
  }
}
```

---

## 9. Iframe Embedding

### Embedding Method
```html
<iframe
  src="https://your-innochat-url/#/publicchats"
  width="100%"
  height="600"
  frameborder="0">
</iframe>
```

### Why It Works for Iframes
1. **Minimal UI** - No headers, drawers, or navigation cluttering the embedded view
2. **Self-contained** - All config loaded from server, no external dependencies
3. **Responsive** - Quasar framework provides mobile-first design
4. **Auto-authentication** - No user interaction required to start chatting
5. **Isolated credentials** - Uses dedicated public user account

### Current Limitations
- **No postMessage API** - No parent-child window communication
- **No URL parameters** - Mode controlled only via config.json
- **Security headers** - Must be configured server-side (X-Frame-Options, CSP)

---

## 10. Complete File Reference

| File | Purpose |
|------|---------|
| `src/config.ts` | Config loading & storage |
| `public/api/settings/config.json` | Runtime configuration |
| `src/types/validationSchemas.ts` | Config schema validation |
| `src/views/PublicChatView.vue` | Main public chat component |
| `src/views/LoginView.vue` | Auto-login logic |
| `src/routes/index.ts` | Route definitions |
| `src/components/layout/TheLayout.vue` | Mode-aware layout |
| `src/types/index.ts` | DTO type definitions |
| `src/composables/useAiChatHandler.ts` | Session/message handlers |

---

## 11. Feature Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP STARTUP                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  initConfig() loads config.json from backend                     │
│  Reads: publicMode, publicLoginEmail, publicLoginPassword,       │
│         publicAgent                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LoginView.vue mounts                          │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
      publicMode === 0              publicMode === 1
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│ Show login form         │     │ Auto-login with config          │
│ Wait for user input     │     │ credentials (no form shown)     │
└─────────────────────────┘     └─────────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│ initChatConnection()    │     │ Skip WebSocket setup            │
│ (WebSocket setup)       │     │                                 │
└─────────────────────────┘     └─────────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│ Route to /chats         │     │ Route to /publicchats           │
│ (ChatView.vue)          │     │ (PublicChatView.vue)            │
└─────────────────────────┘     └─────────────────────────────────┘
                                              │
                                              ▼
                              ┌─────────────────────────────────┐
                              │ Call startPublicChat API        │
                              │ Load agent & user info          │
                              │ Create session                  │
                              │ Load welcome message            │
                              └─────────────────────────────────┘
                                              │
                                              ▼
                              ┌─────────────────────────────────┐
                              │ Ready for chat interaction      │
                              │ (Simplified UI, single agent)   │
                              └─────────────────────────────────┘
```

---

## 12. Security Considerations

1. **Credential Storage** - Credentials in config.json should be protected via server access controls
2. **Dedicated Account** - Public mode should use a dedicated user account with limited permissions
3. **No Token UI** - Tokens managed internally, no exposure to UI
4. **API Validation** - Same backend validation as authenticated mode
5. **Iframe Security** - Server must configure appropriate X-Frame-Options and CSP headers

---

## 13. How to Enable Public Mode

1. Edit `config.json` on the server
2. Set `"publicMode": 1`
3. Provide valid `"publicLoginEmail"` and `"publicLoginPassword"`
4. Set `"publicAgent"` to the desired AI agent ID
5. Deploy/restart the application
6. Access via `/#/publicchats` or embed in iframe
