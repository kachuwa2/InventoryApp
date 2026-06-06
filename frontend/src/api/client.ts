import axios from 'axios';

let _token: string | null = null;

export function setToken(token: string | null) { _token = token; }
export function getToken() { return _token; }

const getBaseURL = (): string => {
  // 1. Environment variable takes highest priority
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // 2. DevTunnel — derive backend URL from frontend URL
  if (window.location.hostname.includes('devtunnels.ms')) {
    const backendHost = window.location.hostname.replace(
      /^([^-]+-)\d+(\..*)$/,
      '$13000$2'
    )
    return `https://${backendHost}/api`  // ← added /api
  }
  // 3. Local development fallback
  return 'http://localhost:3000/api'     // ← added /api
}

const client = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
})

// Attach token to every request
client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`
  return config
})

// Auto-refresh on 401
let refreshing: Promise<string> | null = null

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    // Skip retry if:
    // - Not a 401
    // - Already retried
    // - This IS the refresh request (prevent infinite loop)
    const isRefreshCall = original.url?.includes('/auth/refresh')
    const isLoginCall   = original.url?.includes('/auth/login')

    if (
      err.response?.status === 401 &&
      !original._retry &&
      !isRefreshCall &&
      !isLoginCall
    ) {
      original._retry = true
      try {
        if (!refreshing) {
          refreshing = client
            .post<{ data: { accessToken: string } }>(
              '/auth/refresh',
              null,
              { withCredentials: true }
            )
            .then((r) => r.data.data.accessToken)
            .finally(() => { refreshing = null })
        }
        const newToken = await refreshing
        setToken(newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return client(original)
      } catch {
        // Refresh failed — clear session and go to login
        setToken(null)
        window.location.href = '/login'
        return Promise.reject(err)
      }
    }

    return Promise.reject(err)
  }
)

export default client