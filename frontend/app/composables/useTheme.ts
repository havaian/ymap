// app/composables/useTheme.ts
import { storeToRefs } from 'pinia'

export const useTheme = () => {
  const ui = useUiStore()
  const { theme } = storeToRefs(ui)
  return {
    theme,
    setTheme: ui.setTheme,
    initTheme: ui.initTheme,
    toggle: () => ui.setTheme(theme.value === 'dark' ? 'light' : 'dark'),
  }
}
