// nuxt.config.ts
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
  ],

  // Component auto-import without the directory prefix:
  // components/layout/AppHeader.vue -> <AppHeader />, components/ui/AppToast.vue -> <AppToast />
  components: [{ path: '~/components', pathPrefix: false }],

  // Point the module straight at our Tailwind entry (directives + ported scrollbar).
  // Absolute path avoids the module resolving its default against the root, not app/.
  tailwindcss: {
    cssPath: fileURLToPath(new URL('./app/assets/css/tailwind.css', import.meta.url)),
  },

  // SSR/CSR per screen (ТЗ 6.9). Public pages render on the server; the map and
  // private pages are client-only - Leaflet needs window, and private data sits
  // behind a localStorage token the server cannot read.
  routeRules: {
    '/': { ssr: true },
    '/analytics/**': { ssr: false },
    '/about': { prerender: true },
    '/knowledge/**': { ssr: true },
    '/stories/**': { ssr: true },
    '/search': { ssr: true },
    '/map': { ssr: false },
    '/profile': { ssr: false },
    '/leaderboard': { ssr: false },
    '/login': { ssr: false },
  },

  // Secrets stay server-side (runtimeConfig root). Only `public` reaches the client.
  // This is the fix for the Gemini-key leak in the old vite.config.ts (п. 3.9.3).
  runtimeConfig: {
    internalApiBase: '',   // NUXT_INTERNAL_API_BASE - absolute Express base for SSR-time calls
    dashboardApiUrl: '',   // NUXT_DASHBOARD_API_URL  - Agency Dashboard (Этап 9)
    dashboardApiKey: '',   // NUXT_DASHBOARD_API_KEY
    doppixApiUrl: '',      // NUXT_DOPPIX_API_URL     - Doppix Telegram-app (Этап 9)
    doppixApiKey: '',      // NUXT_DOPPIX_API_KEY
    public: {
      apiBase: '/api',     // NUXT_PUBLIC_API_BASE - current Express, proxied by Nginx (client-side)
    },
  },

  // RU + UZ Latin registered from the start (ТЗ 6.7). UZ falls back to RU until
  // translations land - no invented Uzbek strings.
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'ru',
    locales: [
      { code: 'ru', name: 'Русский', file: 'ru.json' },
      { code: 'uz', name: "O'zbekcha", file: 'uz.json' },
    ],
    vueI18n: 'i18n.config.ts',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      // No-flash theme: set the .dark/.light class before first paint, matching the
      // React app (localStorage key "theme": light | dark | system).
      script: [
        {
          innerHTML: "(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||((t===null||t==='system')&&m);var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);}catch(e){}})();",
          tagPosition: 'head',
        },
      ],
    },
  },
})
