// app/composables/useToast.ts
// Port of the notification pattern from frontend/src/components/layout/Notification.tsx.
// The visible container lives in components/ui/AppToast.vue.
export const useToast = () => {
  const ui = useUiStore()
  return {
    success: (message: string) => ui.addToast(message, 'success'),
    error: (message: string) => ui.addToast(message, 'error'),
    remove: (id: string) => ui.removeToast(id),
  }
}
