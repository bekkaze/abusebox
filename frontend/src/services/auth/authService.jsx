import axios from 'axios';

export const loginUser = async (username, password) => {
  try {
    const response = await axios.post('/api/user/login/', {
      username,
      password,
    });

    if (response.data.access) {
      return response;
    }

    return response.data;
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
};