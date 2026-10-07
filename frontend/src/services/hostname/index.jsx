import axios from 'axios';

const HostnameService = () => {
  // Authorization header is set globally by authProvider via
  // axios.defaults.headers.common['Authorization']. Do NOT set it
  // manually — the raw token can contain non-ISO-8859-1 characters
  // that cause XMLHttpRequest.setRequestHeader to throw.

  const createHostname = async (hostnameData) => {
    try {
      const response = await axios.post('/api/hostname/', hostnameData, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating hostname:', error);
      throw error;
    }
  };

  // includeResult=false returns only the compact `health` summary per asset.
  const listHostname = async (includeResult = true) => {
    try {
      const response = await axios.get(`/api/hostname/list/${includeResult ? '' : '?include_result=false'}`, {
        headers: { 'Accept': 'application/json' },
      });
      return response.data;
    } catch (error) {
      console.error('Error retrieving hostname list:', error);
      throw error;
    }
  };

  const deleteHostname = async (id) => {
    try {
      const response = await axios.delete(`/api/hostname/${id}`, {
        headers: { 'Accept': 'application/json' },
      });
      return response;
    } catch (error) {
      console.error('Error deleting hostname:', error);
      throw error;
    }
  };

  const createBulk = async (hostnames) => {
    try {
      const response = await axios.post('/api/hostname/bulk/', { hostnames }, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating hostnames in bulk:', error);
      throw error;
    }
  };

  const importCidr = async (payload) => {
    try {
      const response = await axios.post('/api/hostname/cidr-import/', payload, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error) {
      console.error('Error importing CIDR:', error);
      throw error;
    }
  };

  const getHostname = async (id) => {
    const response = await axios.get(`/api/hostname/${id}`, { headers: { 'Accept': 'application/json' } });
    return response.data;
  };

  const updateHostname = async (id, payload) => {
    const response = await axios.put(`/api/hostname/${id}`, payload, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });
    return response.data;
  };

  // Runs every enabled check synchronously; resolves once results are saved.
  const recheckHostname = async (id) => {
    const response = await axios.post(`/api/hostname/${id}/recheck/`, {}, {
      headers: { 'Accept': 'application/json' },
      timeout: 180000,
    });
    return response.data;
  };

  // action: recheck | delete | enable_monitoring | disable_monitoring | enable_alerts | disable_alerts
  const bulkAction = async (ids, action) => {
    const response = await axios.post('/api/hostname/bulk-action/', { ids, action }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });
    return response.data;
  };

  const getCheck = async (id, checkId) => {
    const response = await axios.get(`/api/hostname/${id}/checks/${checkId}`);
    return response.data;
  };

  const getHistory = async (id, limit = 100) => {
    const response = await axios.get(`/api/hostname/${id}/history/?limit=${limit}`);
    return response.data;
  };

  return {
    bulkAction,
    getCheck,
    getHistory,
    createHostname,
    getHostname,
    updateHostname,
    recheckHostname,
    listHostname,
    deleteHostname,
    createBulk,
    importCidr,
  };
};

export default HostnameService;
