import axios from 'axios';

export const checkBlacklist = async (hostname) => {
  try {
    const response = await axios.get(`/api/blacklist/quick-check/?hostname=${hostname}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    handleRequestError(error, 'Error checking blacklist');
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