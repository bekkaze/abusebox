import axios from 'axios';

/** Activity across all assets (newest first). Pass `beforeId` to page back. */
export const listEvents = async ({ limit = 50, severity, beforeId } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (severity) params.set('severity', severity);
  if (beforeId) params.set('before_id', String(beforeId));
  const response = await axios.get(`/api/events/?${params}`);
  return response.data;
};

export const listAssetEvents = async (hostnameId, limit = 50) => {
  const response = await axios.get(`/api/hostname/${hostnameId}/events/?limit=${limit}`);
  return response.data;
};
