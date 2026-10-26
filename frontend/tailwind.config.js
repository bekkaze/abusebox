/** @type {import('tailwindcss').Config} */

// Semantic colours live as CSS variables in src/index.css (light + dark).
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        paper: token('paper'),
        rail: token('rail'),
        sunk: token('sunk'),
        ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        rule: { DEFAULT: token('rule'), strong: token('rule-strong') },
        accent: { DEFAULT: token('accent'), hover: token('accent-hover'), ink: token('accent-ink'), soft: token('accent-soft') },
        s5: { DEFAULT: token('s5'), soft: token('s5-soft') },
        s4: { DEFAULT: token('s4'), soft: token('s4-soft') },
        s2: { DEFAULT: token('s2'), soft: token('s2-soft') },
        info: { DEFAULT: token('info'), soft: token('info-soft') },
        scrim: token('scrim'),
      },
      fontFamily: {
        sans: ['"Public Sans Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"Commit Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        e1: 'var(--shadow-1)',
        e2: 'var(--shadow-2)',
        e3: 'var(--shadow-3)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
}
