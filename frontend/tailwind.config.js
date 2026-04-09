/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fdf0ec',
          100: '#f9d4c5',
          200: '#f4a98b',
          400: '#ed7a52',
          500: '#e84b1a',
          600: '#c93d12',
          700: '#a02e0d',
          800: '#772009',
          900: '#4e1405',
        },
        ink: {
          DEFAULT: '#0a0a0f',
          2: '#2e2e3a',
          3: '#6b6b7e',
          4: '#9999aa',
        },
        surface: {
          DEFAULT: '#ffffff',
          2: '#f5f4f0',
          3: '#eceae3',
          4: '#e3e0d5',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-ring': 'pulseRing 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(232,75,26,0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(232,75,26,0)' },
        },
      },
    },
  },
  plugins: [],
}
