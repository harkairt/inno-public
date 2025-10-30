export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  // List of public routes that don't require authentication
  const publicRoutes = ['/login']

  // Normalize path by removing trailing slash (except for root)
  const normalizedPath = to.path === '/' ? '/' : to.path.replace(/\/$/, '')

  // Check if the destination route is public
  const isPublicRoute = publicRoutes.includes(normalizedPath)

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
