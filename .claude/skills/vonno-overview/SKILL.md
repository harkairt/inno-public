---
name: vonno-overview
description: Use when starting work on vonno/InnoChat, asking about project structure, where to put new code, tech stack, operating modes, or codebase architecture. Triggers on "vonno", "innochat", "this project", "start feature", "project overview", "codebase architecture", "where does X go", "project structure".
---

# Vonno / InnoChat — Project Overview

## What is this project?

**InnoChat** is a Vue 3 + Nuxt 4 SPA (SSR disabled) that serves as a rich frontend client to a C# backend API. The app is branded "Vonno" in the manifest. It operates in two distinct modes: **Authenticated** (full desktop chat UI) and **Public** (iframe-embeddable, restricted single-agent chat).

---

## Architecture Layers

```
Pages/Layouts
    │
    ├─ Composables (Vue Query: useChatQueries, useChatMutations)
    │       │
    │       ├─ Services (lib/api/services/)  ──→  apiClient (Axios)  ──→  Backend
    │       │
    │       └─ SignalR (lib/signalr/)        ──→  /chatHub WebSocket
    │
Pinia Stores (auth, chat, config)  ↔  Composables + Pages
```

- **Pages** consume composables, never services directly
- **Composables** own all server state via TanStack Vue Query
- **Services** make HTTP calls and return `Result<T, AppError>` (neverthrow)
- **Stores** hold app-wide UI state (auth tokens, active session, etc.)
- **SignalR** delivers real-time messages; composables listen via `useSignalRChat`

---

## Two Operating Modes

| Mode | Entry | Auth | Storage | SignalR |
|---|---|---|---|---|
| **Authenticated** | `/login` → full app | User login (JWT) | `localStorage` | Connected |
| **Public** | `/chats/public/new/[agentId]` | Auto-login from config.json | `sessionStorage` | REST-only |

Public mode is activated when `config.json` contains a `publicAgentId`. The `auth.global.ts` middleware enforces routing rules for both modes. Public mode is designed for iframe embedding and exposes a single agent.

---

## Tech Stack (source-verified from `nuxt.config.ts` / `package.json`)

| Layer | Technology |
|---|---|
| Framework | Nuxt 4 (`ssr: false`) + Vue 3 |
| Language | TypeScript (strict mode + strictNullChecks) |
| HTTP client | Axios with custom interceptors (`lib/api/client.ts`) |
| Server state | TanStack Vue Query 5 (`@tanstack/vue-query`) |
| App state | Pinia (`@pinia/nuxt`) |
| Real-time | `@microsoft/signalr` |
| UI components | Nuxt UI 4 (`@nuxt/ui`) + Tailwind CSS 4 |
| Validation | Zod (runtime schema validation) |
| Error handling | neverthrow (Result types) |
| i18n | `@nuxtjs/i18n` — `en` + `hu`, default: `hu` |
| Testing | Vitest + Testing Library + MSW 2 + Playwright |
| PWA | `@vite-pwa/nuxt` |

---

## Where to Put New Code

| What to add | Where |
|---|---|
| New page/route | `app/pages/` (Nuxt file-based routing) |
| Reusable UI component | `app/components/` (or `app/components/chat/` for chat) |
| Data fetching (queries) | `app/composables/useChatQueries.ts` |
| Data mutations | `app/composables/useChatMutations.ts` |
| App-wide UI state | `app/stores/chat.ts` or `app/stores/auth.ts` |
| Backend API call | `lib/api/services/ChatService.ts` (or new `XxxService.ts`) |
| Shared TypeScript types | `lib/types/` or `types/api/schemas.ts` |
| Reusable pure utils | `lib/utils/` or `app/utils/` |
| Global middleware | `app/middleware/` |
| Nuxt plugin | `app/plugins/` |
| i18n strings | `app/locales/en.json` + `app/locales/hu.json` |

---

## Key Entry Points

| File | Role |
|---|---|
| `app/app.vue` | Root component |
| `app/middleware/auth.global.ts` | All routing decisions (auth check, public mode, redirects) |
| `nuxt.config.ts` | Nuxt modules, i18n config, proxy rules (`/api`, `/chatHub`, `/assets`) |
| `app/plugins/api-interceptors.client.ts` | Axios request/response interceptors (token injection, 401 handling) |
| `app/plugins/config-init.client.ts` | Loads `InnoChatConfig` from `/api/settings/config.json` at startup |
| `app/plugins/vue-query.client.ts` | Installs VueQueryPlugin |
| `app/plugins/signalr-init.client.ts` | Establishes SignalR connection |

**Plugin execution order matters.** Plugins are loaded alphabetically by filename (client-side only since SSR is off).

---

## Path Aliases

| Alias | Resolves to | Use for |
|---|---|---|
| `@` | Repo root | `lib/`, `types/`, root-level files |
| `~` | `app/` directory | Components, pages, stores, composables |

Examples: `import type { UserDTO } from '@/types/api/schemas'`, `import { useAuthStore } from '@/app/stores/auth'`

---

## Proxy Routes (nuxt.config.ts `routeRules`)

All API calls are proxied through Nuxt to avoid CORS issues:

- `/api/**` → `http://localhost:8082/api/**`
- `/chatHub/**` → `http://localhost:8082/chatHub/**`
- `/assets/**` → `http://localhost:8082/assets/**`

Real backend endpoint prefix: `/api/AIWebAPI/*` for chat, `/api/authentication/*` for auth.

---

See `references/directory-guide.md` for a fully annotated directory listing.
