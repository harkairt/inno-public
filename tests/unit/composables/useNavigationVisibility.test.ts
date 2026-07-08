/**
 * Unit tests for useNavigationVisibility — visibility matrix across viewport
 * width (@vueuse/core useWindowSize), route name (vue-router useRoute), auth
 * state (real Pinia via authSeed) and public mode (real config store).
 *
 * The composable imports useWindowSize/useRoute directly from their libraries
 * (not the Nuxt auto-import globals), so those two are mocked here with
 * controllable refs; the auth + config stores stay real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useNavigationVisibility } from '@/app/composables/useNavigationVisibility'
import { useConfigStore } from '@/app/stores/config'
import { seedAuthStorage } from '@/tests/utils/authSeed'

const widthRef = ref(1280)
const routeRef = ref<{ name: string | undefined }>({ name: 'chats' })

vi.mock('@vueuse/core', () => ({
  useWindowSize: () => ({ width: widthRef, height: ref(800) }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef.value,
}))

beforeEach(() => {
  widthRef.value = 1280
  routeRef.value = { name: 'chats' }
})

describe('useNavigationVisibility', () => {
  it('shows the rail on desktop when authenticated and not public', () => {
    seedAuthStorage()
    widthRef.value = 1280
    routeRef.value = { name: 'chats' }

    const { isMobile, showRail, showBottomTabBar } = useNavigationVisibility()

    expect(isMobile.value).toBe(false)
    expect(showRail.value).toBe(true)
    expect(showBottomTabBar.value).toBe(false)
  })

  it('shows the bottom tab bar on mobile list routes when authenticated', () => {
    seedAuthStorage()
    widthRef.value = 500

    const { isMobile, showRail, showBottomTabBar } = useNavigationVisibility()

    expect(isMobile.value).toBe(true)
    expect(showRail.value).toBe(false)
    expect(showBottomTabBar.value).toBe(true)
  })

  it('hides the bottom tab bar on an active chat route (mobile)', () => {
    seedAuthStorage()
    widthRef.value = 500
    routeRef.value = { name: 'chats-sessionId' }

    const { isActiveChat, showBottomTabBar } = useNavigationVisibility()

    expect(isActiveChat.value).toBe(true)
    expect(showBottomTabBar.value).toBe(false)
  })

  it('treats new-userId as an active chat route', () => {
    seedAuthStorage()
    widthRef.value = 500
    routeRef.value = { name: 'chats-new-userId' }

    const { isActiveChat, showBottomTabBar } = useNavigationVisibility()

    expect(isActiveChat.value).toBe(true)
    expect(showBottomTabBar.value).toBe(false)
  })

  it('hides all navigation when unauthenticated', () => {
    // No seed → store hydrates logged-out.
    widthRef.value = 1280

    const { showRail, showBottomTabBar } = useNavigationVisibility()

    expect(showRail.value).toBe(false)
    expect(showBottomTabBar.value).toBe(false)
  })

  it('hides rail and tab bar in public mode even when authenticated', () => {
    seedAuthStorage()
    const configStore = useConfigStore()
    configStore.config.publicMode = 1

    const { showRail, showBottomTabBar } = useNavigationVisibility()

    expect(showRail.value).toBe(false)
    expect(showBottomTabBar.value).toBe(false)
  })

  it('handles a missing route name (isActiveChat false)', () => {
    seedAuthStorage()
    widthRef.value = 500
    routeRef.value = { name: undefined }

    const { isActiveChat, showBottomTabBar } = useNavigationVisibility()

    expect(isActiveChat.value).toBe(false)
    expect(showBottomTabBar.value).toBe(true)
  })
})
