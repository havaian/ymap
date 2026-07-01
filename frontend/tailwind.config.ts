// tailwind.config.ts
// Parity with the old setup: default Tailwind palette, dark mode via the .dark class.
// The old index.html used the Play CDN with an empty theme.extend - kept identical here,
// only now bundled locally (п. 3.9.1).
export default {
  darkMode: 'class',
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
    './app/**/*.{vue,js,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
