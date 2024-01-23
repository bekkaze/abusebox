import axios from 'axios';
import { useAuth } from '../auth/authProvider';

const HostnameService = () => {
  const { token } = useAuth();

  const createHostname = async (hostnameData) => {
    try {
      const response = await axios.post(
        '/api/hostname/',
        hostnameData,
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.data; 
    } catch (error) {
      console.error('Error creating hostname: ', error);
      throw error;
    }
  };

  const listHostname = async () => {
    try {
      const response = await axios.get(
        '/api/hostname/list/',
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error retrieve hostname list');
      throw error;
    }
  };

  const deleteHostname = async (id) => {
    try {
      const response = await axios.delete(
        `/api/hostname/${id}`,
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response;
    } catch (error) {
      console.error('Error delete hostname');
      throw error;
    }
  }

  return {
    createHostname,
    listHostname,
    deleteHostname,
  }
}

export default HostnameService;