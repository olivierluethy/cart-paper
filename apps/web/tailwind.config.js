/** @type {import('tailwindcss').Config} */
export default {
  // Dark mode only: there is no light theme, no toggle, no `light:` variants.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          raised: 'rgb(var(--c-raised) / <alpha-value>)',
          line: 'rgb(var(--c-line) / <alpha-value>)',
          text: 'rgb(var(--c-text) / <alpha-value>)',
          muted: 'rgb(var(--c-muted) / <alpha-value>)',
          faint: 'rgb(var(--c-faint) / <alpha-value>)',
        },
        amber: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)',
          deep: 'rgb(var(--c-accent-deep) / <alpha-value>)',
        },
        teal: {
          DEFAULT: 'rgb(var(--c-teal) / <alpha-value>)',
          soft: 'rgb(var(--c-teal-soft) / <alpha-value>)',
        },
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
        read: ['"Literata Variable"', 'Literata', 'Georgia', 'serif'],
        ui: ['"IBM Plex Sans"', 'ui-sans-serif', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xs: '0.1875rem',
      },
      boxShadow: {
        page: '0 24px 60px -24px rgb(0 0 0 / 0.85)',
        cover: '0 18px 38px -18px rgb(0 0 0 / 0.9), 0 2px 6px rgb(0 0 0 / 0.5)',
        panel: '0 12px 40px -12px rgb(0 0 0 / 0.7)',
        inset: 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
      },
      transitionTimingFunction: {
        paper: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'fade-in': 'fade-in 180ms ease-out both',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
}
