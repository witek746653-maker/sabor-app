import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAuth, logout as apiLogout } from '../services/api';

// Создаём контекст авторизации
const AuthContext = createContext(null);

// Локальная “страховка” для режима просмотра, когда API временно недоступен.
// Важно: это НЕ настоящая авторизация на сервере, а только клиентский режим "только читать".
const OFFLINE_GUEST_KEY = 'sabor.offlineGuest.v1';

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
      // 0) Если пользователь включил "гостя офлайн" — не блокируем приложение ожиданием API.
      // Это нужно, чтобы меню показывалось даже при падении сервера.
      const offlineGuestEnabled = localStorage.getItem(OFFLINE_GUEST_KEY) === 'true';
      if (offlineGuestEnabled) {
        setIsAuthenticated(true);
        setCurrentUser({
          id: 'guest',
          name: 'Гость (офлайн)',
          username: 'guest',
          role: 'guest',
        });
        setChecking(false);
        // Параллельно всё равно пробуем проверить реальную авторизацию (если API уже вернулся).
      }

      try {
        const result = await checkAuth();
        setIsAuthenticated(result.authenticated);
        setCurrentUser(result.user || null);

        // Если реальная авторизация доступна — отключаем офлайн-гостя.
        if (result.authenticated) {
          localStorage.removeItem(OFFLINE_GUEST_KEY);
        }
      } catch (error) {
        // Если API недоступен, но включен офлайн-гость — оставляем его.
        const stillOfflineGuest = localStorage.getItem(OFFLINE_GUEST_KEY) === 'true';
        if (!stillOfflineGuest) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        // Если мы уже отпустили UI из-за офлайн-гостя — не “перезатираем” checking второй раз.
        setChecking(false);
      }
    };

    checkAuthentication();
  }, []);

  // Функция выхода
  const logout = React.useCallback(async () => {
    try {
      await apiLogout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem(OFFLINE_GUEST_KEY);
    } catch (error) {
      console.error('Ошибка выхода:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem(OFFLINE_GUEST_KEY);
    }
  }, []);

  // Функция для обновления состояния после входа
  const setAuth = React.useCallback((user) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  }, []);

  // Включить офлайн-гостя
  const enableOfflineGuest = React.useCallback(() => {
    try {
      localStorage.setItem(OFFLINE_GUEST_KEY, 'true');
    } catch {
      // ignore
    }
    setIsAuthenticated(true);
    setCurrentUser({
      id: 'guest',
      name: 'Гость (офлайн)',
      username: 'guest',
      role: 'guest',
    });
    setChecking(false);
  }, []);

  // Вспомогательные функции для проверки роли пользователя
  const isGuest = currentUser?.role === 'guest';
  const isAdmin = currentUser?.role === 'администратор';
  const canWrite = isAuthenticated && !isGuest;

  const value = React.useMemo(() => ({
    isAuthenticated,
    currentUser,
    checking,
    logout,
    setAuth,
    enableOfflineGuest,
    isGuest,
    isAdmin,
    canWrite
  }), [
    isAuthenticated,
    currentUser,
    checking,
    logout,
    setAuth,
    enableOfflineGuest,
    isGuest,
    isAdmin,
    canWrite
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

