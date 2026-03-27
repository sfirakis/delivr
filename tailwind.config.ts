/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF0EB',
          100: '#FFD9CC',
          200: '#FFB399',
          300: '#FF8C66',
          400: '#FF6B35',
          500: '#FF4500',
          600: '#CC3700',
          700: '#992900',
          800: '#661B00',
          900: '#330E00',
          DEFAULT: '#FF4500',
        },
        surface: {
          1: '#FFFFFF',
          2: '#F8F7F5',
          3: '#F0EEE9',
          4: '#E8E5DF',
        },
        ink: {
          1: '#1A1814',
          2: '#6B6760',
          3: '#A8A49E',
          4: '#D4D0CA',
        },
        success: '#2D9E6B',
        warning: '#E8A020',
        info:    '#2563EB',
        danger:  '#DC2626',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        'card':  '0 2px 16px rgba(0,0,0,0.08)',
        'float': '0 8px 40px rgba(0,0,0,0.14)',
        'brand': '0 8px 32px rgba(255,69,0,0.35)',
      },
      animation: {
        'slide-up':   'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        'fade-in':    'fadeIn 0.2s ease',
        'scale-in':   'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'shimmer':    'shimmer 1.5s infinite',
        'pulse-ring': 'pulseRing 1.5s infinite',
      },
      keyframes: {
        slideUp:   { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:    { from: { opacity: '0' },                                  to: { opacity: '1' } },
        scaleIn:   { from: { transform: 'scale(0.85)', opacity: '0' },        to: { transform: 'scale(1)', opacity: '1' } },
        shimmer:   { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pulseRing: { '0%': { transform: 'scale(1)', opacity: '0.8' }, '100%': { transform: 'scale(2.5)', opacity: '0' } },
      },
    },
  },
  plugins: [],
}
