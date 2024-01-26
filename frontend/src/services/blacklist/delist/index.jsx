import axios from "axios";
import { useAuth } from "../../auth/authProvider";

const DelistSerivce = () => {
  const { token } = useAuth();

  const delistRequest = async (body) => {
    try {
      const response = await axios.post('/api/blacklist/delist/',
      body, {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      handleRequestError(error, 'Error sent delist request');
    }
  };

  const handleRequestError = (error, customErrorMessage) => {
    if (error.response) {
      console.error(`HTTP error! status: ${error.response.status}`);
      throw new Error(`HTTP error! status: ${error.response.status}`);
    } else if (error.request) {
      console.error('No response received');
      throw new Error('No response received');
    } else {
      console.error(customErrorMessage || 'Error setting up the request', error.message);
      throw new Error(customErrorMessage || 'Error setting up the request');
    }
  };

  return {
    delistRequest,
  }
}

export default DelistSerivce;