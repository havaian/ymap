// app/stores/auth.ts
import { defineStore } from 'pinia'
import type { User } from '~/types'

// Auth against the current Express backend: POST /auth/login and GET /auth/me both
// return { success, data }. Token is a plain JWT kept in localStorage (key "token"),
// same contract as the React app - no backend change (ОВ №15: httpOnly-cookie mode
// deferred, it would need Express to set cookies + CORS credentials).
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) =>
      !!state.user && state.user.role?.toString().toUpperCase() === 'ADMIN',
  },
  actions: {
    // Rehydrate from localStorage (client only). Called by plugins/auth.client.ts
    // before route middleware runs, so guarded pages see correct state on refresh.
    init() {
      if (!import.meta.client) return
      const token = localStorage.getItem('token')
      const rawUser = localStorage.getItem('currentUser')
      this.token = token
      this.user = rawUser ? (JSON.parse(rawUser) as User) : null
    },
    async login(email: string, password: string) {
      const { $api } = useNuxtApp()
      const res = await $api<{ success: boolean; data: { user: User; token: string } }>(
        '/auth/login',
        { method: 'POST', body: { email, password } },
      )
      this.user = res.data.user
      this.token = res.data.token
      if (import.meta.client) {
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('currentUser', JSON.stringify(res.data.user))
      }
      return res.data.user
    },
    async fetchMe() {
      const { $api } = useNuxtApp()
      const res = await $api<{ success: boolean; data: User }>('/auth/me')
      this.user = res.data
      if (import.meta.client) localStorage.setItem('currentUser', JSON.stringify(res.data))
      return res.data
    },
    logout() {
      this.user = null
      this.token = null
      if (import.meta.client) {
        localStorage.removeItem('token')
        localStorage.removeItem('currentUser')
      }
    },
  },
})
