---
date: 2026-03-07
topic: responsive-navigation
---

# Responsive Navigation: App Shell Pattern

## What We're Building

Replace the current `DashboardSidebar` with a modern app-shell navigation inspired by Telegram/WhatsApp/Slack:

### Mobile (<768px) -- Bottom Tab Bar + Stacked Pages

- Bottom tab bar with 3 destinations: Chats, Users, Profile
- Each tab is a **full-page view** (session list page, user list page, profile page)
- Tapping a chat session navigates to a **full-screen chat** (bottom nav hidden, back button in header)
- Numeric unread badge on the Chats icon

### Desktop (>=768px) -- Left Rail + Content

- Narrow icon rail (~64px) always visible on the far left with tooltips on hover
- **Chats tab:** Master-detail split -- session list panel + chat content area
- **Users tab:** Full-width user list (no split)
- **Profile tab:** Full-width profile/settings (no split)

### Visual Overview

```
MOBILE                   DESKTOP: Chats tab         DESKTOP: Users tab
┌───────────────┐        ┌───┬─────────┬────────┐   ┌───┬──────────────────┐
│  Chats        │        │💬 │ Sessions│ Chat   │   │💬 │ User list (full) │
│  ┌───────────┐│        │👥 │ list    │ area   │   │👥 │                  │
│  │ Session A ││        │👤 │         │        │   │👤 │                  │
│  │ Session B ││        │   │         │        │   │   │                  │
│  └───────────┘│        └───┴─────────┴────────┘   └───┴──────────────────┘
├───────────────┤        Rail  Panel     Content     Rail  Full-width
│ 💬   👥   👤 │
└───────────────┘        MOBILE: Active chat
  Tab bar                ┌─────────────────────┐
                         │ ← Session Name      │
                         │─────────────────────│
                         │ Messages...         │
                         │ > Type a message    │
                         │  (no bottom nav)    │
                         └─────────────────────┘
```

## Why This Approach

### Approaches Considered

1. **App shell pattern (chosen)** -- Navigation IS the content at small sizes. Bottom tab bar switches between full pages on mobile. Left rail + content panels on desktop. Only the Chats tab has the master-detail split.

2. **3-tier sidebar (rail + drawer expansion)** -- DashboardSidebar with collapsed (rail) and expanded (drawer with accordion) states. Rejected: still feels like a "dashboard" rather than a modern app.

3. **NavigationMenu with responsive orientation swap** -- Single NavigationMenu component switching horizontal/vertical. Rejected: doesn't solve the master-detail split for chats, and the drawer tier needed a completely different component anyway.

4. **Keep sidebar + add bottom nav** -- Minimal change, reuse existing code. Rejected: user explicitly wants to move away from the current sidebar UX.

### Why App Shell

- Feels like a native app, not a dashboard
- Navigation is intuitive -- tab bar is universally understood
- Master-detail split on desktop is the standard for chat apps
- Clean separation: mobile is page-based (simple), desktop adds the split layout
- Each "section" (chats, users, profile) gets its own full page -- better for future features

## Key Decisions

- **Sidebar fully replaced:** `DashboardSidebar` + `DashboardGroup` are removed entirely.
- **3 navigation destinations:** Chats, Users, Profile (settings nested inside Profile)
- **2-tier responsive design:**
  - `<768px` (mobile): Bottom tab bar + full-page sections + full-screen chat
  - `>=768px` (desktop): Left icon rail + content (master-detail for Chats, full-width for others)
- **Bottom tab bar hidden in active chat on mobile:** `/chats/[sessionId]` is full-screen with a back button in the header.
- **Desktop rail always visible:** Slim icon rail on the far left, with tooltips on hover. Active tab highlighted.
- **Master-detail only for Chats:** Only the Chats tab uses the split layout (session list + chat area). Users and Profile are full-width.
- **Page-based routing:** Session list, user list, and profile are all proper pages with their own routes.

## Architecture Impact

### Routing Structure

| Route | Mobile | Desktop |
|-------|--------|---------|
| `/chats` | Full-page session list + tab bar | Rail + session list panel + empty/welcome state |
| `/chats/[sessionId]` | Full-screen chat (no tab bar, back button) | Rail + session list panel + chat content |
| `/chats/new/[userId]` | Full-screen new chat (no tab bar, back button) | Rail + session list panel + new chat content |
| `/users` | Full-page user list + tab bar | Rail + full-width user list |
| `/profile` | Full-page profile + tab bar | Rail + full-width profile/settings |

### Pages to Create/Modify

| Page | Change |
|------|--------|
| `/chats` (index) | Becomes full session list page (move content from sidebar) |
| `/chats/[sessionId]` | On mobile: full-screen with back button. On desktop: right panel of master-detail. |
| `/users` | **New page** -- full user/contact list with search |
| `/profile` | **New page** -- logout, language toggle, theme switch, connection status |

### Components to Create

| Component | Purpose |
|-----------|---------|
| `AppBottomTabBar.vue` | Mobile bottom tab bar (Chats, Users, Profile) with unread badge |
| `AppRail.vue` | Desktop left icon rail with tooltips and active state |
| `ChatListPanel.vue` | Session list panel (extracted from current sidebar accordion content) |

### Components/Layout to Remove/Modify

| File | Change |
|------|--------|
| `layouts/default.vue` | Complete rewrite: remove DashboardSidebar/Group, implement app shell |
| `composables/useSidebar.ts` | Remove (no longer needed) |

### Layout Structure (default.vue)

```
Mobile:
<div class="flex flex-col h-dvh">
  <main class="flex-1 overflow-auto">
    <slot /> <!-- page content -->
  </main>
  <AppBottomTabBar v-if="showTabBar" />
</div>

Desktop:
<div class="flex h-dvh">
  <AppRail />
  <main class="flex-1 flex overflow-hidden">
    <slot /> <!-- page handles its own split if needed -->
  </main>
</div>
```

## Resolved Questions

- **Unread indicators:** Numeric badge on the Chats icon showing total unread count
- **Rail tooltips:** Yes, tooltips on hover showing labels
- **Public mode:** Unchanged -- keeps current minimal layout, no tab bar/rail
- **Desktop panel sync:** Switching tabs changes the full content area (not just a sub-panel)
- **Transition animation:** Deferred -- can be added later as polish

## Next Steps

-> `/ce:plan` for implementation details
