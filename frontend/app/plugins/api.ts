// app/plugins/api.ts
// $fetch instance mirroring the axios interceptors in frontend/src/services/api.ts:
// attaches the Bearer token, and on a 401 (outside auth endpoints) clears the session
// and redirects to /login. Reads the token straight from localStorage to stay
// independent of the auth store.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const api = $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      if (import.meta.client) {
        const token = localStorage.getItem('token')
        if (token) {
          const headers = new Headers(options.headers as HeadersInit | undefined)
          headers.set('Authorization', `Bearer ${token}`)
          options.headers = headers
        }
      }
    },
    onResponseError({ request, response }) {
      if (!import.meta.client) return
      const url = String(request)
      const isAuthEndpoint =
        url.includes('/auth/login') || url.includes('/auth/register')
      const alreadyOnLogin = window.location.pathname === '/login'
      if (response.status === 401 && !isAuthEndpoint && !alreadyOnLogin) {
        localStorage.removeItem('currentUser')
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    },
  })

  return { provide: { api } }
})
