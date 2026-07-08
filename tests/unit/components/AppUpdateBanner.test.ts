/**
 * AppUpdateBanner — drives usePWAUpdate to show/hide the banner and fire the
 * refresh action.
 *
 * usePWAUpdate is a thin singleton over the @vite-pwa virtual module (aliased to
 * tests/stubs/pwaRegister.ts). Its module-level `needRefresh` is synced from the
 * stub only after an async dynamic import + watch resolves, and the singleton is
 * shared across a file's tests — too fiddly to drive deterministically per test.
 * So we vi.mock the composable to expose a controllable `needRefresh` ref + an
 * `applyUpdate` spy and assert the click wiring, per the B5 fallback guidance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import { ref, type Component } from 'vue'

const mocks = vi.hoisted(() => ({
  needRefresh: null as unknown as ReturnType<typeof ref<boolean>>,
  applyUpdate: null as unknown as ReturnType<typeof vi.fn>,
}))

vi.mock('~/composables/usePWAUpdate', () => ({
  usePWAUpdate: () => ({ needRefresh: mocks.needRefresh, applyUpdate: mocks.applyUpdate }),
}))

beforeEach(() => {
  mocks.needRefresh = ref(false)
  mocks.applyUpdate = vi.fn(() => Promise.resolve())
})

const stubs = {
  // Renders the title text and exposes the #actions slot + a close trigger.
  UAlert: {
    name: 'UAlert',
    props: ['title', 'description'],
    template:
      '<div data-testid="update-alert"><span>{{ title }}</span>' +
      '<button data-testid="close-btn" @click="$emit(\'close\')"></button>' +
      '<slot name="actions" /></div>',
  },
  // No explicit @click emit: the parent's `@click` falls through as a native
  // listener on this single-root button, so a DOM click already invokes it.
  UButton: {
    name: 'UButton',
    props: ['label'],
    template: '<button data-testid="refresh-btn">{{ label }}</button>',
  },
}

async function renderBanner() {
  const { default: AppUpdateBanner } = (await import('~/components/AppUpdateBanner.vue')) as {
    default: Component
  }
  return render(AppUpdateBanner, { global: { stubs } })
}

describe('AppUpdateBanner — visibility', () => {
  it('hides the banner when no update is pending', async () => {
    mocks.needRefresh.value = false
    await renderBanner()
    expect(screen.queryByTestId('update-alert')).toBeNull()
  })

  it('shows the banner when an update is available', async () => {
    mocks.needRefresh.value = true
    await renderBanner()
    expect(screen.getByTestId('update-alert')).toBeTruthy()
    // t() is the identity stub → the i18n key renders as-is.
    expect(screen.getByText('pwa.updateAvailable')).toBeTruthy()
  })

  it('dismisses the banner when the alert emits close', async () => {
    mocks.needRefresh.value = true
    await renderBanner()
    await fireEvent.click(screen.getByTestId('close-btn'))
    expect(screen.queryByTestId('update-alert')).toBeNull()
  })
})

describe('AppUpdateBanner — refresh action', () => {
  it('calls applyUpdate when the refresh button is clicked', async () => {
    mocks.needRefresh.value = true
    await renderBanner()
    await fireEvent.click(screen.getByTestId('refresh-btn'))
    expect(mocks.applyUpdate).toHaveBeenCalledTimes(1)
  })
})
