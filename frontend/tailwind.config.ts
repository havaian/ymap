// tailwind.config.ts
//
// Parity with the old setup: default Tailwind palette, dark mode via the .dark class.
// The old index.html used the Play CDN with an empty theme.extend - kept identical here,
// only now bundled locally (п. 3.9.1).
//
// REWORKED. theme.extend is no longer empty. What was there before was the stock
// palette used stock: slate for everything, blue-600 for anything active, every
// weight set to font-black. That reads as a dashboard template, and this is not a
// dashboard - it is a set of instrument readings about public buildings, where the
// distinguishing property of every figure is that it comes with a denominator, a
// date, and often an interval.
//
// So the direction is a register: cyanotype ink on paper stock. Blueprint blue is
// the material vernacular of the subject itself, buildings, and it keeps the
// semantic ramp free for what it is actually for - how deficient a facility is.
// The ramp colours are deliberately desaturated relative to Tailwind's defaults; a
// neon red on a school district is a claim the data does not support.
//
// Tokens are ADDED, never redefined. Every existing slate-* and blue-* class keeps
// working, so pages migrate one at a time instead of all at once.
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
    // Порог xs для самых узких телефонов: до 479 px пара «подпись - значение» в
    // одной строке уже не помещается, с 480 помещается.
    //
    // Список объявлен целиком, а не добавлен через extend, намеренно. Tailwind
    // выстраивает правила в порядке объявления порогов, и xs, добавленный через
    // extend, встал бы после 2xl - тогда xs:grid-cols-2 перебивал бы sm: и md: на
    // широких экранах вместо того, чтобы им уступать. Остальные пять значений -
    // стандартные, они переписаны один в один.
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Cyanotype: the accent and the structural ink. Not Tailwind blue.
        prussian: {
          50: '#EDF3F7',
          100: '#D6E4EE',
          200: '#A9C6D9',
          300: '#7BA6C1',
          400: '#4A7F9F',
          500: '#2A6082',
          600: '#14415C',
          700: '#0E3247',
          800: '#0A2534',
          900: '#071A25',
        },
        // Paper stock. Cool-neutral on purpose: a warm cream ground is the house
        // style of every generated report and would say nothing about this subject.
        paper: {
          DEFAULT: '#F5F5F2',
          raised: '#FFFFFF',
          sunk: '#EDEEEA',
        },
        ink: {
          DEFAULT: '#12181D',
          muted: '#5A6570',
          faint: '#8E979F',
        },
        rule: {
          DEFAULT: '#DFE2DE',
          strong: '#C6CBC5',
        },
        // Dark mode surfaces, kept as named tokens so a page does not have to know
        // which slate step happened to look right.
        night: {
          DEFAULT: '#0E1418',
          raised: '#161D23',
          sunk: '#0A0F13',
          rule: '#232C34',
        },
        // Semantic ramp: sufficient to deficient. Muted, six steps, used by both the
        // choropleth and every bar so a district never changes colour between views.
        scale: {
          ok: '#2F6F4E',
          fair: '#5C7F3A',
          mild: '#A67C00',
          poor: '#B5622A',
          bad: '#A63A2E',
          severe: '#6E2620',
          none: '#B9BFB8',
        },
      },
      fontFamily: {
        // CORRECTION. The first set here was Archivo with Instrument Sans, and
        // neither ships Cyrillic: on an interface written entirely in Russian the
        // whole scale would have degraded to a system face. Replaced with a
        // Cyrillic-native set, self-hosted from public/fonts.
        //
        // Unbounded is geometric and deliberately technical, and it is spent in one
        // place: the landing headline and page titles. Golos Text was drawn for
        // civic interfaces in this script and stays quiet at 14px. JetBrains Mono
        // has both the Cyrillic and the tabular figures a column of SOATO codes
        // needs.
        display: ['Unbounded', 'Golos Text', 'system-ui', 'sans-serif'],
        sans: ['Golos Text', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // A scale with intent instead of a pile of arbitrary steps. Each entry
        // carries its own leading and tracking so a heading cannot be assembled
        // wrongly from parts.
        eyebrow: ['0.625rem', { lineHeight: '1.2', letterSpacing: '0.14em', fontWeight: '700' }],
        label: ['0.6875rem', { lineHeight: '1.35' }],
        note: ['0.75rem', { lineHeight: '1.5' }],
        body: ['0.875rem', { lineHeight: '1.55' }],
        lead: ['1rem', { lineHeight: '1.55' }],
        h3: ['1.1875rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        h2: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        h1: ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        // The measured figure. Two sizes, both tight, both meant to be read next to
        // a denominator rather than alone.
        figure: ['2.5rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
        'figure-lg': ['3.5rem', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        // The old pages used rounded-[1.5rem] on everything, which made every panel
        // read as a floating pill. A register has edges.
        panel: '0.625rem',
        control: '0.5rem',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(18, 24, 29, 0.05)',
      },
      transitionDuration: {
        instant: '90ms',
      },
    },
  },
  plugins: [],
}
