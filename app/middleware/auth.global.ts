export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  const configStore = useConfigStore()
  // Handle publicMode routing and publicAgent validation
  const { isPublicMode, isValidPublicAgent, getPublicChatUrl, publicAgentId } = usePublicMode()

  // List of public routes that don't require authentication
  const publicRoutes = ['/login']

  // Normalize path by removing trailing slash (except for root)
  const normalizedPath = to.path === '/' ? '/' : to.path.replace(/\/$/, '')

  // Check if the destination route is a public chat route
  const isPublicChatRoute = normalizedPath.startsWith('/chats/public/')

  // Check if the destination route is public
  const isPublicRoute = publicRoutes.includes(normalizedPath)

  // PUBLIC MODE HANDLING
  if (isPublicMode.value) {
    // In public mode, block access to non-public-chat routes (except login for auth errors)
    if (!isPublicChatRoute && normalizedPath !== '/login') {
      // Redirect to public chat entry point
      const publicChatUrl = getPublicChatUrl()
      if (publicChatUrl) {
        return navigateTo(publicChatUrl, { replace: true })
      }
    }

    // If accessing public chat route, validate agent ID
    if (isPublicChatRoute) {
      // Extract agentId from /chats/public/new/[agentId] pattern
      const match = normalizedPath.match(/^\/chats\/public\/new\/(\d+)$/)
      if (match && match[1]) {
        const agentIdFromRoute = match[1]
        // If agent ID doesn't match config, redirect to correct one
        if (!isValidPublicAgent(agentIdFromRoute)) {
          const publicChatUrl = getPublicChatUrl()
          if (publicChatUrl) {
            return navigateTo(publicChatUrl, { replace: true })
          }
        }
      }
    }

    // In public mode, skip normal auth checks for public chat routes
    // (the public-auth plugin handles authentication)
    if (isPublicChatRoute) {
      return
    }
  }

  // PRIVATE MODE HANDLING - block public routes
  if (!isPublicMode.value && isPublicChatRoute) {
    // In private mode, redirect public chat routes to login
    return navigateTo('/login', { replace: true })
  }

  // If user is not authenticated and trying to access a protected route
  if (!authStore.isAuthenticated && !isPublicRoute) {
    // Save the intended destination to redirect after login
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }

  // If user is already authenticated and trying to access login page
  if (authStore.isAuthenticated && normalizedPath === '/login') {
    // Redirect to home or the intended destination
    const redirect = (to.query.redirect as string) || '/'
    // Prevent redirect loop to login page itself
    if (redirect === '/login' || redirect.startsWith('/login?') || redirect.startsWith('/login/')) {
      return navigateTo('/')
    }
    return navigateTo(redirect)
  }
})
