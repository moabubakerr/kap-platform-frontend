import type { Config } from 'tailwindcss';

// Every colour is a CSS variable from src/styles/tokens.css, so the
// Tailwind classes and any inline SVG fills use the same source of truth.
const v = (name: string) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: v('brand'), strong: v('brand-strong'), tint: v('brand-tint'), tint2: v('brand-tint-2'), deep: '#4F0A20' },
        page: v('surface-page'),
        surface: { DEFAULT: v('surface-card'), sunken: v('surface-sunken'), hover: v('surface-hover') },
        ink: { strong: v('text-strong'), body: v('text-body'), muted: v('text-muted'), subtle: v('text-subtle') },
        line: { subtle: v('border-subtle'), DEFAULT: v('border-default'), strong: v('border-strong') },
        sand: { DEFAULT: v('sand'), ink: v('sand-ink'), tint: v('sand-tint') },
        teal: { DEFAULT: v('teal'), tint: v('teal-tint') },
        success: { DEFAULT: v('success'), fg: v('success-fg'), bg: v('success-bg'), border: v('success-border') },
        warning: { DEFAULT: v('warning'), fg: v('warning-fg'), bg: v('warning-bg'), border: v('warning-border') },
        danger: { DEFAULT: v('danger'), fg: v('danger-fg'), bg: v('danger-bg'), border: v('danger-border') },
        info: { DEFAULT: v('info'), bg: v('info-bg') },
        neutral: { DEFAULT: '#6B7280', 100: v('neutral-100'), 500: v('neutral-500'), 700: v('neutral-700') },
        model: '#8C8487',
        platform: '#1F1A1C',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: v('r-card'), sm: v('r-sm'), DEFAULT: v('r-card') },
      boxShadow: {
        menu: '0 6px 16px rgba(31,26,28,.12)',
        xl: '0 24px 56px rgba(31,26,28,.18)',
        focus: '0 0 0 3px rgba(138,21,56,.3)',
      },
      fontSize: { '2xs': ['11px', '1.4'], xs: ['12px', '1.45'], sm: ['13px', '1.45'], base: ['14px', '1.5'] },
      keyframes: { kpulse: { '0%': { transform: 'scale(1)', opacity: '.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } } },
      animation: { kpulse: 'kpulse 1.4s ease-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
