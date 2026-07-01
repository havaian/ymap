// app/plugins/auth.client.ts
// Rehydrate the auth store from localStorage on the client before route middleware
// runs, so a hard refresh of a guarded page keeps the user signed in.
export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  auth.init()
})
