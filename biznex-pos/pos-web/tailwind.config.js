/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Corporate Professional — slate surfaces + blue #2563eb accent.
      // Class names unchanged (ink/mist/accent…) so pages need no edits.
      colors: {
        ink: {
          DEFAULT: '#f8fafc',  // page background (slate-50)
          dark: '#f1f5f9',     // deepest light surface (slate-100)
          light: '#020617',    // sidebar — slate-950
          lighter: '#ffffff',  // inputs / secondary surfaces
          card: '#ffffff',     // cards
          border: '#e2e8f0',   // slate-200
          border2: '#cbd5e1',  // slate-300
        },
        mist: {
          DEFAULT: '#0f172a',  // primary text (slate-900)
          dim: '#475569',      // secondary text (slate-600)
          faint: '#94a3b8',    // muted text (slate-400)
        },
        accent: {
          DEFAULT: '#2563eb',  // blue-600
          light: '#3b82f6',    // blue-500
          dark: '#1d4ed8',     // blue-700
        },
        good: { DEFAULT: '#16a34a', dark: '#15803d' },
        warn: { DEFAULT: '#d97706', dark: '#b45309' },
        bad: { DEFAULT: '#dc2626', dark: '#b91c1c' },
      },
      fontFamily: {
        sans: ['Satoshi', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Ubuntu', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(37,99,235,0.25), 0 8px 24px rgba(37,99,235,0.18)',
        card: '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px -12px rgba(15,23,42,0.12)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
