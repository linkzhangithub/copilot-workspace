/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#635BFF',
          hover: '#5851DB',
          light: 'rgba(99, 91, 255, 0.15)'
        },
        accent: '#22D3EE',
        'bg-page': '#0B1120',
        'bg-primary': '#111827',
        'bg-secondary': '#0F172A',
        'bg-tertiary': '#1E293B',
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'text-tertiary': '#64748B',
        border: '#1E293B',
        'border-hover': '#334155',
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06)',
        md: '0 4px 12px rgba(0,0,0,0.08)',
        lg: '0 12px 24px rgba(0,0,0,0.1)',
        xl: '0 20px 40px rgba(0,0,0,0.12)'
      },
      borderRadius: {
        'button': '8px',
        'card': '12px',
        'avatar': '9999px'
      }
    },
  },
  plugins: [],
}
