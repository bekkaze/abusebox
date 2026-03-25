import axios from 'axios';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AuthContext = createContext()

const isSafeToken = (t) => t && /^[\x20-\x7E]+$/.test(t);

// Set the axios header synchronously on module load so the very first
// request that fires (before any useEffect runs) already carries the token.
const initToken = localStorage.getItem('token');
const initRefresh = localStorage.getItem('refreshToken');
if (isSafeToken(initToken)) {
  axios.defaults.headers.common['Authorization'] = 'Bearer ' + initToken;
} else if (initToken) {
  localStorage.removeItem('token');
}

// Axios interceptor: auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

// Use a separate axios instance for refresh to avoid interceptor loops
const refreshClient = axios.create();
delete refreshClient.defaults.headers.common['Authorization'];

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401s, skip if already retried or if it's a login/refresh call
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/user/login') ||
      originalRequest.url?.includes('/user/token/refresh')
    ) {
      return Promise.reject(error);
    }

    const storedRefresh = localStorage.getItem('refreshToken');
    if (!storedRefresh) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
        return axios(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const res = await refreshClient.post('/api/user/token/refresh/', {
        refresh: storedRefresh,
      });

      const newAccess = res.data.access;
      const newRefresh = res.data.refresh;

      localStorage.setItem('token', newAccess);
      localStorage.setItem('refreshToken', newRefresh);
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + newAccess;

      // Notify the React state (if mounted) via a custom event
      window.dispatchEvent(new CustomEvent('token-refreshed', { detail: { access: newAccess, refresh: newRefresh } }));

      processQueue(null, newAccess);

      originalRequest.headers['Authorization'] = 'Bearer ' + newAccess;
      return axios(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh token also expired — force logout
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      delete axios.defaults.headers.common['Authorization'];
      window.dispatchEvent(new CustomEvent('token-expired'));

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

const AuthProvider = ({ children }) => {
  const [token, setToken_] = useState(isSafeToken(initToken) ? initToken : null);
  const [refreshToken, setRefreshToken_] = useState(isSafeToken(initRefresh) ? initRefresh : null);

  const setToken = (newAccess, newRefresh) => {
    setToken_(newAccess);
    if (newRefresh !== undefined) {
      setRefreshToken_(newRefresh);
    }
  };

  // Listen for background token refresh events from the interceptor
  useEffect(() => {
    const handleRefreshed = (e) => {
      setToken_(e.detail.access);
      setRefreshToken_(e.detail.refresh);
    };
    const handleExpired = () => {
      setToken_(null);
      setRefreshToken_(null);
    };
    window.addEventListener('token-refreshed', handleRefreshed);
    window.addEventListener('token-expired', handleExpired);
    return () => {
      window.removeEventListener('token-refreshed', handleRefreshed);
      window.removeEventListener('token-expired', handleExpired);
    };
  }, []);

  useEffect(() => {
    if (token) {
      if (!isSafeToken(token)) {
        setToken_(null);
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        return;
      }
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }, [refreshToken]);

  const contextValue = useMemo(
    () => ({
      token,
      refreshToken,
      setToken,
    }),
    [token, refreshToken]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
}

export default AuthProvider;
