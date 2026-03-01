import axios from 'axios';

export const checkBlacklist = async (hostname) => {
  try {
    const query = new URLSearchParams({ hostname }).toString();
    const response = await axios.get(`/api/blacklist/quick-check/?${query}`, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 30000,
    });

    return response.data;
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
