---
name: innochat-mutation-triage
description: Use when reading a Stryker mutation-testing report for InnoChat and deciding which surviving mutants deserve new tests. Turns a mutation score into a pragmatic test-improvement plan without overfitting tests to implementation. Triggers on "mutation testing", "stryker", "mutation score", "survived mutant", "kill mutant", "test:mutation", "reports/mutation", "improve tests from mutation", "which tests to add", "mutation report".
---

# InnoChat Mutation-Triage Guide

Stryker mutation testing (advisory, nightly — see `stryker.config.json`, run with
`npm run test:mutation`) injects small bugs into source and reruns the suite. A
**survived** mutant means a test executed that code but no assertion noticed the bug.
That is a real signal about assertion quality — but acting on every survivor blindly
produces brittle, overfit tests. This skill is the decision procedure for turning the
report into a small, high-value set of test changes.

The goal is not a high number. **Mutation score is a spotlight, not a target.** The
moment you optimize the score itself, you invert the tool into an overfit generator.

---

## Read the report first

Open `reports/mutation/mutation.html` (per-mutant diffs + which tests ran) or read the
terminal table. Two score columns matter and they mean different things:

| Score | Formula | Tells you |
|---|---|---|
| **total** | `killed / (killed + survived + no-cov)` | Mixes coverage gaps into the number |
| **covered** | `killed / (killed + survived)` | Pure assertion quality on code tests reach |

**Ratchet and reason about `covered`, not `total`.** `total` punishes you for code no
test runs; that is a coverage decision (deliberately unfilled areas are fine). `covered`
isolates the thing mutation testing uniquely measures: do the tests that *run* the code
actually *check* its result.

Mutant states and what each demands:

- **survived** — assertion gap. An existing test reaches the line but tolerates the bug.
  Fix by strengthening an assertion.
- **no cov** — coverage gap. No test runs the line. Fix by writing a test (or decide the
  code is out of scope). Different fix from survived — don't conflate them.
- **timeout** — counts as killed (the bug caused a hang the runner caught).
- **errors** — mutant broke compile/runtime; excluded from score. Ignore.

---

## The overfitting trap (yes, it's real)

Chasing survivors to zero produces tests that pin *implementation* instead of *behavior*.
Two failure modes:

**Equivalent mutants** — change the code without changing observable behavior. No test
*should* distinguish them, and 100% is therefore unreachable by design.

```ts
for (let i = 0; i < arr.length; i++)   // mutant: i <= arr.length - 1 — same behavior
```

**Killing via internals** — technically kills the mutant, but couples the test to how the
code works, so it breaks on any honest refactor.

```ts
// survivor: .join('') → .join('X')
expect(spy).toHaveBeenCalledWith('')   // BAD — pins the implementation
expect(initials).toBe('AB')            // GOOD — pins the behavior; also kills the mutant
```

The good kill doubles as documentation: `toBe('AB')` for a 3-word name records the
"cap initials at 2" rule. The spy kill records nothing but today's code.

---

## Decision procedure — per surviving mutant

Ask three questions **in order**. Stop at the first that resolves it.

1. **Is it equivalent?** Could *any* input distinguish original from mutant? If no → skip
   it. Annotate so it stops nagging (see below). Do not invent a test for it.
2. **Would a real bug here be noticed?** "If this line were genuinely wrong, would a user
   or caller observe it?" If no (log strings, defensive branches for impossible states,
   cosmetic formatting) → skip.
3. **Can I kill it through a public observable** — return value, thrown `AppError`, emitted
   event, rendered output, store state — rather than a spy on an internal? If yes → write
   that test. If the only way to kill it is asserting on internals → usually don't; you'd
   be testing plumbing.

Only mutants that clear #2 **and** #3 earn a test.

---

## Prioritize by blast radius — don't sweep

Not all survivors are equal. In this repo, rank them:

| Priority | Where | Why |
|---|---|---|
| **High** | `lib/` domain logic, `Result`/`AppError` branches, `lib/validation` (Zod), auth token/refresh, SignalR cache updates | Silent bugs here are costly; exactly what tests exist for |
| **Medium** | composable state transitions (`app/composables/`), store mutations (`app/stores/`) | User-visible, but often already integration-covered via MSW |
| **Low / skip** | thin config wrappers (e.g. `app/utils/sanitize.ts` — a DOMPurify options object), formatting helpers, pass-throughs | Low bug cost; killing usually means asserting trivia |
| **Ignore** | equivalent mutants, log messages, unreachable defensive branches | Overfit territory |

A low `covered` score on a config wrapper is *fine to leave*. A survivor on a real
behavioral rule (a cap, a boundary, an error path) is worth a behavioral test. Judge by
what a bug would cost, not by the color in the report.

---

## Tools that fight overfit directly

- **`// Stryker disable next-line <mutator> : <reason>`** — annotate a known-equivalent or
  intentionally-untested mutant in the source. This documents the *decision* (with a
  reason) instead of silently tolerating a red cell, and stops it reappearing every run.
- **`ignoreStatic: true`** in `stryker.config.json` — drops mutants in static initializers
  (config objects like `sanitize.ts`) that inflate survivor noise without pointing at real
  logic. Enable if that noise dominates the report.

---

## Gate policy for this repo

Mutation testing is **advisory** (`break: null`) on purpose — measure before enforcing,
matching the knip/jscpd pattern. When ratcheting toward a gate, follow the same discipline
the coverage waves use (see `vitest.config.ts`: `floor(actual − 2)`, never lowered):

- Gate on **`covered`**, not `total`.
- Set `break` **well below** the observed score (≈60–70%, not 90+) so the gate never forces
  killing equivalent or low-value mutants. Leave headroom for the noise floor.
- Raise it only when real behavioral tests move the number — never to chase the ceiling.

---

## Worked example (from the pilot run)

`app/utils/user.ts` scored 66.67% `covered`, two survivors:

- `.slice(0, 2)` deleted → survived. Tests used names yielding ≤2 initials, so the cap
  never triggered. **High-value kill:** add a 3-word-name case, `expect(initials).toBe('AB')`.
  Behavioral, documents the rule.
- `.join('')` → `.join('X')` → survived. Test only checked initials *appeared*, not the
  exact string. **Tighten the existing assertion** to `toBe(...)` — no new test needed.

`app/utils/sanitize.ts` scored 24.62% — left as-is. It's a DOMPurify config object; a
flipped flag rarely maps to a defect worth a brittle test. Candidate for `ignoreStatic` or
a documented `Stryker disable`.

Bottom line: **triage, don't sweep.** High-value logic gets behavioral tests; config and
equivalent survivors get annotated or ignored. The number serves the tests, never the reverse.
