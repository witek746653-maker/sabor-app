import axios from 'axios';

// Базовый URL API
// На Beget фронтенд и бэкенд работают на одном домене, поэтому используем относительный путь
// Если REACT_APP_API_URL не задан, используем пустую строку (относительный путь)
const API_URL = process.env.REACT_APP_API_URL || '';

// Создаём экземпляр axios с настройками
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Для работы с cookies (Flask-Login)
});

// ========== ПУБЛИЧНЫЕ API ==========

export const getDishes = async () => {
  const response = await api.get('/api/dishes');
  return response.data;
};

export const getDish = async (id) => {
  const response = await api.get(`/api/dishes/${id}`);
  return response.data;
};

export const getMenus = async () => {
  const response = await api.get('/api/menus');
  return response.data;
};

export const getSections = async (menuName = null) => {
  const params = menuName ? { menu: menuName } : {};
  const response = await api.get('/api/sections', { params });
  return response.data;
};

// ========== API ДЛЯ ВИН ==========

export const getWines = async () => {
  const response = await api.get('/api/wines');
  return response.data;
};

export const getWinesByCategory = async (category) => {
  const response = await api.get(`/api/wines/category/${category}`);
  return response.data;
};

export const getWine = async (id) => {
  const response = await api.get(`/api/wines/${id}`);
  return response.data;
};

// ========== API ДЛЯ БАРНОГО МЕНЮ ==========

export const getBarItems = async () => {
  const response = await api.get('/api/bar-items');
  return response.data;
};

// ========== АДМИНСКИЕ API ==========

export const login = async (username, password) => {
  const response = await api.post('/api/admin/login', { username, password });
  return response.data;
};

export const loginAsGuest = async () => {
  const response = await api.post('/api/admin/login/guest');
  return response.data;
};

export const logout = async () => {
  const response = await api.post('/api/admin/logout');
  return response.data;
};

export const checkAuth = async () => {
  const response = await api.get('/api/admin/check');
  return response.data;
};

export const saveDishes = async (dishes) => {
  const response = await api.post('/api/admin/dishes', dishes);
  return response.data;
};

export const updateDish = async (id, dish) => {
  const response = await api.put(`/api/admin/dishes/${id}`, dish);
  return response.data;
};

export const addDish = async (dish) => {
  const response = await api.put('/api/admin/dishes', dish);
  return response.data;
};

export const deleteDish = async (id) => {
  const response = await api.delete(`/api/admin/dishes/${id}`);
  return response.data;
};

// ========== API ДЛЯ ОБРАТНОЙ СВЯЗИ ==========

export const submitFeedback = async (feedbackData) => {
  const response = await api.post('/api/feedback', feedbackData);
  return response.data;
};

export const getFeedbackMessages = async () => {
  const response = await api.get('/api/admin/feedback');
  return response.data;
};

export const markFeedbackRead = async (messageId) => {
  const response = await api.put(`/api/admin/feedback/${messageId}/read`);
  return response.data;
};

export const deleteFeedbackMessage = async (messageId) => {
  const response = await api.delete(`/api/admin/feedback/${messageId}`);
  return response.data;
};

// ========== API ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ==========

export const getUsers = async () => {
  const response = await api.get('/api/admin/users');
  return response.data;
};

export const createUser = async (userData) => {
  const response = await api.post('/api/admin/users', userData);
  return response.data;
};

export const updateUser = async (userId, userData) => {
  const response = await api.put(`/api/admin/users/${userId}`, userData);
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/api/admin/users/${userId}`);
  return response.data;
};

export default api;

