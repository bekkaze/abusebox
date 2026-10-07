import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authProvider';
import { getMe } from './index';

// One /user/me/ request per token, shared by every component that asks.
let cache = { token: null, promise: null };

export function invalidateCurrentUser() {
  cache = { token: null, promise: null };
}

export default function useCurrentUser() {
  const { token } = useAuth();
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!token) {
      setMe(null);
      return undefined;
    }
    if (cache.token !== token) cache = { token, promise: getMe() };
    let active = true;
    cache.promise.then((user) => active && setMe(user)).catch(() => active && setMe(null));
    return () => { active = false; };
  }, [token]);

  return me;
}
