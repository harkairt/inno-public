<!--
Sync Impact Report:
  Version: 0.1.0 (initial constitution)
  Change Type: MINOR (new constitution created from template)
  Modified Principles: All 10 principles newly defined
  Added Sections:
    - Core Principles (10 principles total)
    - Development Workflow
    - Governance
  Removed Sections: None
  Templates Status:
    ✅ plan-template.md - Constitution Check section aligns with principles
    ✅ spec-template.md - User story prioritization aligns with principle 1
    ✅ tasks-template.md - Test-optional approach aligns with principle 4
  Follow-up TODOs: None - all placeholders filled
  Notes:
    - Initial version based on existing .specify/constitution.md content
    - Ratification date set to today (2025-11-01) as initial adoption
    - All principles mapped from existing file and elaborated
-->

# Vonno Constitution

## Core Principles

### I. Spec Simplification (Task Limit)
When a spec would span for more than 100 tasks then ask/propose a simplification of the feature.

**Rationale**: Large specifications become unmanageable and difficult to review, test, and maintain. Breaking features into smaller, focused increments improves delivery velocity and reduces risk.

### II. Nuxt 4 Architecture
This is a Nuxt 4 project (file-based routing, no SSR, no SSG) that connects to a separate backend.

**Rationale**: Establishing clear architectural boundaries ensures consistent development patterns and prevents architectural drift. Client-side rendering with external API simplifies deployment and scaling.

### III. Modern Stack
We are using the latest packages: Pinia stores, neverthrow, SignalR, zod schema, TanStack Query Vue, vueuse utilities.

**Rationale**: Standardizing on modern, well-maintained libraries ensures code consistency, reduces cognitive load, and leverages community best practices.

### IV. Practical Testing Approach (NON-NEGOTIABLE)
Test coverage is NOT IMPORTANT, but writing testable code for actual business logic is CRUCIAL. 
ONLY GENERATE UNIT TESTS FOR EDGE CASES, only unit tests, SKIP INTEGRATION AND ANY OTHER TYPE OF TESTS
SKIP test coverage metrics, especially no need to test 3rd party packages like how a zod schema parses an object.

**Rationale**: Focus developer effort on testing business logic where bugs have real impact, not on achieving arbitrary coverage metrics or testing library code. Well-structured, testable code matters more than test quantity.

### V. Code Clarity First
Code clarity and cleanness is KEY; code should be easily picked up by a developer.

**Rationale**: Code is read far more often than written. Prioritizing clarity reduces onboarding time, minimizes bugs, and enables faster iteration.

### VI. Simplicity (KISS Principle)
KEEP IT SIMPLE STUPID.

**Rationale**: Simple solutions are easier to understand, maintain, debug, and extend. Complexity should only be introduced when clearly justified by requirements.

### VII. Design: Simple & Sleek
Design should be prepared for flexible layouts! (App will target mobile as well as a PWA) Create the views mobile-first! Design should be very simple, but sleek using `shadcn` and `tailwind`. 

**Rationale**: Consistent UI framework choices ensure visual coherence and speed up frontend development through reusable components.

### VIII. Syntax Quality Assurance
At the end of a code change consult with `@agent-syntax-qa` about the syntactical correctness.

**Rationale**: Automated syntax validation catches errors early and maintains code quality standards without manual review overhead.

### IX. Ignore Vanity Metrics
IGNORE performance metrics, IGNORE vague "succession rate" and such metrics, IGNORE aspects that are controlled by the backend (like latency). DO NOT GENERATE "Success Criteria" and similar requirements that "something should be possible under n seconds" and other bullshit accessibility-like "95% of users successfully click the button" NO NEED for "stress test with 1000 users" kinda things either

**Rationale**: Focus on controllable, meaningful metrics. Backend-controlled concerns are outside frontend scope and should not drive frontend decisions.

### X. Branching & Commit Conventions
All work starts from `develop`. Feature branches: `feat/[name]` - Bugfix branches: `fix/[name]`. MUST follow Conventional Commits format (feat:, fix:, docs:, refactor:, perf:, test:).

**Rationale**: Consistent branch naming and commit conventions enable automated tooling, clear history, and streamlined code review processes.

## Development Workflow

### Feature Development Process
1. All features begin from `develop` branch
2. Create appropriately named branch (`feat/` or `fix/`)
3. Implement changes following Core Principles
4. Consult @agent-syntax-qa for syntax validation
5. Create PR with conventional commit format
6. Merge after approval

### Code Review Requirements
- Code MUST follow Core Principles I-X
- Business logic MUST be testable (even if tests not written)
- Complexity violations MUST be justified in PR description
- Syntax validation via @agent-syntax-qa MUST pass

### Quality Gates
- Syntax validation (automated via @agent-syntax-qa)
- Code clarity review (manual)
- Architectural compliance check (no SSR/SSG, proper Nuxt 4 patterns)
- Commit format validation (conventional commits)

## Governance

### Constitution Authority
This constitution supersedes all other development practices and guidelines. In case of conflict between this document and other documentation, this constitution takes precedence.

### Amendment Process
1. Amendments MUST be proposed with clear rationale
2. Amendments MUST include impact analysis on existing codebase
3. Amendments MUST update all dependent templates and documentation
4. Version number MUST be incremented per semantic versioning rules:
   - **MAJOR**: Backward incompatible governance/principle removals or redefinitions
   - **MINOR**: New principle/section added or materially expanded guidance
   - **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements

### Compliance Review
- All PRs MUST verify compliance with Core Principles
- Complexity (violations of Principle VI) MUST be justified with documented alternatives considered
- Team members MUST consult this constitution when design decisions are unclear

### Runtime Guidance
For day-to-day development guidance beyond governance, developers should reference:
- `.specify/templates/` directory for workflow templates
- Project README.md for setup and tooling
- Nuxt 4 documentation for framework-specific patterns

**Version**: 0.1.0 | **Ratified**: 2025-11-01 | **Last Amended**: 2025-11-01
