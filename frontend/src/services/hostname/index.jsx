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

  const listHostname = async () => {
    try {
      const response = await axios.get('/api/hostname/list/', {
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

  return {
    createHostname,
    listHostname,
    deleteHostname,
    createBulk,
    importCidr,
  };
};

export default HostnameService;
