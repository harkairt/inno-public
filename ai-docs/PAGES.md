# Routing & Pages

This document provides comprehensive documentation of the routing structure and page components.

---

## 1. Route Map

| Route | Component | Auth | Layout | Description |
|-------|-----------|------|--------|-------------|
| `/login` | `pages/login.vue` | No | `auth` | Email/password login |
| `/` | `pages/index.vue` | Yes | `default` | Redirects to /chats |
| `/chats` | `pages/chats/index.vue` | Yes | `default` | Chat list + agents |
| `/chats/[sessionId]` | `pages/chats/[sessionId].vue` | Yes | `default` | Active chat |
| `/chats/new/[userId]` | `pages/chats/new/[userId].vue` | Yes | `default` | Start new chat |
| `/users` | `pages/users.vue` | Yes | `default` | Users (placeholder) |

---

## 2. Page Details

### 2.1 login.vue

**File:** `app/pages/login.vue`

**Layout:** `auth`

**Authentication:** Not required

#### Features

- Email input with remember me
- Password input (masked)
- Login button with loading state
- Error display
- Redirect handling (from query param)

#### Data Fetching

None (local form state only)

#### Key Logic

```typescript
const handleLogin = async () => {
  const result = await authStore.login(email, password, rememberMe)
  if (result.isOk()) {
    navigateTo(redirect || '/chats')
  }
}
```

---

### 2.2 index.vue

**File:** `app/pages/index.vue`

**Layout:** `default`

**Authentication:** Required

#### Features

- Immediate redirect to `/chats`
- No visual content

#### Key Logic

```typescript
definePageMeta({
  middleware: 'auth'
})

onMounted(() => {
  navigateTo('/chats')
})
```

---

### 2.3 chats/index.vue

**File:** `app/pages/chats/index.vue`

**Layout:** `default`

**Authentication:** Required

#### Features

- Agent tiles grid
- Unread sessions list
- Session list (in sidebar)
- New chat button
- Search functionality

#### Data Fetching

| Composable | Purpose |
|------------|---------|
| `useChatSessions()` | All sessions |
| `useUnreadMessages()` | Unread counts |

#### Key Logic

```typescript
const { data: sessions } = useChatSessions()
const { data: unreadCounts } = useUnreadMessages()

const agents = computed(() =>
  sessions.value?.filter(s => s.isVirtual) ?? []
)
```

---

### 2.4 chats/[sessionId].vue

**File:** `app/pages/chats/[sessionId].vue`

**Layout:** `default`

**Authentication:** Required

#### URL Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Session UUID |

#### Features

- Message list
- Message input
- Session header with name
- Member management (for group chats)
- Typing indicators
- Auto-scroll to bottom

#### Data Fetching

| Composable | Purpose |
|------------|---------|
| `useChatSession(sessionId)` | Session with messages |

#### Key Logic

```typescript
const route = useRoute()
const sessionId = computed(() => route.params.sessionId as string)

const { data: session, isPending } = useChatSession(sessionId)

const messages = computed(() => session.value?.messages ?? [])
const members = computed(() => session.value?.members ?? [])
```

---

### 2.5 chats/new/[userId].vue

**File:** `app/pages/chats/new/[userId].vue`

**Layout:** `default`

**Authentication:** Required

#### URL Parameters

| Param | Type | Description |
|-------|------|-------------|
| `userId` | `string` | Target user UUID |

#### Features

- Start chat with specific user
- Creates session if needed
- Redirects to session

#### Key Logic

```typescript
const route = useRoute()
const userId = computed(() => route.params.userId as string)

const { mutateAsync: startChat } = useStartPublicChat()

onMounted(async () => {
  const result = await startChat({ userIds: [userId.value] })
  if (result.isOk()) {
    navigateTo(`/chats/${result.value.sessionId}`)
  }
})
```

---

### 2.6 users.vue

**File:** `app/pages/users.vue`

**Layout:** `default`

**Authentication:** Required

#### Features

- Placeholder page
- Static content

---

## 3. Middleware

### 3.1 auth.global.ts

**File:** `app/middleware/auth.global.ts`

**Type:** Global (runs on every navigation)

#### Logic

```typescript
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  // Allow access to login page
  if (to.path === '/login') {
    return
  }

  // Redirect unauthenticated users
  if (!authStore.isAuthenticated) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
```

#### Flow

1. Check if route is `/login`
2. If yes, allow navigation
3. Check `authStore.isAuthenticated`
4. If no, redirect to `/login?redirect={to.fullPath}`
5. If yes, allow navigation

---

## 4. Navigation Flow Diagram

```mermaid
graph TD
    A[User Visits App] --> B{Authenticated?}
    B -->|No| C[/login]
    B -->|Yes| D[/chats]
    C -->|Login Success| D
    D --> E{Select Session}
    E -->|Existing| F[/chats/:sessionId]
    E -->|New with User| G[/chats/new/:userId]
    G --> F
    F --> H{User Action}
    H -->|Back| D
    H -->|Another Session| F
```

---

## 5. Layouts

### 5.1 default.vue

**File:** `app/layouts/default.vue`

#### Structure

```
+----------------------------------+
|  Header (mobile only)            |
+----------------------------------+
|         |                        |
| Sidebar |   Page Content         |
| (fixed) |   (scrollable)         |
|         |                        |
+----------------------------------+
```

#### Sidebar Contents

- App logo
- Session list (accordion)
- Settings section
- User menu

#### Responsive Behavior

| Screen | Sidebar |
|--------|---------|
| Desktop (lg+) | Fixed visible |
| Mobile | Slide-over (toggle) |

### 5.2 auth.vue

**File:** `app/layouts/auth.vue`

#### Structure

```
+----------------------------------+
|                                  |
|         Centered Content         |
|         (login form)             |
|                                  |
+----------------------------------+
```

#### Styling

- Gradient background
- Centered card
- No navigation

---

## 6. Route Configuration

### 6.1 SSR Mode

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false  // SPA mode
})
```

### 6.2 Base URL

```typescript
// nuxt.config.ts
app: {
  baseURL: process.env.NUXT_APP_BASE_URL || '/'
}
```

---

## 7. Page Meta

### 7.1 Define Page Meta

```typescript
definePageMeta({
  layout: 'auth',
  middleware: 'auth'
})
```

### 7.2 Available Options

| Option | Type | Description |
|--------|------|-------------|
| `layout` | `string` | Layout to use |
| `middleware` | `string \| string[]` | Middleware to apply |
| `name` | `string` | Route name |
| `path` | `string` | Override route path |

---

## Related Documentation

- [COMPONENTS.md](./COMPONENTS.md) - Page components
- [FEATURES.md](./FEATURES.md) - Feature details
- [STATE.md](./STATE.md) - Page data fetching
