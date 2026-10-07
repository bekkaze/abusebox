import axios from 'axios';

const json = { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } };

export const getMe = async () => (await axios.get('/api/user/me/')).data;
export const listUsers = async () => (await axios.get('/api/user/list/')).data;
export const createUser = async (payload) => (await axios.post('/api/user/create/', payload, json)).data;
export const updateUser = async (id, payload) => (await axios.patch(`/api/user/${id}/`, payload, json)).data;
