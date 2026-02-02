import api from './api';

export const getVisibilityConfig = async (t) => {
  const params = t ? { t } : {};
  const response = await api.get('/api/config/visibility', { params, timeout: 8000 });
  return response.data;
};

export const getAdminVisibilityConfig = async () => {
  const response = await api.get('/api/admin/visibility');
  return response.data;
};

export const saveVisibilityDraft = async (config) => {
  const response = await api.post('/api/admin/visibility/draft', { config });
  return response.data;
};

export const publishVisibilityConfig = async (version = null) => {
  const payload = Number.isInteger(version) ? { version } : {};
  const response = await api.post('/api/admin/visibility/publish', payload);
  return response.data;
};

export const rollbackVisibilityConfig = async (version) => {
  const response = await api.post('/api/admin/visibility/rollback', { version });
  return response.data;
};
