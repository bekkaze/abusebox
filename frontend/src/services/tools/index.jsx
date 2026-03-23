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

export const checkDns = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await publicRequest.get(`/api/tools/dns/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error looking up DNS records');
  }
};

export const checkSsl = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await publicRequest.get(`/api/tools/ssl/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error checking SSL certificate');
  }
};

export const checkEmailSecurity = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await publicRequest.get(`/api/tools/email-security/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error checking email security');
  }
};

export const checkSubnet = async (cidr) => {
  try {
    const query = new URLSearchParams({ cidr }).toString();
    const response = await publicRequest.get(`/api/tools/subnet/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error checking subnet');
  }
};

export const bulkCheck = async (hostnames) => {
  try {
    const query = new URLSearchParams({ hostnames }).toString();
    const response = await publicRequest.get(`/api/tools/bulk-check/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error running bulk check');
  }
};

export const exportBlacklistCsv = (hostname) => {
  const query = new URLSearchParams({ hostname }).toString();
  window.open(`/api/tools/export/blacklist/?${query}`, '_blank');
};

export const exportSubnetCsv = (cidr) => {
  const query = new URLSearchParams({ cidr }).toString();
  window.open(`/api/tools/export/subnet/?${query}`, '_blank');
};
