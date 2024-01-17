// auth.js

import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

const authAxios = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const login = async (username, password) => {
  try {
    const response = await authAxios.post('/user/login/', {
      username,
      password,
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

export { login };
