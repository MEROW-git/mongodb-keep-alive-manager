/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#0B1120',
        cardBg: '#111827',
        cardBorder: '#1F2937',
        cardHover: '#1E293B',
        mongo: {
          DEFAULT: '#00ED64',
          50: '#E6FDF0',
          100: '#C2FBD9',
          200: '#86F7B4',
          300: '#4DF28F',
          400: '#00ED64',
          500: '#00C352',
          600: '#009940',
          700: '#00702E',
          800: '#00471D',
          900: '#001E0C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(0, 237, 100, 0.6))' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 2px rgba(0, 237, 100, 0.2))' },
        },
      },
    },
  },
  plugins: [],
};
