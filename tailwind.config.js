/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'] },
      colors: {
        // Nasim ERP brand — modern sky→indigo. "royal" kept as the token name
        // used across the app, refreshed to a brighter, cleaner indigo-blue.
        royal: {
          50: '#eff5ff', 100: '#dbe8fe', 200: '#bfd6fe', 300: '#93bbfd',
          400: '#6098fa', 500: '#3b76f6', 600: '#2563eb', 700: '#1d4fd8',
          800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
        brand: { DEFAULT: '#2563eb', dark: '#1d4fd8', light: '#6098fa' },
        // sky accent used for highlights / the "ERP" wordmark / active states
        accent: {
          50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
        },
        ink: {
          900: '#0b1220', 800: '#172033', 700: '#2b3850', 600: '#475069',
          500: '#64748b', 400: '#94a3b8', 300: '#cbd5e1', 200: '#e6ebf3',
          100: '#f1f5fb', 50: '#f8fafd',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(37,99,235,0.10)',
        elevated: '0 4px 14px rgba(15,23,42,0.06), 0 28px 60px -20px rgba(37,99,235,0.22)',
        glass: '0 10px 40px rgba(37,99,235,0.16)',
        glow: '0 0 0 1px rgba(37,99,235,0.10), 0 10px 30px -8px rgba(6,182,212,0.35)',
        inner_soft: 'inset 0 1px 2px rgba(15,23,42,0.04)',
      },
      backgroundImage: {
        // Vibrant modern brand: sky → blue → indigo
        'brand-gradient': 'linear-gradient(135deg, #06b6d4 0%, #2563eb 50%, #4f46e5 100%)',
        // Sidebar: deep teal → cyan, fresh & modern
        'sidebar-gradient': 'linear-gradient(168deg, #042f2e 0%, #0f5e5a 40%, #0e7490 78%, #0891b2 130%)',
        'mesh': 'radial-gradient(1100px 560px at 100% -12%, rgba(6,182,212,0.14), transparent 60%), radial-gradient(820px 480px at -8% 112%, rgba(79,70,229,0.10), transparent 55%), radial-gradient(700px 420px at 50% 120%, rgba(37,99,235,0.07), transparent 60%)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-in': { '0%': { opacity: '0', transform: 'translateX(12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'slide-in': 'slide-in 0.25s ease-out',
        'float': 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
