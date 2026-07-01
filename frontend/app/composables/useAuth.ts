// app/composables/useAuth.ts
import { storeToRefs } from 'pinia'

export const useAuth = () => {
  const store = useAuthStore()
  const { user, token } = storeToRefs(store)
  return {
    user,
    token,
    isAuthenticated: computed(() => store.isAuthenticated),
    isAdmin: computed(() => store.isAdmin),
    login: store.login,
    logout: store.logout,
    fetchMe: store.fetchMe,
  }
}
