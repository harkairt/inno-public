function isInternalRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

function normalizePath(path: string): string {
  return path === '/' ? '/' : path.replace(/\/$/, '')
}

function redirectToPublicChat(getPublicChatUrl: () => string | null) {
  const url = getPublicChatUrl()
  if (url) {
    return navigateTo(url, { replace: true })
  }
}

function handlePublicModeRouting(
  normalizedPath: string,
  isPublicChatRoute: boolean,
  isValidPublicAgent: (id: string) => boolean,
  getPublicChatUrl: () => string | null,
) {
  // Block access to non-public-chat routes (except login for auth errors)
  if (!isPublicChatRoute && normalizedPath !== '/login') {
    return redirectToPublicChat(getPublicChatUrl)
  }

  // Validate agent ID on public chat routes
  if (isPublicChatRoute) {
    const agentRedirect = validatePublicAgent(normalizedPath, isValidPublicAgent, getPublicChatUrl)
    if (agentRedirect) return agentRedirect

    // Skip normal auth checks — the public-auth plugin handles authentication
    return
  }
}

function validatePublicAgent(
  normalizedPath: string,
  isValidPublicAgent: (id: string) => boolean,
  getPublicChatUrl: () => string | null,
) {
  const match = normalizedPath.match(/^\/chats\/public\/new\/(\d+)$/)
  if (!match?.[1]) return undefined

  if (!isValidPublicAgent(match[1])) {
    return redirectToPublicChat(getPublicChatUrl)
  }
}

function handleAuthenticatedLoginRedirect(query: Record<string, unknown>) {
  const redirect = (query.redirect as string) || '/'
  if (redirect === '/login' || redirect.startsWith('/login?') || redirect.startsWith('/login/')) {
    return navigateTo('/')
  }
  return navigateTo(isInternalRedirect(redirect) ? redirect : '/')
}

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  const { isPublicMode, isValidPublicAgent, getPublicChatUrl } = usePublicMode()

  const publicRoutes = ['/login']
  const normalizedPath = normalizePath(to.path)
  const isPublicChatRoute = normalizedPath.startsWith('/chats/public/')
  const isPublicRoute = publicRoutes.includes(normalizedPath)

  // PUBLIC MODE HANDLING
  if (isPublicMode.value) {
    return handlePublicModeRouting(
      normalizedPath,
      isPublicChatRoute,
      isValidPublicAgent,
      getPublicChatUrl,
    )
  }

  // PRIVATE MODE HANDLING - block public routes
  if (isPublicChatRoute) {
    return navigateTo('/login', { replace: true })
  }

  // Unauthenticated user accessing a protected route
  if (!authStore.isAuthenticated && !isPublicRoute) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // Authenticated user accessing login page — redirect away
  if (authStore.isAuthenticated && normalizedPath === '/login') {
    return handleAuthenticatedLoginRedirect(to.query as Record<string, unknown>)
  }
})
