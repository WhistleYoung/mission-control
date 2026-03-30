/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          25: '#FCFCFC',
          50: '#F9F9F9',
          100: '#F1F1F1',
          200: '#E5E5E5',
          300: '#D6D6D6',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          750: '#333333',
          800: '#262626',
          850: '#1A1A1A',
          900: '#0D0D0D',
          950: '#080808',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
