import axios from 'axios';

// Public endpoints should not send the Authorization header — it can
// contain non-ISO-8859-1 characters that cause XMLHttpRequest to throw.
const publicRequest = axios.create();
delete publicRequest.defaults.headers.common['Authorization'];
publicRequest.interceptors.request.use((config) => {
  delete config.headers['Authorization'];
  return config;
});

export const checkBlacklist = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const [blacklistRes, abuseipdbRes] = await Promise.allSettled([
      publicRequest.get(`/api/blacklist/quick-check/?${query}`, {
        headers: { 'Accept': 'application/json' },
        timeout: 30000,
      }),
      publicRequest.get(`/api/tools/abuseipdb/?${query}`, {
        headers: { 'Accept': 'application/json' },
        timeout: 30000,
      }),
    ]);

    if (blacklistRes.status === 'rejected') {
      throw blacklistRes.reason;
    }

    const result = blacklistRes.value.data;
    result.abuseipdb = abuseipdbRes.status === 'fulfilled'
      ? abuseipdbRes.value.data
      : null;

    return result;
  } catch (error) {
    handleRequestError(error, 'Error checking blacklist');
  }
};

const handleRequestError = (error, customErrorMessage) => {
  if (error.response) {
    const detail =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      `HTTP error! status: ${error.response.status}`;
    console.error(detail);
    throw new Error(detail);
  } else if (error.request) {
    console.error('No response received');
    throw new Error('No response received from backend.');
  } else {
    console.error(customErrorMessage || 'Error setting up the request', error.message);
    throw new Error(error.message || customErrorMessage || 'Error setting up the request');
  }
};
