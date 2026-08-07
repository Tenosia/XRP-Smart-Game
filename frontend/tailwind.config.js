/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Warm, near-black casino surfaces
        ink: {
          950: '#0a0706',
          900: '#0f0b09',
          850: '#16100d',
          800: '#1d1612',
          700: '#281e18',
        },
        // brand = fiery red (so existing brand-* classes go warm automatically)
        brand: {
          50: '#fff2ee',
          200: '#ffc7b8',
          300: '#ff9e86',
          400: '#ff6a4d',
          500: '#ff3b30',
          600: '#e51d12',
          700: '#b3140d',
        },
        // ember = orange accent / fire highlights
        ember: {
          300: '#ffc77a',
          400: '#ffa94d',
          500: '#ff8a1a',
          600: '#f56b0a',
        },
        cyanx: '#22b8ff', // option A (cool contrast against the warm theme)
        yes: '#34d399',
        no: '#ff5a5a', // option B
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(255,59,48,0.55)',
        'glow-ember': '0 0 38px -8px rgba(255,138,26,0.5)',
        'glow-cyan': '0 0 40px -8px rgba(34,184,255,0.45)',
        card: '0 10px 40px -14px rgba(0,0,0,0.75)',
      },
      backgroundImage: {
        // orange → red fire gradient
        'brand-grad': 'linear-gradient(135deg, #ff8a1a 0%, #ff3b30 55%, #e51d12 100%)',
        'brand-grad-soft':
          'linear-gradient(135deg, rgba(255,138,26,0.20), rgba(255,59,48,0.14))',
        'fire-btn': 'linear-gradient(180deg, #ff4f43 0%, #ec1a10 100%)',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseGlow: {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
