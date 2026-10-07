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

// Tool endpoints require a signed-in user; the global axios instance carries the
// token (and refreshes it on 401). See services/auth/authProvider.jsx.

export const checkAbuseIPDB = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await axios.get(`/api/tools/abuseipdb/?${query}`, {
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
    const response = await axios.get(`/api/tools/whois/?${query}`, {
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
    const response = await axios.get(`/api/tools/server-status/?${query}`, {
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
    const response = await axios.get(`/api/tools/dns/?${query}`, {
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
    const response = await axios.get(`/api/tools/ssl/?${query}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error checking SSL certificate');
  }
};

export const checkEmailSecurity = async (hostname, dkimSelectors = '') => {
  try {
    const query = new URLSearchParams({ hostname });
    if (dkimSelectors.trim()) query.set('dkim_selectors', dkimSelectors.trim());
    const response = await axios.get(`/api/tools/email-security/?${query.toString()}`, {
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
    const response = await axios.get(`/api/tools/subnet/?${query}`, {
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
    // POST keeps long lists (up to 300 targets) out of the URL.
    const list = Array.isArray(hostnames) ? hostnames : String(hostnames).split(/[\n,]+/).map((h) => h.trim()).filter(Boolean);
    const response = await axios.post('/api/tools/bulk-check/', { hostnames: list }, {
      headers: { 'Accept': 'application/json' },
      timeout: 300000,
    });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error running bulk check');
  }
};

export const parseTargetFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await axios.post('/api/tools/parse-target-file/', formData, { timeout: 30000 });
    return response.data.targets;
  } catch (error) {
    handleRequestError(error, 'Failed to read target file');
  }
};

export const bulkCheckFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await axios.post('/api/tools/bulk-check-upload/', formData, { timeout: 300000 });
    return response.data;
  } catch (error) {
    handleRequestError(error, 'Failed to run bulk check from file');
  }
};

// CSV exports are built in the browser from results already on screen, so they
// don't re-run the (slow) DNSBL check and work on the public quick-check page.
const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Prefix formula-looking cells so spreadsheets don't execute them.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const downloadCsv = (rows, filename) => {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const safeFilename = (value) => String(value || 'export').replace(/[^a-z0-9._-]+/gi, '_');

export const downloadBlacklistCsv = (data) => {
  const detected = new Map((data?.detected_on || []).map((item) => [item.provider, item]));
  const failed = new Set(data?.failed_providers || []);
  const rows = [
    ['Hostname', data?.hostname || ''],
    ['Blacklisted', data?.is_blacklisted ? 'Yes' : 'No'],
    [],
    ['Provider', 'Status'],
    ...(data?.providers || []).map((provider) => [
      provider,
      detected.has(provider) ? (detected.get(provider).status === 'open' ? 'listed' : `listed (${detected.get(provider).status})`) : failed.has(provider) ? 'unavailable' : 'clear',
    ]),
  ];
  downloadCsv(rows, `blacklist-${safeFilename(data?.hostname)}.csv`);
};

export const downloadSubnetCsv = (data) => {
  const rows = [
    ['CIDR', data?.cidr || ''],
    ['Total IPs', data?.total_ips ?? 0],
    ['Blacklisted', data?.blacklisted_count ?? 0],
    [],
    ['IP', 'Blacklisted', 'Listed on'],
    ...(data?.results || []).map((result) => [result.ip, result.is_blacklisted ? 'Yes' : 'No', (result.listed_on || []).join('; ')]),
  ];
  downloadCsv(rows, `subnet-${safeFilename(data?.cidr)}.csv`);
};
