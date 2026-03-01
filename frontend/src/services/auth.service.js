import api from './api'

export default {
  async login(credentials) {
    const { data } = await api.post('/api/auth/login', credentials)
    return data
  },

  async logout() {
    const { data } = await api.post('/api/auth/logout')
    return data
  },

  async getCurrentUser() {
    const { data } = await api.get('/api/auth/me')
    return data
  },

  /**
   * Refresh access token via HttpOnly cookie (no token needed in body).
   * The browser sends the scoped refresh_token cookie automatically.
   */
  async refreshToken() {
    const { data } = await api.post('/api/auth/refresh')
    return data
  },

  /**
   * Get current user from sessionStorage (sync fallback, set by auth store).
   */
  getUser() {
    try {
      const stored = sessionStorage.getItem('velo_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }
}
