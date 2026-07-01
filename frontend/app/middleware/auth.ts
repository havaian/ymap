// app/middleware/auth.ts
// Guards private pages (/profile, /leaderboard). Applied per-page via
// definePageMeta({ middleware: 'auth' }). Auth state is hydrated from localStorage by
// plugins/auth.client.ts, which runs before this middleware.
export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }
})
