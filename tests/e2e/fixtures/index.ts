/**
 * Combined E2E Test Fixtures
 * Re-exports auth fixtures and adds api-mock utilities
 */

// Re-export auth fixtures and expect
export { test, expect } from './auth'
export type { AuthFixtures } from './auth'

// Re-export API mock utilities
export * from './api-mocks'
