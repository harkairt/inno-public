import { ref, computed, readonly, watch, type Ref } from 'vue'
import { useWindowSize } from '@vueuse/core'

// Global state to sync with UDashboardSidebar
const globalCollapsedRef = ref(false)
const globalOpenRef = ref(false)

// Track if we've pushed a history state for the sidebar
let sidebarHistoryPushed = false

// Track if we're closing due to navigation (should not trigger history.back())
let closingForNavigation = false

export const useSidebar = () => {
  const { width } = useWindowSize()

  // Detect if we're on mobile (below 768px for md breakpoint)
  const isMobile = computed(() => width.value < 768)

  // Handle Android back button via popstate event
  const handlePopState = (event: PopStateEvent) => {
    // Check if sidebar is open and this is a sidebar-related navigation
    if (globalOpenRef.value && event.state?.sidebarOpen !== true) {
      // Close the sidebar instead of navigating back
      globalOpenRef.value = false
      sidebarHistoryPushed = false
    }
  }

  // Setup back button handling
  const setupBackButtonHandler = () => {
    if (typeof window === 'undefined') return

    window.addEventListener('popstate', handlePopState)
  }

  // Cleanup back button handling
  const cleanupBackButtonHandler = () => {
    if (typeof window === 'undefined') return

    window.removeEventListener('popstate', handlePopState)
  }

  // Register the layout's state refs and keep them in sync
  const registerSidebarState = (collapsedRef: Ref<boolean>, openRef: Ref<boolean>) => {
    // Sync global state to local refs
    watch(globalCollapsedRef, (value) => {
      collapsedRef.value = value
    })

    watch(globalOpenRef, (value) => {
      openRef.value = value
    })

    // Sync local refs to global state
    watch(collapsedRef, (value) => {
      globalCollapsedRef.value = value
    })

    watch(openRef, (value) => {
      globalOpenRef.value = value

      // Handle history state for Android back button
      if (typeof window === 'undefined') return

      if (value && !sidebarHistoryPushed) {
        // Sidebar opened - push a history state
        window.history.pushState({ sidebarOpen: true }, '')
        sidebarHistoryPushed = true
      } else if (!value && sidebarHistoryPushed && !closingForNavigation) {
        // Sidebar closed programmatically (not via back button or navigation)
        // Go back to remove the history entry we added
        sidebarHistoryPushed = false
        window.history.back()
      }
    })

    // Setup back button handler when registering state
    setupBackButtonHandler()

    // Note: cleanup should be handled by the component using onUnmounted
  }

  // Toggle based on current breakpoint
  const toggleSidebar = () => {
    if (isMobile.value) {
      // On mobile, toggle the slideover open state
      globalOpenRef.value = !globalOpenRef.value
    } else {
      // On desktop, toggle the collapsed state
      globalCollapsedRef.value = !globalCollapsedRef.value
    }
  }

  // Directly set the mobile slideover open state
  const setSidebarOpen = (value: boolean) => {
    globalOpenRef.value = value
  }

  // Close sidebar due to navigation (skips history.back() to avoid undoing navigation)
  const closeSidebarForNavigation = () => {
    if (!globalOpenRef.value) return
    closingForNavigation = true
    globalOpenRef.value = false
    // Clear history state without calling back() since navigation already changed history
    sidebarHistoryPushed = false
    closingForNavigation = false
  }

  // Directly set the desktop collapsed state
  const setCollapsed = (value: boolean) => {
    globalCollapsedRef.value = value
  }

  // Handle resize transition: when going to desktop, always expand
  const handleResize = () => {
    if (!isMobile.value) {
      // On desktop, always keep sidebar expanded
      globalCollapsedRef.value = false
    }
  }

  return {
    collapsed: readonly(globalCollapsedRef),
    open: readonly(globalOpenRef),
    isMobile: readonly(isMobile),
    toggleSidebar,
    setSidebarOpen,
    closeSidebarForNavigation,
    setCollapsed,
    handleResize,
    registerSidebarState,
    cleanupBackButtonHandler
  }
}
