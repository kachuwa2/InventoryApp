import axios from 'axios';

let _token: string | null = null;

export function setToken(token: string | null) { _token = token; }
export function getToken() { return _token; }

// Use Vite proxy in dev (/api → http://localhost:3000/api)
// Set VITE_API_URL for production
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const client = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios
            .post<{ data: { accessToken: string } }>(
              `${BASE}/api/auth/refresh`,
              null,
              { withCredentials: true }
            )
            .then((r) => r.data.data.accessToken)
            .finally(() => { refreshing = null; });
        }
        const newToken = await refreshing;
        setToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        setToken(null);
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export default client;
