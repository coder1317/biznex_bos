/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Light theme with a deep-violet sidebar + violet accent, matching the
      // BIZNEX_UI design snapshots. Class names are unchanged (ink/mist/accent…).
      colors: {
        ink: {
          DEFAULT: '#f4f5f9',  // page background
          dark: '#eef0f6',     // deepest surface (receipts, charts)
          light: '#2b166e',    // sidebar — deep violet
          lighter: '#f7f8fc',  // inputs / secondary surfaces
          card: '#ffffff',     // cards
          border: '#e5e8f0',
          border2: '#d4d9e6',
        },
        mist: {
          DEFAULT: '#1d2340',  // primary text (dark navy)
          dim: '#565e80',      // secondary text
          faint: '#8b90a8',    // muted text
        },
        accent: {
          DEFAULT: '#6721d6',  // violet (snapshot #6721d6)
          light: '#7c3aed',
          dark: '#5719b8',
        },
        good: { DEFAULT: '#16a34a', dark: '#15803d' },
        warn: { DEFAULT: '#d97706', dark: '#b45309' },
        bad: { DEFAULT: '#dc2626', dark: '#b91c1c' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Ubuntu', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(103,33,214,0.35), 0 8px 24px rgba(103,33,214,0.25)',
        card: '0 1px 2px rgba(16,24,40,0.05), 0 8px 24px -10px rgba(16,24,40,0.12)',
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
