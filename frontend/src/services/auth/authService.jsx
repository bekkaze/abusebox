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

// Ends the session on the server too: every token issued to this account
// (on any device) stops working. Signing out locally still happens if it fails.
export const logoutUser = async () => {
  try {
    await axios.post('/api/user/logout/', null, { timeout: 5000 });
  } catch (error) {
    console.error('Error during logout:', error);
  }
};
