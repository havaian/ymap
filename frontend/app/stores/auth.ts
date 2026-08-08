// app/stores/auth.ts
import { defineStore } from 'pinia'
import type { User } from '~/types'

// Auth against the current Express backend: POST /auth/login and GET /auth/me both
// return { success, data }. Token is a plain JWT kept in localStorage (key "token"),
// same contract as the React app - no backend change (ОВ №15: httpOnly-cookie mode
// deferred, it would need Express to set cookies + CORS credentials).
//
// Registration is a two-step flow and deliberately does not produce a session:
// POST /auth/register creates an unconfirmed account and mails a link, and only
// GET/POST /auth/verify-email returns a token. So `register` sets no state here,
// while `verifyEmail` signs the user in the same way `login` does.
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
    // One place that writes the session, so a future move to httpOnly cookies is
    // one function rather than three copies of the same three lines.
    persist(user: User, token: string) {
      this.user = user
      this.token = token
      if (import.meta.client) {
        localStorage.setItem('token', token)
        localStorage.setItem('currentUser', JSON.stringify(user))
      }
    },
    async login(email: string, password: string) {
      const { $api } = useNuxtApp()
      const res = await $api<{ success: boolean; data: { user: User; token: string } }>(
        '/auth/login',
        { method: 'POST', body: { email, password } },
      )
      this.persist(res.data.user, res.data.token)
      return res.data.user
    },
    /**
     * Creates the account and triggers the confirmation letter. Returns whether the
     * letter actually left the server, so the interface can tell "check your inbox"
     * apart from "delivery failed, try again" instead of showing the first in both
     * cases.
     */
    async register(email: string, password: string) {
      const { $api } = useNuxtApp()
      const res = await $api<{
        success: boolean
        data: { email: string; emailVerified: boolean; mailDelivered: boolean; resent?: boolean }
        message?: string
      }>('/auth/register', { method: 'POST', body: { email, password } })
      return res.data
    },
    /** Confirms the address and signs in with the token the backend issues. */
    async verifyEmail(token: string) {
      const { $api } = useNuxtApp()
      const res = await $api<{ success: boolean; data: { user: User; token: string } }>(
        '/auth/verify-email',
        { method: 'POST', body: { token } },
      )
      this.persist(res.data.user, res.data.token)
      return res.data.user
    },
    /**
     * Asks for a reset letter. Answers identically whether or not the address is
     * registered, so there is nothing here to branch on - the caller shows the
     * same message either way.
     */
    async forgotPassword(email: string) {
      const { $api } = useNuxtApp()
      return $api<{ success: boolean; message?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email },
      })
    },
    /** Sets the new password and signs in with the token the backend issues. */
    async resetPassword(token: string, password: string) {
      const { $api } = useNuxtApp()
      const res = await $api<{ success: boolean; data: { user: User; token: string } }>(
        '/auth/reset-password',
        { method: 'POST', body: { token, password } },
      )
      this.persist(res.data.user, res.data.token)
      return res.data.user
    },
    async resendVerification(email: string) {
      const { $api } = useNuxtApp()
      return $api<{ success: boolean; message?: string }>('/auth/resend-verification', {
        method: 'POST',
        body: { email },
      })
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
