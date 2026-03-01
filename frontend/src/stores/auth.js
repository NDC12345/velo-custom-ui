import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  // Tokens are stored exclusively in HttpOnly cookies.
  // Only the user profile object is kept in JS memory (and optionally
  // sessionStorage — NOT localStorage — so it survives a page reload
  // without persisting beyond the browser session).
  const user = ref(null)

  const isAuthenticated = computed(() => !!user.value)

  // ── Restore user profile from sessionStorage on cold load ────────────────
  try {
    const stored = sessionStorage.getItem('velo_user')
    if (stored) user.value = JSON.parse(stored)
  } catch {
    sessionStorage.removeItem('velo_user')
  }

  // ── Internal helper ───────────────────────────────────────────────────────
  function _saveUser(userData) {
    user.value = userData
    if (userData) {
      sessionStorage.setItem('velo_user', JSON.stringify(userData))
    } else {
      sessionStorage.removeItem('velo_user')
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function login(credentials) {
    const response = await api.post('/api/auth/login', credentials)
    // Server issues HttpOnly access_token + refresh_token cookies.
    // The csrf_token cookie (NOT HttpOnly) is also set here; api.js will
    // pick it up automatically on the next mutating request.
    _saveUser(response.data.user)
    return response.data
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      // Even if the server request fails, clear local state so the user
      // is not stuck in an authenticated-looking state.
      console.error('Logout request failed:', error)
    } finally {
      _saveUser(null)
    }
  }

  async function fetchCurrentUser() {
    const response = await api.get('/api/auth/me')
    _saveUser(response.data.user)
    return response.data.user
  }

  async function changePassword(payload) {
    const response = await api.post('/api/auth/change-password', payload)
    // Server rotates tokens and re-issues all 3 cookies on password change.
    // No local state change necessary.
    return response.data
  }

  async function register(payload) {
    const response = await api.post('/api/auth/register', payload)
    _saveUser(response.data.user)
    return response.data
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    register,
    fetchCurrentUser,
    changePassword,
  }
})

