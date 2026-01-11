import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, loginAsGuest } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * AdminLoginPage - Страница входа в админ-панель
 * Отображается отдельно, без AdminLayout
 */
function AdminLoginPage() {
  const navigate = useNavigate();
  const { setAuth, checking: authChecking, isAuthenticated, currentUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  // Если уже авторизован как админ - перенаправляем в админ-панель
  React.useEffect(() => {
    if (!authChecking && isAuthenticated && currentUser?.role === 'администратор') {
      navigate('/admin');
    }
  }, [authChecking, isAuthenticated, currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const loginResult = await login(username, password);
      setAuth(loginResult.user || null);
      setUsername('');
      setPassword('');
      navigate('/admin');
    } catch (error) {
      setError(error.response?.data?.error || 'Неверный логин или пароль');
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    try {
      const loginResult = await loginAsGuest();
      setAuth(loginResult.user || null);
      // Гость не должен заходить в админ-панель, перенаправляем на главную
      navigate('/');
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка входа в гостевой режим');
    }
  };

  if (authChecking) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Проверка...</div>
      </div>
    );
  }

  // Если уже авторизован как не-админ - показываем сообщение об отказе
  if (isAuthenticated && currentUser?.role !== 'администратор') {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col antialiased overflow-x-hidden transition-colors duration-300">
        <div className="relative flex flex-1 w-full flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="w-full max-w-[480px] flex flex-col gap-6 text-center">
            <div className="mb-6 h-24 w-24 overflow-hidden rounded-full shadow-lg bg-white dark:bg-gray-800 flex items-center justify-center p-1 mx-auto">
              <div className="h-full w-full rounded-full overflow-hidden bg-red-100 dark:bg-red-900/20 flex items-center justify-center relative">
                <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-4xl relative z-10">block</span>
              </div>
            </div>
            <h1 className="text-gray-900 dark:text-white tracking-tight text-2xl font-bold leading-tight px-4 pb-2">
              Доступ запрещён
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-base font-normal leading-normal px-4">
              Только администраторы могут редактировать информацию в меню.
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm font-normal leading-normal px-4">
              Ваша роль: <span className="font-bold">{currentUser?.role || 'не определена'}</span>
            </p>
            <div className="mt-4">
              <Link 
                to="/" 
                className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
              >
                Вернуться на главную
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col antialiased overflow-x-hidden transition-colors duration-300">
      <div className="relative flex flex-1 w-full flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-[480px] flex flex-col gap-6">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 h-24 w-24 overflow-hidden rounded-full shadow-lg bg-white dark:bg-gray-800 flex items-center justify-center p-1">
              <div className="h-full w-full rounded-full overflow-hidden bg-primary/10 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5"></div>
                <span className="material-symbols-outlined text-primary text-4xl relative z-10">restaurant_menu</span>
              </div>
            </div>
            <h1 className="text-gray-900 dark:text-white tracking-tight text-[32px] font-bold leading-tight px-4 pb-2">
              Вход в систему
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-base font-normal leading-normal px-4 max-w-xs mx-auto">
              Введите логин и пароль выданные админом.
            </p>
          </div>

          {/* Login Form */}
          <form className="flex flex-col gap-5 mt-4" onSubmit={handleLogin}>
            <div className="flex flex-col gap-2">
              <label className="text-gray-900 dark:text-gray-200 text-base font-medium leading-normal pl-1">
                Логин
              </label>
              <input
                autoComplete="username"
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-14 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                placeholder="Введите логин"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-gray-900 dark:text-gray-200 text-base font-medium leading-normal pl-1">
                Пароль
              </label>
              <div className="flex w-full items-stretch rounded-xl shadow-sm relative">
                <input
                  autoComplete="current-password"
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-14 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-[15px] pr-12 text-base font-normal leading-normal focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-4 text-gray-400 hover:text-primary transition-colors flex items-center justify-center cursor-pointer bg-transparent border-none outline-none focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm px-1">{error}</div>
            )}

            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 text-white text-base font-bold leading-normal tracking-[0.015em] shadow-md mt-2"
            >
              <span className="truncate">Войти</span>
            </button>
          </form>

          {/* Разделитель */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-[#181311] text-gray-500 dark:text-gray-400">
                или
              </span>
            </div>
          </div>

          {/* Кнопка входа как гость */}
          <button
            type="button"
            onClick={handleGuestLogin}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all duration-200 text-[#181311] dark:text-white text-base font-bold leading-normal tracking-[0.015em] border border-gray-200 dark:border-gray-700"
          >
            <span className="material-symbols-outlined text-xl mr-2">visibility</span>
            <span className="truncate">Войти как гость / Demo режим</span>
          </button>

          {/* Footer help */}
          <div className="mt-4 text-center">
            <Link to="/" className="text-primary hover:underline text-sm">
              ← Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;
