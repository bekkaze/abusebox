import axios from 'axios';

// Login is a public endpoint — use a clean axios instance to avoid
// inheriting a potentially corrupted Authorization header.
const publicRequest = axios.create();
delete publicRequest.defaults.headers.common['Authorization'];

export const loginUser = async (username, password) => {
  try {
    const response = await publicRequest.post('/api/user/login/', {
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
