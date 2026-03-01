import axios from 'axios'
import router from '@/router'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read a named cookie value from document.cookie.
 * The csrf_token cookie is intentionally NOT HttpOnly so the
 * frontend can read it and forward it as a header.
 */
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[\\.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const api = axios.create({
  // Empty string = relative URL → nginx on port 80/3000 proxies /api to backend.
  // Set VITE_API_URL in .env only if you need an explicit host (e.g. http://localhost:5000 for dev outside docker).
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 8000,
  withCredentials: true,               // send / receive HttpOnly cookies on every request
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request interceptor — inject CSRF token ─────────────────────────────────

const SAFE_METHODS = new Set(['get', 'head', 'options'])

api.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase()
    if (!SAFE_METHODS.has(method)) {
      const csrf = getCookie('csrf_token')
      if (csrf) {
        config.headers['X-CSRF-Token'] = csrf
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response interceptor — token refresh on 401 ─────────────────────────────

let isRefreshing = false
let refreshSubscribers = []

function onRefreshed() {
  refreshSubscribers.forEach((cb) => cb())
  refreshSubscribers = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh loop for AUTH routes themselves to avoid infinite cycle
    const isAuthRoute = originalRequest.url?.includes('/api/auth/')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          refreshSubscribers.push(() => {
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // The refresh_token HttpOnly cookie is scoped to this path and sent
        // automatically — no token in the request body needed.
        await axios.post(
          `${api.defaults.baseURL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        )

        onRefreshed()
        return api(originalRequest)
      } catch (refreshError) {
        refreshSubscribers = []
        // Redirect to login; auth store will clean up user state
        router.push('/login')
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
