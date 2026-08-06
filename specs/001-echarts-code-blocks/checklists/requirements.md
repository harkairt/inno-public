# Specification Quality Checklist: ECharts Code Blocks

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-04
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Iteration 1 — 2026-08-04

Two items failed, both blocked on open questions: `No [NEEDS CLARIFICATION] markers remain`
(FR-018 chart-kind scope, FR-019 block-tag relationship) and `Scope is clearly bounded`.

### Iteration 2 — 2026-08-04 — all items pass

Both questions answered by the user; both markers removed.

**Q1 — chart kinds**: no allowlist. Definitions pass through to the engine unmodified.
The user challenged the premise of an allowlist, correctly: a chart-kind allowlist does not
mitigate any of the actual risks, all of which live in the option surface rather than in the
chart kind. Verified against the official ECharts documentation:

- `tooltip.renderMode` defaults to `'html'` and renders into a DOM element. The docs warn
  that unescaped formatter content "may introduce XSS risks… where malicious code may be
  injected". `valueFormatter` is documented as escaped; plain `formatter` is not. Because
  input is JSON, `formatter` can only be a string — and a string formatter's literal markup
  is rendered. Critically, this bypasses the message-rendering surface's sanitisation, which
  runs before charts draw into their own container.
- `graphic` elements accept `style.image: 'http://…'`, and the `image://url` icon syntax
  applies to symbols, legend icons, toolbox icons, and markPoints — each a third-party fetch.
- `title.link` / `title.target` make chart text navigate.

These became FR-015 (markup, with the sanitisation-gap caveat made explicit), FR-016
(external resources), and FR-017 (navigation) — enforced on **values**, uniformly, regardless
of chart kind. FR-019 states the no-allowlist rule and its rationale; SC-011 pins the benefit
(new chart kinds need no client release); SC-010 pins the guards.

Consequential edits: FR-004 now requires pass-through rather than enumeration; FR-005 drops
the per-series data-point cap in favour of the payload cap alone (series shapes vary by kind);
Key Entities replaces "Supported Chart Kind" with "Unsafe Value"; maps move from
"out of scope by kind" to "rejected by FR-016, surfacing as a localized error".

**Q2 — block-tag relationship**: Option A. `chart.js` keeps its existing rendering path
untouched; the two tags are independent end to end (FR-020). SC-002 (zero visual regression)
is therefore satisfied by construction.

**Accepted trade, recorded in Assumptions**: no allowlist means the charting capability ships
whole rather than tree-shaken. SC-003 was split into cached and first-load figures rather than
left at a single optimistic number. SC-004 (chart-less conversations unaffected) still holds,
since the capability loads only when a chart block is present.

**Informed defaults applied rather than asked** (recorded in Assumptions): JSON as the
definition format, no user-authored charts, no export/fullscreen controls, error degradation
matching current behaviour, accessibility parity with the existing path.

**Superseded 2026-08-04**: "no application-level chart-interaction handling" was one of the
informed defaults above. It was reversed by the clarification session of the same date, which
added User Story 5 and FR-023 through FR-030: an assistant-marked data item may append a
follow-up question to the message composer. The reversal is deliberately narrow — the composer
is the only destination and nothing is ever sent — so the "no chart-level actions" default
(export, fullscreen, copy-definition) still stands.

**Carried into planning, not blocking**: the existing chart component hardcodes two English
error strings, a pre-existing violation of the bilingual principle. Scoped as pre-existing;
FR-008 binds only newly added strings.
