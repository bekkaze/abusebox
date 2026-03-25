import axios from 'axios';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AuthContext = createContext()

// Set the axios header synchronously on module load so the very first
// request that fires (before any useEffect runs) already carries the token.
const initToken = localStorage.getItem('token');
if (initToken && /^[\x20-\x7E]+$/.test(initToken)) {
  axios.defaults.headers.common['Authorization'] = 'Bearer ' + initToken;
} else if (initToken) {
  // Corrupted token — clear it
  localStorage.removeItem('token');
}

const AuthProvider = ({ children }) => {
  const [token, setToken_] = useState(initToken && /^[\x20-\x7E]+$/.test(initToken) ? initToken : null);

  const setToken = (newToken) => {
    setToken_(newToken);
  }

  useEffect(() => {
    if (token) {
      const safeToken = token.replace(/[^\x20-\x7E]/g, '');
      if (safeToken !== token) {
        setToken_(null);
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        return;
      }
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + safeToken;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  const contextValue = useMemo(
    () => ({
      token,
      setToken,
    }),
    [token]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
}

export default AuthProvider;