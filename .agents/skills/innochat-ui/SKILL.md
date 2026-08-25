---
name: innochat-ui
description: Use whenever changing anything the user sees in InnoChat — adding or modifying components, templates, styles, icons, buttons, modals, lists, sidebars, loading/empty/error states, animations, or layout. Applies even to "small" tweaks like adding a button, showing/hiding an element, or picking an icon. Covers motion, alignment, component reuse, design consistency, mobile/narrow-viewport support, and accessibility. Triggers on "add button", "new component", "show", "hide", "toggle", "modal", "sidebar", "panel", "icon", "animate", "transition", "style", "redesign", "layout", "toast", "loading state", "empty state", "responsive", "mobile", "viewport", "breakpoint", "touch", "UI", "UX".
---

# InnoChat UI Implementation

InnoChat has an established design language ("Elemtár": warm off-white surfaces, petrol/teal brand, soft shadows, rounded cards, Figtree + Bricolage Grotesque). A UI change is done when it looks like it was always part of the app — on desktop and mobile, in light and dark mode, with a keyboard and with a screen reader.

## 1. Reuse before building

Hand-rolled UI is the main source of inconsistency: it misses theme tokens, dark mode, keyboard handling, and ARIA that existing components already carry.

- Scan `app/components/` first — there may already be a component for the job (`SearchInput`, `UserAvatar`, `TypingIndicator`, `MessageBubble`, `SessionListItem`, `FileEntry`, …).
- The app uses Nuxt UI v4. Components already in use: `UButton`, `UIcon`, `USkeleton`, `UInput`, `UTextarea`, `UAlert`, `UTooltip`, `UEmpty`, `USelect`, `UModal`, `UTabs`, `UCheckbox`, `UCard`, `UAvatar`, `UTable`, `USlider`, `UPopover`, `UPagination`, `UFieldGroup`, `UDropdownMenu`, `UBadge`, plus `useToast()`. Reach for these before writing markup.
- Never hand-roll dropdowns, modals, tooltips, popovers, toasts, or skeletons — the Nuxt UI versions handle focus trapping, Esc/click-outside, and portals.
- Unsure about a component's props/slots/variants? Use the `nuxt-ui-remote` MCP tools (`search-components`, `get-component`) when available, or read the types under `node_modules/@nuxt/ui`.
- Customize via the component's `color`/`variant`/`size`/`:ui` props, not by wrapping it in override CSS.

Existing utility classes to reuse instead of reinventing: `card-warm` (white card with hairline border), `hover-lift`, `bubble-sent` / `bubble-received`, `sidebar-item` / `sidebar-item-active`, `font-display` (see `app/assets/css/main.css`).

## 2. Motion — every state change animates, subtly

Elements that pop in or vanish instantly feel broken; a short fade+slide tells the user what appeared, from where, and why. But motion is seasoning: 150–300 ms, 4–10 px of travel, opacity + transform only.

Default recipe for showing/hiding anything (`v-if`/`v-show`):

```vue
<Transition
  enter-active-class="transition duration-200 ease-out"
  enter-from-class="opacity-0 translate-y-1"
  enter-to-class="opacity-100 translate-y-0"
  leave-active-class="transition duration-150 ease-in"
  leave-from-class="opacity-100 translate-y-0"
  leave-to-class="opacity-0 translate-y-1"
>
  <div v-if="visible">…</div>
</Transition>
```

- Enter slower with `ease-out`, leave faster with `ease-in` — things should arrive gently and get out of the way quickly. Canonical example: `app/components/AppUpdateBanner.vue`.
- Slide direction should match spatial origin: from a top banner use `-translate-y-*`, from a sidebar `translate-x-*`, for inline content `translate-y-1`.
- List items appearing/disappearing/reordering: `<TransitionGroup>` with the same classes.
- Hover/press feedback: `transition-colors duration-150` is the repo norm; `hover-lift` for cards.
- `tailwindcss-animate` is loaded (`animate-in fade-in slide-in-from-bottom-1` utilities work), and main.css defines Elemtár keyframes `fade-in`, `fadeUp`, `popIn`, `slideL` — reuse before writing new keyframes.
- Animate only `opacity` and `transform`. Animating width/height/margin/top causes layout thrash and jank on mobile; if you truly must animate size, keep it rare and short.
- Don't animate initial page content on every render — entrance animations are for state *changes* (something appeared because the user or server did something), plus deliberate one-time reveals. Route-level transitions already exist in `app/pages/chats.vue`.

### Reduced motion

`main.css` has a global `@media (prefers-reduced-motion: reduce)` guard that collapses all CSS animations/transitions — CSS motion needs **no** per-class `motion-safe:` handling. But the guard cannot reach JS-driven motion. Gate programmatic animation (e.g. `scrollIntoView({ behavior: 'smooth' })`, chart/ECharts animations, rAF loops) yourself:

```ts
import { usePreferredReducedMotion } from '@vueuse/core'
const reducedMotion = usePreferredReducedMotion() // Ref<'reduce' | 'no-preference'>
el.scrollIntoView({ behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth' })
```

### Gotcha: the global `fade` transition

`<Transition name="fade">` exists globally, but `.fade-leave-active` is `position: absolute; inset: 0` — designed for crossfades inside a `relative` container (see `ChatListPanel.vue`). Outside that context the leaving element will overlay its siblings. When in doubt, use the inline Tailwind-class recipe above instead.

## 3. Alignment — icons and text sit on one centerline

Misaligned icon-next-to-text is the most visible "AI-built" tell. Rules:

- Any row mixing icons, buttons, avatars, and text: `flex items-center gap-2` (roomier rows: `gap-3`). Never rely on inline/baseline alignment or ad-hoc margins for this.
- Prefer the component's own icon slot over manual composition: `<UButton icon="i-heroicons-plus" :label="t('…')">`, `<UInput icon="…">` — alignment comes free and stays correct across sizes.
- When composing manually, give icons `shrink-0` (they must never squash) and the text `truncate min-w-0` if it can overflow.
- Icon sizes: `size-4` inline with text, `size-5` for standalone/nav icons, `size-3.5` for dense metadata rows — match the neighbors, don't introduce a new size.
- Stick to the spacing scale already in use: `gap-0.5 / 1 / 1.5 / 2 / 2.5 / 3 / 4`.

## 4. Mobile & narrow viewports — first-class, not an afterthought

The app ships to phones as much as desktops, and public mode runs inside iframes that can be arbitrarily narrow. A change that only works at desktop width is half-done.

- Layout must collapse gracefully: no fixed content widths (`w-[600px]`) — use `w-full max-w-*`. Unprefixed classes are the narrow layout; widen with `md:` / `lg:` (mobile-first, the Tailwind default).
- Branching in script/template: `const { isMobile } = useNavigationVisibility()` (viewport < 768 px, reactive) — the established composable. Don't hand-roll `window.innerWidth` checks or invent new breakpoints; 768 matches Tailwind's `md:`.
- **Hover does not exist on touch.** Anything revealed by `group-hover:` must be reachable on mobile — always visible or behind an explicit menu. Exemplar: `ChatListPanel.vue` — `:class="isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"`. Tooltips are enhancement only, never the sole carrier of information.
- The page itself never scrolls horizontally. Wide content (tables, code, charts) scrolls inside its own `overflow-x-auto` container (`MarkdownTableWrapper` is the exemplar); long unbreakable strings get `truncate` or `break-all`.
- Full-height regions: the app shell is `h-dvh` with `overflow: hidden` (mobile keyboard handling) and inner regions scroll. Never `h-screen` / `100vh` — it breaks under mobile browser chrome and the on-screen keyboard.
- Elements pinned to the bottom edge need `padding-bottom: env(safe-area-inset-bottom)` (see `AppBottomTabBar.vue`) so they clear the home indicator.
- Root font-size is 18 px below 768 px (`main.css`), so rem-based sizes intentionally render larger on mobile — don't compensate with px values.
- Navigation lives in two components: `AppRail` (desktop) and `AppBottomTabBar` (mobile), toggled in `app/layouts/default.vue`. A new navigation destination goes in **both**.

## 5. Design consistency

The theme is token-driven and partly configured at runtime from `config.json` (white-labeling). Hardcoded colors break dark mode *and* customer theming.

- Colors: only semantic tokens — Nuxt UI props (`color="primary|neutral|error"`) or CSS vars like `bg-[hsl(var(--card))]`, `text-[hsl(var(--muted-foreground))]`, `border-[hsl(var(--border))]`, `bg-[hsl(var(--brand-soft))]`. Never raw hex or Tailwind palette colors (`bg-teal-600`).
- Dark mode: comes free if you used tokens. If you wrote any `dark:` override, that's a smell — look for the right token first.
- Typography: body is Figtree automatically; headings get Bricolage Grotesque via `h1`–`h6` or `.font-display`. Body-text size norm is `text-sm` / `0.9375rem`.
- Surfaces: `rounded-xl`+ cards, hairline `border-[hsl(var(--border))]`, soft shadow tokens (`shadow-xs`…`shadow-lg` map to the warm Elemtár shadows). No harsh black shadows.

### Icons

Heroicons is the house set. Picking an icon from another family or the wrong weight makes it visibly foreign.

- Default to outline: `i-heroicons-trash`, `i-heroicons-pencil-square`.
- Solid variant = active/toggled state of the same icon: `i-heroicons-bookmark` ↔ `i-heroicons-bookmark-solid`, `star` ↔ `star-solid`.
- `-20-solid` variants for dense/small UI (composer, list meta): `i-heroicons-x-mark-20-solid`.
- `i-vscode-icons-*` only for file-type icons; lucide/phosphor only where already established. Never introduce a new icon family when a heroicon exists (`nuxt-ui-remote` `search-icons` helps find one).
- Match the visual weight of neighboring icons — don't put one solid icon in an outline row.

## 6. Interaction states — none may be missing

Every interactive element needs visible hover, focus, active/pressed, and disabled states (Nuxt UI variants provide all four — another reason to reuse). Every async flow needs all three of loading, error, and empty:

- **Pending action**: `<UButton :loading="isPending">` — shows a spinner *and* blocks double-submit. No async button ships without it.
- **Loading data**: `USkeleton` shaped like the final content (see `SessionListItem` usage), so nothing jumps when data lands. Avoid full-area spinners.
- **Empty**: `UEmpty` with an icon, a translated explanation, and an action when one makes sense — never a blank region.
- **Error**: transient action failures → `useToast().add({ color: 'error', … })`; persistent/blocking states → inline `UAlert`. Both translated.
- Long user-generated text (names, titles, filenames): `truncate` + full text via `title` or `UTooltip`.

## 7. Accessibility — non-negotiable checklist

- Interactive = real interactive element: `UButton`/`<button>`/`<a>`. Never `@click` on a `div`/`span` (loses keyboard, focus, and screen-reader semantics in one stroke).
- Icon-only button: translated `aria-label`, and usually a `UTooltip` so sighted users get the same hint.
- Icon that merely decorates adjacent text: `aria-hidden="true"`.
- Never remove focus outlines. The focus ring is styled globally in `main.css` (`focus-visible` → `ring-1`); embedded inputs that must look borderless use `variant="none"` plus the `.composer-pill` / `.inline-plain-text` marker-class pattern — don't fight the ring with `outline-none`.
- Regions that update asynchronously (connection status, streaming): `aria-live="polite"` / `role="status"` (exemplar: `SignalRConnectionStatus.vue`).
- Touch targets ≥ ~44 px on mobile — this app is first-class touch. Pad small icon buttons (`p-2`) rather than shrinking them; check hit area, not icon size.
- Text must stay readable: don't go lighter than `--muted-foreground` on normal backgrounds.
- Images and avatars need `alt`; `UAvatar` handles it via `alt`.
- In tests, query by role and accessible name (`getByRole('button', { name: … })`) — if a test can't find it that way, a screen reader can't either. See the `innochat-testing` skill.

## 8. Text & i18n

- Every user-visible string goes through `t()`. Add keys to **both** `i18n/locales/en.json` and `i18n/locales/hu.json` — Hungarian is the default locale, so a missing `hu` key is what users actually see.
- No hardcoded English fallbacks in templates, `aria-label`s, toasts, or empty states.

## 9. Verify before calling it done

1. `npm run typecheck` and `npm run lint`.
2. Look at it in the browser preview: light **and** dark mode, desktop **and** mobile width (`resize_window`).
3. If you added motion: sanity-check it's subtle (nothing travels far or bounces), and that the feature still works with reduced motion (DevTools → emulate `prefers-reduced-motion`).
4. Tab through new interactive elements — visible focus, sensible order, Esc closes overlays.
