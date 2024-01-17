import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const checkBlacklist = async (hostname) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/blacklist/quick-check/?hostname=${hostname}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`HTTP error! status: ${error.response.status}`);
      throw new Error(`HTTP error! status: ${error.response.status}`);
    } else if (error.request) {
      console.error('No response received');
      throw new Error('No response received');
    } else {
      console.error('Error setting up the request', error.message);
      throw new Error('Error setting up the request');
    }
  }
};
