/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FFFDF9', 100: '#FFF8F0', 200: '#FBEEE2', 300: '#F3E2D3' },
        ink: { DEFAULT: '#2F2B3A', soft: '#5B5668', muted: '#8C8698', faint: '#C4BFCC' },
        line: '#F0E5DA',
        coral: { DEFAULT: '#FF8E7A', soft: '#FFE3DC', deep: '#D9563F', shade: '#E86F5A' },
        butter: { DEFAULT: '#FFD36E', soft: '#FFF3CF', deep: '#A87B0B', shade: '#E8B84A' },
        mint: { DEFAULT: '#7FD8A9', soft: '#DDF5E8', deep: '#22865A', shade: '#5DBE8B' },
        lavender: { DEFAULT: '#B5A6FF', soft: '#EEEAFF', deep: '#5F4BC9', shade: '#9886F0' },
        sky: { DEFAULT: '#8FCBFF', soft: '#E3F2FF', deep: '#2672B5', shade: '#6AB3F2' },
      },
      fontFamily: {
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        body: ['Figtree', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 32px -14px rgba(120, 84, 60, 0.28)',
        float: '0 18px 50px -18px rgba(120, 84, 60, 0.38)',
        card: '0 2px 0 rgba(240, 229, 218, 1), 0 10px 24px -16px rgba(120, 84, 60, 0.3)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '70%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0)' },
          '25%': { transform: 'rotate(-12deg)' },
          '75%': { transform: 'rotate(12deg)' },
        },
        halo: {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pop: 'pop .45s cubic-bezier(.34,1.56,.64,1) both',
        floaty: 'floaty 3.2s ease-in-out infinite',
        wiggle: 'wiggle .5s ease-in-out',
        halo: 'halo 2s ease-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
