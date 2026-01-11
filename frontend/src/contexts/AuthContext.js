import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAuth, logout as apiLogout } from '../services/api';

// Создаём контекст авторизации
const AuthContext = createContext(null);

// Хук для использования контекста авторизации
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Провайдер контекста авторизации
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // Проверка авторизации при загрузке
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const result = await checkAuth();
        setIsAuthenticated(result.authenticated);
        setCurrentUser(result.user || null);
      } catch (error) {
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setChecking(false);
      }
    };

    checkAuthentication();
  }, []);

  // Функция выхода
  const logout = async () => {
    try {
      await apiLogout();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Ошибка выхода:', error);
      // Даже если ошибка, сбрасываем состояние на клиенте
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  // Функция для обновления состояния после входа (вызывается из AdminPage)
  const setAuth = (user) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  // Вспомогательные функции для проверки роли пользователя
  const isGuest = currentUser?.role === 'guest';
  const isAdmin = currentUser?.role === 'администратор';
  const canWrite = isAuthenticated && !isGuest; // Гость может только читать

  const value = {
    isAuthenticated,
    currentUser,
    checking,
    logout,
    setAuth,
    isGuest,
    isAdmin,
    canWrite
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
