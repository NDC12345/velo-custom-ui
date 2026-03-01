import { defineStore } from 'pinia'
import { ref, watchEffect } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(localStorage.getItem('velo-theme') !== 'light')

  // Sync <html data-theme="light"> for CSS variable switching
  watchEffect(() => {
    if (isDark.value) {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  })

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('velo-theme', isDark.value ? 'dark' : 'light')
  }

  function setDark(value) {
    isDark.value = value
    localStorage.setItem('velo-theme', value ? 'dark' : 'light')
  }

  return { isDark, toggleTheme, setDark }
})
