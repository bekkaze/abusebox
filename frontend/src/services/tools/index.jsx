import axios from 'axios';

const handleRequestError = (error, customErrorMessage) => {
  if (error.response) {
    const detail =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      `HTTP error! status: ${error.response.status}`;
    throw new Error(detail);
  } else if (error.request) {
    throw new Error('No response received from backend.');
  } else {
    throw new Error(error.message || customErrorMessage || 'Error setting up the request');
  }
};

// Public endpoints should not send the Authorization header — it can
// contain non-ISO-8859-1 characters that cause XMLHttpRequest to throw.
const publicRequest = axios.create();
delete publicRequest.defaults.headers.common['Authorization'];
publicRequest.interceptors.request.use((config) => {
  delete config.headers['Authorization'];
  return config;
});

export const checkAbuseIPDB = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await publicRequest.get(`/api/tools/abuseipdb/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error checking AbuseIPDB');
  }
};

export const checkWhois = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await publicRequest.get(`/api/tools/whois/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error performing WHOIS lookup');
  }
};

export const checkServerStatus = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await publicRequest.get(`/api/tools/server-status/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error checking server status');
  }
};
