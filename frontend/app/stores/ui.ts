// app/stores/ui.ts
import { defineStore } from 'pinia'

type Theme = 'light' | 'dark' | 'system'
type FontSize = 'sm' | 'base' | 'lg'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
}

// Theme, font size and toasts. Theme mirrors the React app: localStorage key "theme"
// (light | dark | system), toggling .dark / .light on <html>. The no-flash inline
// script in nuxt.config sets the initial class before paint; this store keeps it in
// sync afterwards.
export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'system' as Theme,
    fontSize: 'base' as FontSize,
    toasts: [] as Toast[],
  }),
  actions: {
    initTheme() {
      if (!import.meta.client) return
      const saved = localStorage.getItem('theme')
      this.theme =
        saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
      const savedFont = localStorage.getItem('fontSize')
      if (savedFont === 'sm' || savedFont === 'base' || savedFont === 'lg') {
        this.fontSize = savedFont
      }
      this.applyTheme()
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (this.theme === 'system') this.applyTheme()
        })
    },
    setTheme(theme: Theme) {
      this.theme = theme
      if (import.meta.client) localStorage.setItem('theme', theme)
      this.applyTheme()
    },
    applyTheme() {
      if (!import.meta.client) return
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = this.theme === 'dark' || (this.theme === 'system' && sysDark)
      const root = document.documentElement
      root.classList.toggle('dark', dark)
      root.classList.toggle('light', !dark)
    },
    setFontSize(size: FontSize) {
      this.fontSize = size
      if (import.meta.client) localStorage.setItem('fontSize', size)
    },
    addToast(message: string, type: Toast['type'] = 'success') {
      if (!import.meta.client) return
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.toasts.push({ id, message, type })
      setTimeout(() => this.removeToast(id), 4000)
    },
    removeToast(id: string) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
