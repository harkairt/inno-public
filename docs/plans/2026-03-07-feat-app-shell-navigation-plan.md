---
title: "feat: App Shell Navigation (Bottom Tab Bar + Left Rail + Master-Detail)"
type: feat
status: completed
date: 2026-03-07
origin: docs/brainstorms/2026-03-07-responsive-navigation-brainstorm.md
---

# App Shell Navigation

## Overview

Replace the current `DashboardSidebar` with a modern app-shell navigation pattern inspired by Telegram/WhatsApp/Slack. Mobile gets a bottom tab bar with stacked full-page views. Desktop gets a left icon rail with a master-detail split for the Chats tab. The sidebar and all its infrastructure are fully removed.

This is a major architectural change touching the layout, routing, data fetching, and component structure across the entire authenticated experience.

## Problem Statement / Motivation

The current sidebar-first navigation feels dated (see brainstorm: `docs/brainstorms/2026-03-07-responsive-navigation-brainstorm.md`). The slideover drawer on mobile is clunky, and the sidebar takes up too much space on desktop for simple section switching. Modern chat apps use a tab bar + rail pattern that feels native and intuitive.

## Proposed Solution

A 2-tier responsive navigation system:

- **Mobile (<768px):** Bottom tab bar (Chats, Users, Profile) + full-page views. Hidden in active chat.
- **Desktop (>=768px):** Left icon rail (~64px, always visible) + content area. Chats tab uses master-detail split; Users and Profile are full-width.

### Visual Overview

```
MOBILE: Tab views           MOBILE: Active chat         DESKTOP: Chats tab
┌───────────────┐           ┌─────────────────┐         ┌───┬─────────┬────────┐
│  Chats / Users│           │ ← Session Name  │         │💬 │ Sessions│ Chat   │
│  / Profile    │           │─────────────────│         │👥 │ list    │ area   │
│  (full page)  │           │ Messages...     │         │👤 │         │        │
│               │           │ > Type message  │         │   │         │        │
├───────────────┤           │  (no tab bar)   │         └───┴─────────┴────────┘
│ 💬   👥   👤 │           └─────────────────┘         Rail  Panel     Content
└───────────────┘
  Tab bar                   DESKTOP: Users/Profile tab
                            ┌───┬────────────────────┐
                            │💬 │ Full-width content  │
                            │👥 │                    │
                            │👤 │                    │
                            └───┴────────────────────┘
                            Rail  Content
```

## Technical Approach

### Architecture

#### Component Hierarchy

```
app.vue
  └─ NuxtLayout
       ├─ layouts/default.vue (authenticated)
       │    ├─ AppRail (desktop only, >=768px)
       │    ├─ <slot /> (page content)
       │    └─ AppBottomTabBar (mobile only, <768px, route-conditional)
       │
       ├─ layouts/auth.vue (login page, unchanged)
       └─ layouts/public.vue (public mode, unchanged)

pages/
  ├─ chats.vue (parent route wrapper with <NuxtPage />)
  │    ├─ chats/index.vue (session list — mobile: full page, desktop: left panel)
  │    ├─ chats/[sessionId].vue (active chat — mobile: full page, desktop: right panel)
  │    └─ chats/new/[userId].vue (new chat — mobile: full page, desktop: right panel)
  ├─ users.vue (user list — always full-width)
  └─ profile.vue (profile/settings — always full-width)
```

#### Data Fetching Strategy

**Global (in layout or app-level):** `useUnreadMessageCounts()` — needed for the badge on the Chats tab icon across all pages.

**Per-page:** `useChatSessions()`, `useSelectableUsers()`, and all filtering/sorting logic move from `default.vue` into their respective page components or dedicated composables. TanStack Query caching ensures navigating back to a tab does not re-fetch unless stale.

#### Key Pattern: Parent Route for Master-Detail

The master-detail split for Chats uses the Nuxt parent-route pattern:

```
app/pages/chats.vue          ← Parent wrapper (always mounted when on /chats/*)
app/pages/chats/index.vue    ← Session list (mobile: full page, desktop: left panel)
app/pages/chats/[sessionId].vue  ← Chat content (mobile: full page, desktop: right panel)
```

`chats.vue` renders the session list panel (desktop only) alongside `<NuxtPage />`. On mobile, only the matched child page renders. This keeps the session list mounted on desktop while navigating between sessions, preserving scroll position and search state.

### Implementation Phases

#### Phase 1: Foundation — New Composables + Route Structure

**Goal:** Set up the responsive infrastructure and parent-route pattern without changing the visible UI yet.

**Tasks:**

1. **Create `app/composables/useNavigationVisibility.ts`**
   - Expose: `showBottomTabBar`, `showRail`, `isMobile` (computed booleans)
   - Input: `useRoute()`, `useWindowSize()` from VueUse
   - Rules:
     - `isMobile`: viewport width < 768px
     - `showBottomTabBar`: `isMobile && !isActiveChat && !isPublicMode && isAuthenticated`
     - `showRail`: `!isMobile && !isPublicMode && isAuthenticated`
     - `isActiveChat`: route name matches `chats-sessionId` or `chats-new-userId`
   - Replace `useSidebar.ts`'s `isMobile` usage across consumers

2. **Create `app/pages/chats.vue`** (parent route wrapper)
   - Desktop: renders `ChatListPanel` (session list) + `<NuxtPage />`
   - Mobile: renders only `<NuxtPage />`
   - Uses `useNavigationVisibility().isMobile` for conditional rendering

3. **Create `app/composables/useChatListData.ts`**
   - Extract from `default.vue`: `useChatSessions()`, `useUnreadMessageCounts()`, `useClientSideUserSearch()`, all session filtering/sorting helpers (`getUnreadCount`, `getOtherMembers`, `getMemberNames`, etc.)
   - This composable owns all session list data logic — consumed by `ChatListPanel` and the `/chats` index page

**Success criteria:** Parent route pattern works — navigating between `/chats`, `/chats/[sessionId]` on desktop does not unmount the session list panel.

---

#### Phase 2: Core Navigation Components

**Goal:** Build the bottom tab bar and left rail.

**Tasks:**

4. **Create `app/components/navigation/AppBottomTabBar.vue`**
   - Fixed to bottom of viewport: `fixed bottom-0 inset-x-0 z-50`
   - Safe area inset: `pb-[env(safe-area-inset-bottom)]`
   - 3 items: Chats (icon: `i-heroicons-chat-bubble-left-right`), Users (icon: `i-heroicons-users`), Profile (icon: `i-heroicons-user-circle`)
   - Each item is a `NuxtLink` with `aria-current="page"` on active
   - Container: `<nav role="navigation" aria-label="Main navigation">`
   - Unread badge on Chats icon using `UChip` with `text` prop (number, capped at "99+"), `show` prop (count > 0)
   - Active state: filled icon variant or color accent + bottom indicator bar
   - Height: `h-16` (64px) + safe area padding

5. **Create `app/components/navigation/AppRail.vue`**
   - Fixed left column: `w-16 h-dvh flex flex-col` with `border-r`
   - 3 icon buttons using `UButton` with `variant="ghost"`, each wrapped in `UTooltip` with `side="right"`
   - Same 3 destinations as tab bar
   - Unread badge using `UChip` wrapping the Chats button
   - Active state: background highlight + left border accent (reuse `sidebar-item-active` pattern adapted for icons)
   - Bottom area: app logo or user avatar (stretch goal)
   - `<nav role="navigation" aria-label="Main navigation">`

6. **Add `viewport-fit=cover`** to the viewport meta tag in `nuxt.config.ts` (`app.head.meta`)
   - Audit existing pages for content near screen edges that may need safe-area padding

**Success criteria:** Both components render correctly at their respective breakpoints. Clicking items navigates to the correct routes. Unread badge updates in real-time via SignalR cache invalidation.

---

#### Phase 3: Layout Rewrite

**Goal:** Replace `default.vue` with the app shell layout.

**Tasks:**

7. **Rewrite `app/layouts/default.vue`**
   - Remove: `UDashboardGroup`, `UDashboardSidebar`, all sidebar content, all session/user data fetching
   - New structure:
     ```
     Mobile:
     <div class="flex flex-col h-dvh">
       <main class="flex-1 overflow-auto" :class="{ 'pb-16': showBottomTabBar }">
         <slot />
       </main>
       <AppBottomTabBar v-if="showBottomTabBar" />
     </div>

     Desktop:
     <div class="flex h-dvh">
       <AppRail v-if="showRail" />
       <main class="flex-1 flex flex-col overflow-hidden">
         <slot />
       </main>
     </div>
     ```
   - Fetch `useUnreadMessageCounts()` globally (needed for badge)
   - Keep `UNotifications` and `AppUpdateBanner`

8. **Create `app/components/chat/ChatListPanel.vue`**
   - Extract session list UI from old `default.vue` sidebar "sessions" accordion
   - Includes: search input, session list with avatars/names/dates/unread dots, `SessionItemMenu` context menus
   - Consumed by `pages/chats.vue` (desktop panel) and `pages/chats/index.vue` (mobile full page)
   - Desktop: rendered as a side panel with fixed width (~300px) or resizable via CSS
   - Mobile: rendered full-width as page content

9. **Update `app/pages/chats.vue`** (parent wrapper)
   - Desktop: `<div class="flex flex-1 overflow-hidden"><ChatListPanel class="w-80 border-r" /><NuxtPage class="flex-1" /></div>`
   - Mobile: `<NuxtPage />`

10. **Update `app/pages/chats/index.vue`**
    - Mobile: render `ChatListPanel` full-width (this IS the Chats tab content)
    - Desktop: render empty state / welcome content (session list is in the parent wrapper)
    - Remove: `UDashboardSidebarToggle`, `UDashboardSidebarCollapse`, auto-open sidebar logic
    - Keep: agent tiles and unread cards as the desktop empty state

11. **Update `app/pages/chats/[sessionId].vue`**
    - Mobile: add back button in header (`navigateTo('/chats')`, not `history.back()` to handle deep links safely)
    - Remove: `UDashboardSidebarToggle`, `UDashboardSidebarCollapse`
    - Replace `useSidebar().isMobile` with `useNavigationVisibility().isMobile`

12. **Update `app/pages/chats/new/[userId].vue`**
    - Same changes as `[sessionId].vue` — back button on mobile, remove sidebar toggles

**Success criteria:** Full navigation works end-to-end. Mobile shows tab bar on list pages, hides in active chat. Desktop shows rail + master-detail for chats, full-width for other tabs.

---

#### Phase 4: New Pages

**Goal:** Build the Users and Profile pages.

**Tasks:**

13. **Rewrite `app/pages/users.vue`** ✅
    - Extract user list UI from old `default.vue` sidebar "users" accordion
    - Full-page user list with search, avatars, online status indicators
    - Click handler: navigate to existing primary session or `/chats/new/[userId]`
    - Mobile: full-width + tab bar visible
    - Desktop: full-width (rail visible, no split)

14. **Create `app/pages/profile.vue`** ✅
    - Content (migrated from sidebar footer + new):
      - User info display (name, email, avatar from `useAuthStore().user`)
      - Locale toggle (EN/HU) — move from sidebar footer
      - Color mode toggle (light/dark) — move from sidebar footer
      - SignalR connection status indicator — move from sidebar footer
      - Logout button with loading state — move from sidebar footer
    - Mobile: full-width + tab bar visible
    - Desktop: full-width (rail visible, no split)

**Success criteria:** All 3 tabs have content. Users can switch locale, theme, and log out from Profile. SignalR status is visible.

---

#### Phase 5: Cleanup + Polish

**Goal:** Remove old code, fix edge cases, polish.

**Tasks:**

15. **Delete `app/composables/useSidebar.ts`** ✅
    - Verify no remaining imports (should be zero after Phase 3 updates)

16. **Clean up CSS** ✅
    - Remove sidebar-specific CSS variables from `main.css` (`--sidebar`, `--sidebar-foreground`, etc.)
    - Adapt `.sidebar-item` and `.sidebar-item-active` classes for the session list panel (or create new list item classes)
    - Remove `UDashboardSidebar` theme overrides if any

17. **Update `app/middleware/auth.global.ts`** ✅ (verified — already protects all non-`/login` routes)
    - Ensure `/users` and `/profile` routes are protected (they should be, since auth middleware protects all routes except `/login`)
    - Verify redirect after login goes to `/chats` (currently redirects to `/` which redirects to `/chats`)

18. **Fix PWA manifest** ✅
    - Update `start_url` if needed
    - Fix broken shortcuts (`/chat/new` → `/chats`, `/history` → `/users`)

19. **Update keyboard shortcuts** ✅ (no `Cmd+B` shortcut existed in codebase — no-op)
    - Remove `Cmd/Ctrl+B` sidebar toggle (no longer applicable)
    - Consider adding shortcuts for tab switching (stretch goal)

20. **Handle viewport resize transitions** ✅ (handled reactively by `useNavigationVisibility` + `chats.vue` parent wrapper)
    - In `useNavigationVisibility`, watch for breakpoint crossing
    - If user is on `/chats/[sessionId]` and resizes to desktop: session list panel appears alongside (handled by `chats.vue` parent wrapper automatically)
    - If user resizes to mobile from desktop: bottom tab bar hidden since they're in active chat (correct behavior)

21. **Android back button handling** ✅ (route-based back buttons in `[sessionId].vue` and `new/[userId].vue`)
    - In active chat on mobile: hardware back navigates to `/chats` (replace `useSidebar`'s history.pushState approach with simpler route-based back)
    - On tab pages: hardware back exits the app (standard PWA behavior)

22. **Session list scroll position persistence** ✅ (implemented in `ChatListPanel.vue` via `sessionStorage`)
    - On desktop: parent-route pattern keeps component mounted — scroll position preserved naturally
    - On mobile: use `sessionStorage` to save/restore scroll position (same approach as current sidebar, but now in `ChatListPanel`)

23. **Session context menus on mobile** ✅ (implemented in `ChatListPanel.vue` — always visible on mobile, hover-only on desktop)
    - Make the 3-dot menu button (`SessionItemMenu`) always visible on mobile (not hover-only)
    - On desktop: keep hover-to-reveal behavior

**Success criteria:** No references to `useSidebar`, `UDashboardSidebar`, or `UDashboardGroup` remain. PWA works correctly. All edge cases handled.

## Alternative Approaches Considered

(see brainstorm: `docs/brainstorms/2026-03-07-responsive-navigation-brainstorm.md`)

1. **3-tier rail + drawer expansion** — Rail on tablet, accordion drawer on desktop. Rejected: still feels like a dashboard, not a modern app.
2. **Keep sidebar + add bottom nav for mobile only** — Minimal code change. Rejected: user explicitly wants to move away from the current sidebar UX.
3. **NavigationMenu with responsive orientation swap** — Single component switching horizontal/vertical. Rejected: doesn't solve master-detail for chats.

## System-Wide Impact

### Interaction Graph

- **Layout change** → All authenticated pages affected (they all use `default.vue`)
- **Route addition** → Auth middleware must protect `/users` and `/profile` (already does — protects all except `/login`)
- **Data fetching redistribution** → `useUnreadMessageCounts()` stays global (layout); `useChatSessions()` moves to `chats.vue`/`ChatListPanel`; `useSelectableUsers()` moves to `users.vue`
- **SignalR cache invalidation** → Still works via Vue Query — no changes needed since composables stay the same, just called from different components
- **Public mode** → Completely unaffected (uses `public.vue` layout)

### Error Propagation

- Session list fetch errors → Handled by Vue Query's `isError` state in `ChatListPanel` (same as current sidebar)
- Unread count fetch errors → Badge silently hides (graceful degradation)
- Navigation to deleted session → Existing 404/403 handling in `[sessionId].vue` redirects to `/chats`

### State Lifecycle Risks

- **Session list unmount on mobile tab switch:** TanStack Query cache preserves data. Remounting Chats tab uses cached data (staleTime prevents refetch). Scroll position needs explicit `sessionStorage` persistence.
- **Parent-route unmount when leaving Chats entirely:** `chats.vue` unmounts when navigating to `/users` or `/profile`. Session list component unmounts but Query cache persists. Re-entering `/chats` re-renders from cache.

### API Surface Parity

No API changes. All existing service calls remain the same, just called from different component locations.

### Integration Test Scenarios

1. **Mobile flow: Chats → open session → back → switch to Users → click user → new chat opens → back** — Verify tab state, navigation history, and data preservation at each step.
2. **Desktop flow: Click rail icons → verify content changes, session list panel appears/disappears per tab** — Verify master-detail only on Chats, full-width on others.
3. **Deep link: Load `/chats/[sessionId]` directly on mobile** — Verify back button navigates to `/chats` (not browser back which would exit).
4. **Viewport resize: View chat on mobile → resize to desktop** — Verify session list panel appears alongside chat content.
5. **Real-time: Receive message while on Users tab** — Verify Chats badge updates.

## Acceptance Criteria

### Functional Requirements

- [ ] Mobile: bottom tab bar with 3 tabs (Chats, Users, Profile) visible on list pages
- [ ] Mobile: tab bar hidden when inside active chat (`/chats/[sessionId]`, `/chats/new/[userId]`)
- [ ] Mobile: back button in chat header navigates to `/chats`
- [ ] Desktop: left icon rail (~64px) always visible on authenticated routes
- [ ] Desktop: tooltips on rail icon hover (side="right")
- [ ] Desktop: Chats tab shows master-detail (session list panel + chat content)
- [ ] Desktop: Users and Profile tabs show full-width content
- [ ] Numeric unread badge on Chats icon (capped at "99+", hidden when 0)
- [ ] Profile page contains: user info, locale toggle, color mode toggle, SignalR status, logout
- [ ] Users page contains: search, user list with avatars and online status
- [ ] Session list panel (desktop) preserves scroll position and search state across session navigation
- [ ] Public mode layout completely unaffected
- [ ] Cross-tab navigation: clicking a user in Users tab navigates to Chats (tab highlight follows route)

### Non-Functional Requirements

- [ ] PWA safe area insets handled (`viewport-fit=cover`, bottom padding)
- [ ] Accessibility: `role="navigation"` + `aria-label` on nav containers, `aria-current="page"` on active items
- [ ] Accessibility: all icon-only buttons have `aria-label`
- [ ] Android back button: navigates to `/chats` from active chat, exits app from tab pages
- [ ] No references to `useSidebar`, `UDashboardSidebar`, or `UDashboardGroup` remain in codebase
- [ ] Session context menus accessible on mobile (always-visible trigger, not hover-only)

### Quality Gates

- [ ] All existing tests pass (update as needed for new component structure)
- [ ] Manual test on mobile viewport (Chrome DevTools) and desktop
- [ ] PWA install and launch tested
- [ ] i18n: all new UI text has en/hu translations

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Parent-route pattern complexity | Prototype `chats.vue` wrapper early (Phase 1). Verify mounting behavior before building on it. |
| Large layout rewrite | Phase 3 is the big-bang change. Keep Phase 1-2 additive (new files only) so rollback is easy. |
| Session list data migration | Extract to `useChatListData.ts` composable first (Phase 1), then swap consumers. TanStack Query cache makes this safe. |
| Safe area insets affecting existing pages | Add `viewport-fit=cover` early (Phase 2) and audit existing pages before the full layout swap. |
| Mobile scroll position loss | Implement `sessionStorage` persistence in `ChatListPanel` (same proven approach as current sidebar). |

## Success Metrics

- Navigation feels "app-like" on mobile — tab bar is responsive, transitions are instant
- Desktop master-detail works smoothly — session list stays in place while switching chats
- No UX regressions: unread indicators, session search, user search, context menus all work
- Codebase is simpler: `default.vue` shrinks from 505 lines to ~50 lines

## Future Considerations

- **Transition animations:** Slide transitions between tab pages on mobile (deferred — instant swap is fine for v1)
- **Resizable session list panel:** Add `UDashboardPanel` with resize handle for the desktop Chats split (v1 uses fixed width)
- **User avatar in rail:** Show the authenticated user's avatar at the bottom of the rail
- **Notification dot on Users tab:** Show indicator when a user comes online
- **Desktop drawer expansion (lg breakpoint):** If desired later, the rail could expand to show labels at >=1024px. Deferred per brainstorm — rail-only is the v1 design.

## Documentation Plan

- Update `ai-docs` / project skill files to reflect the new navigation architecture
- Update component directory references

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-07-responsive-navigation-brainstorm.md](docs/brainstorms/2026-03-07-responsive-navigation-brainstorm.md) — Key decisions carried forward: app shell pattern, 2-tier responsive design, sidebar full replacement, master-detail only for Chats tab

### Internal References

- Current layout: `app/layouts/default.vue` (505 lines — to be rewritten)
- Current sidebar composable: `app/composables/useSidebar.ts` (144 lines — to be removed)
- Session list UI: `app/layouts/default.vue:76-215` (accordion content to extract)
- Footer actions: `app/layouts/default.vue:220-251` (to move to Profile page)
- Chat page sidebar integration: `app/pages/chats/[sessionId].vue:6-7` (toggle/collapse to remove)
- Users page stub: `app/pages/users.vue` (to rewrite)
- CSS sidebar styles: `app/assets/css/main.css:239-265` (to adapt/replace)

### External References

- Nuxt UI v4 components: NavigationMenu, Tooltip, Chip, DashboardPanel
- WAI-ARIA navigation landmark: `role="navigation"` with `aria-label` for route-based nav
- PWA safe area: `viewport-fit=cover` + `env(safe-area-inset-bottom)`
- Nuxt parent-route pattern for persistent master-detail layouts
