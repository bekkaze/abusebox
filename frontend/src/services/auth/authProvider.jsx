import axios from 'axios';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AuthContext = createContext()

const AuthProvider = ({ children }) => {
  const [token, setToken_] = useState(localStorage.getItem('token'));

  const setToken = (newToken) => {
    setToken_(newToken);
  }

  useEffect(() => {
    if (token) {
      // Ensure the token only contains ASCII characters that are safe
      // for HTTP headers. Non-ISO-8859-1 code points cause
      // XMLHttpRequest.setRequestHeader to throw.
      const safeToken = token.replace(/[^\x20-\x7E]/g, '');
      if (safeToken !== token) {
        // Token was corrupted — clear it and force re-login.
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