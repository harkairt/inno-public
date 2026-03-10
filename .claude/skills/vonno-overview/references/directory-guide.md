# Vonno Directory Guide

Annotated listing of every significant folder and file in the vonno repo.

```
vonno/
├── app/                          # Nuxt application source
│   ├── app.vue                   # Root component, wraps <NuxtLayout> + <NuxtPage>
│   ├── assets/
│   │   └── css/main.css          # Global Tailwind + CSS variable definitions
│   ├── components/               # Reusable Vue components (auto-imported by Nuxt)
│   │   ├── chat/                 # Chat-domain components
│   │   │   ├── ChatMessages.vue  # Message list with date grouping + optimistic status
│   │   │   ├── ChatListPanel.vue # Session list panel (search, scroll persistence)
│   │   │   ├── MessageInput.vue  # Text input, voice recording, send button
│   │   │   ├── MarkdownContent.vue # Renders AI markdown responses
│   │   │   ├── OptionsMessage.vue  # Renders AIAnswerType.Options messages
│   │   │   └── MessageRating.vue   # Thumbs up/down rating (temporarily hidden)
│   │   ├── navigation/           # App shell navigation components
│   │   │   ├── AppRail.vue       # Desktop: narrow 64px vertical icon rail
│   │   │   └── AppBottomTabBar.vue # Mobile: fixed bottom tab bar with icons + labels
│   │   └── ...                   # Other UI components
│   ├── composables/              # Vue composables (auto-imported by Nuxt)
│   │   ├── useChatQueries.ts     # ALL TanStack Vue Query READ operations
│   │   ├── useChatMutations.ts   # ALL TanStack Vue Query WRITE operations + optimistic updates
│   │   ├── useChatListData.ts    # Data aggregation: combines queries + search/filter for session lists
│   │   ├── useNavigationVisibility.ts # Responsive breakpoint (768px) + auth/route visibility logic
│   │   ├── useAuth.ts            # Auth composable (wraps authStore)
│   │   ├── useSignalR.ts         # SignalR connection management
│   │   ├── useSignalRChat.ts     # SignalR message event handlers → cache updates
│   │   ├── usePublicMode.ts      # Public mode detection + config helpers
│   │   ├── useConfig.ts          # InnoChatConfig access composable
│   │   ├── useUsers.ts           # Users/agents query
│   │   └── ...
│   ├── layouts/
│   │   ├── default.vue           # App shell: renders AppRail (desktop) or AppBottomTabBar (mobile) + <slot />
│   │   └── public.vue            # Public/minimal layout for iframe mode
│   ├── middleware/
│   │   └── auth.global.ts        # Global route guard: auth check + public mode routing
│   ├── pages/                    # Nuxt file-based routing
│   │   ├── index.vue             # Home / redirect
│   │   ├── login.vue             # Login page
│   │   ├── users.vue             # User/agent list page
│   │   ├── profile.vue           # User settings (locale, color mode, logout)
│   │   ├── chats.vue             # Parent route layout: ChatListPanel + <NuxtPage> (master-detail)
│   │   └── chats/
│   │       ├── index.vue         # Chat list (mobile) or empty state (desktop)
│   │       ├── [sessionId].vue   # Authenticated chat session page
│   │       ├── new/
│   │       │   └── [userId].vue  # New chat with specific user/agent
│   │       └── public/
│   │           └── new/
│   │               └── [agentId].vue  # Public chat entry page
│   ├── plugins/                  # Client-side Nuxt plugins (run at startup)
│   │   ├── api-interceptors.client.ts  # Axios: inject auth headers, handle 401
│   │   ├── config-init.client.ts       # Fetch + store InnoChatConfig
│   │   ├── vue-query.client.ts         # Install @tanstack/vue-query
│   │   ├── signalr-init.client.ts      # Connect SignalR on startup
│   │   ├── pinia-persistence.client.ts # Pinia persistence plugin setup
│   │   └── buffer.client.ts            # Node.js Buffer polyfill
│   ├── stores/                   # Pinia stores (auto-discovered via nuxt.config.ts)
│   │   ├── auth.ts               # User, JWT tokens, login/logout, storage mode switching
│   │   ├── chat.ts               # Active session, message Map, UI state
│   │   └── config.ts             # InnoChatConfig (loaded from /api/settings/config.json)
│   ├── types/                    # App-layer type extensions
│   └── utils/                    # App-layer utilities
│
├── lib/                          # Framework-agnostic business logic
│   ├── api/
│   │   ├── client.ts             # Axios instance with base config + interceptors
│   │   ├── services/
│   │   │   ├── AuthService.ts    # login, refreshToken, getProfile, forgottenPassword
│   │   │   └── ChatService.ts    # All /api/AIWebAPI/* endpoints
│   │   └── utils/
│   │       └── tokens.ts         # JWT token extraction helpers
│   ├── config/
│   │   └── ...                   # Config-related utilities
│   ├── errors/
│   │   ├── types.ts              # AppError class hierarchy + type guards
│   │   └── normalize.ts          # Axios error → AppError conversion
│   ├── signalr/                  # SignalR client setup
│   ├── types/                    # Shared TypeScript types
│   ├── utils/                    # Pure utility functions
│   └── validation/               # Zod schema helpers
│
├── types/                        # Root-level TypeScript types
│   ├── api/
│   │   ├── schemas.ts            # All Zod schemas + inferred DTOs (UserDTO, AISessionDTO, etc.)
│   │   └── base.ts               # ApiResponse<T>, MutationSuccess base types
│   └── enums.ts                  # AIAnswerType, ErrorCode, AuthenticationMode, etc.
│
├── tests/
│   ├── setup.ts                  # Global Vitest setup: Pinia, VueQuery, MSW, global stubs
│   ├── unit/                     # Unit + component tests (mirrors source structure)
│   │   ├── lib/api/services/     # Service tests (vi.mock apiClient)
│   │   ├── composables/          # Composable tests
│   │   └── components/           # Component tests (@testing-library/vue)
│   ├── msw/
│   │   ├── server.ts             # MSW server (Node.js + browser handlers registered)
│   │   └── handlers/             # Per-domain MSW handler files
│   │       ├── chat.ts           # /api/AIWebAPI/* mock handlers
│   │       └── auth.ts           # /api/authentication/* mock handlers
│   └── e2e/                      # Playwright E2E tests
│       └── mocks/
│           └── data/             # Shared mock data (sessions, messages)
│
├── i18n/
│   └── locales/
│       ├── en.json               # English translations
│       └── hu.json               # Hungarian translations (default locale)
│
├── nuxt.config.ts                # Nuxt modules, aliases, proxy rules, PWA config
├── vitest.config.ts              # Test runner config + coverage thresholds (80%)
├── package.json                  # npm scripts: test, test:coverage, test:e2e, lint, typecheck
└── .claude/
    ├── skills/                   # Project-local Claude Code skills (this file's parent)
    └── hooks/                    # Claude Code hooks
```

## Key Relationships

- `ChatService.ts` ← called by → `useChatQueries.ts` + `useChatMutations.ts`
- `useChatMutations.ts` uses optimistic updates: adds temp messages to Vue Query cache before API resolves
- `useSignalRChat.ts` listens to SignalR events and calls `queryClient.setQueryData()` to update cache
- `auth.ts` store manually manages localStorage/sessionStorage (not pinia-plugin-persistedstate) to support runtime storage mode switching (authenticated vs public mode)
