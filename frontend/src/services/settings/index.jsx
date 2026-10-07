import axios from 'axios';

const json = { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } };

export const getSchedulerSettings = async () => (await axios.get('/api/settings/scheduler/')).data;
export const updateSchedulerSettings = async (payload) => (await axios.put('/api/settings/scheduler/', payload, json)).data;
export const getSchedulerStatus = async () => (await axios.get('/api/settings/scheduler/status/')).data;
export const runSchedulerNow = async () => (await axios.post('/api/settings/scheduler/run/')).data;

export const getNotificationSettings = async () => (await axios.get('/api/settings/notifications/')).data;
export const updateNotificationSettings = async (payload) => (await axios.put('/api/settings/notifications/', payload, json)).data;
export const sendTestNotification = async () => (await axios.post('/api/settings/notifications/test/')).data;
