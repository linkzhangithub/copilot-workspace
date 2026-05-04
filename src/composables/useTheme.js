import { ref, watch, onMounted } from 'vue'

const STORAGE_KEY = 'ai-writing-theme'
const THEME_DARK = 'dark'
const THEME_LIGHT = 'light'

const currentTheme = ref(THEME_DARK)

export function useTheme() {
  const initTheme = () => {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    if (savedTheme) {
      currentTheme.value = savedTheme
    }
    applyTheme(currentTheme.value)
  }

  const applyTheme = (theme) => {
    const root = document.documentElement
    if (theme === THEME_LIGHT) {
      root.classList.remove('dark')
      root.classList.add('light')
      // 亮色主题变量
      root.style.setProperty('--bg-page', '#F7F7F8')
      root.style.setProperty('--bg-sidebar', '#FFFFFF')
      root.style.setProperty('--bg-input', '#F1F5F9')
      root.style.setProperty('--bg-hover', '#E2E8F0')
      root.style.setProperty('--text-primary', '#1A1A2E')
      root.style.setProperty('--text-secondary', '#64748B')
      root.style.setProperty('--text-muted', '#94A3B8')
      root.style.setProperty('--text-tertiary', '#CBD5E1')
      root.style.setProperty('--border', '#E2E8F0')
      root.style.setProperty('--selected-bg', '#DBEAFE')
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
      // 暗色主题变量（默认）
      root.style.setProperty('--bg-page', '#0B1120')
      root.style.setProperty('--bg-sidebar', '#0F172A')
      root.style.setProperty('--bg-input', '#1E293B')
      root.style.setProperty('--bg-hover', '#2D3748')
      root.style.setProperty('--text-primary', '#F1F5F9')
      root.style.setProperty('--text-secondary', '#94A3B8')
      root.style.setProperty('--text-muted', '#64748B')
      root.style.setProperty('--text-tertiary', '#475569')
      root.style.setProperty('--border', '#2D3748')
      root.style.setProperty('--selected-bg', '#1E293B')
    }
  }

  const toggleTheme = () => {
    currentTheme.value = currentTheme.value === THEME_DARK ? THEME_LIGHT : THEME_DARK
  }

  watch(currentTheme, (newTheme) => {
    applyTheme(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  })

  onMounted(() => {
    initTheme()
  })

  return {
    currentTheme,
    toggleTheme
  }
}
