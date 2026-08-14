/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Bauhaus primaries
        canvas: '#F0F0F0',   // off-white canvas
        ink: '#121212',      // stark black
        red: '#D02020',      // bauhaus red
        blue: '#1040C0',     // bauhaus blue
        yellow: '#F0C020',   // bauhaus yellow
        muted: '#E0E0E0',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        hard: '4px 4px 0px 0px #121212',
        'hard-md': '6px 6px 0px 0px #121212',
        'hard-lg': '8px 8px 0px 0px #121212',
        'hard-sm': '3px 3px 0px 0px #121212',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
