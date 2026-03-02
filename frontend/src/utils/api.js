import axios from 'axios';

console.log("API URL:", import.meta.env.VITE_API_URL);
console.log("Mode:", import.meta.env.MODE);

const api = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "/api" // dev proxy
      : import.meta.env.VITE_API_URL, // prod URL
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401/403, clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      const path = window.location.pathname;
      // Don't redirect if already on login or public guest page
      if (!path.startsWith('/login') && !path.startsWith('/guest')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
