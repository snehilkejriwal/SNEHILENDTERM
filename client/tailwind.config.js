/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Obsidian Emerald & Champagne Amber theme
        frost: '#F3F7F5',
        mist: '#E4ECE7',
        ink: { DEFAULT: '#06110D', soft: '#14261F' },
        midnight: { DEFAULT: '#050D0A', 800: '#0A1712', 700: '#11241C' },
        steel: '#4E6359',
        line: '#D7E3DC',
        glacier: { 100: '#E6F4ED', 300: '#A8D5BD', 500: '#2E664D', 700: '#0E291C' },
        silver: '#BDD4C8',
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          teal: '#14B8A6',
          mint: '#2DD4BF',
          gold: '#F59E0B',
          amber: '#FBBF24',
        },
        marigold: '#D97706',
        crimson: '#E11D48',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 1px 0 rgba(255,255,255,.85) inset, 0 16px 40px -16px rgba(5,41,28,.14)',
        glow: '0 0 0 1px rgba(16,185,129,.3), 0 20px 50px -20px rgba(16,185,129,.4)',
        lift: '0 20px 45px -20px rgba(5,41,28,.22)',
        brand: '0 10px 30px -8px rgba(5,150,105,0.5)',
        gold: '0 10px 30px -8px rgba(245,158,11,0.45)',
        mint: '0 10px 30px -8px rgba(20,184,166,0.45)',
      },
      borderRadius: { panel: '28px' },
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
