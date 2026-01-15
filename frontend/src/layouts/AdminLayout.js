import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../services/api';

/**
 * AdminLayout - Единый layout для админ-панели
 * 
 * Архитектура:
 * - Левая колонка: Контент/Меню/Обучение (всё, что существует независимо от пользователей)
 * - Правая колонка: Администрирование/Управление (всё, что связано с пользователями)
 * - Центральная область: Рабочее пространство для отображения контента
 */
function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout: authLogout, checking } = useAuth();

  // Проверяем, является ли пользователь администратором
  const isAdmin = currentUser?.role === 'администратор';

  const handleLogout = async () => {
    try {
      await logout();
      authLogout();
      navigate('/admin/login');
    } catch (error) {
      console.error('Ошибка выхода:', error);
      // Даже если ошибка, сбрасываем состояние на клиенте
      authLogout();
      navigate('/admin/login');
    }
  };

  if (checking) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Проверка...</div>
      </div>
    );
  }

  // Определяем активный раздел по текущему пути
  const getActiveSection = () => {
    const path = location.pathname;
    if (path.includes('/admin/feedback')) return 'feedback';
    if (path.includes('/admin/notifications')) return 'notifications';
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/deploy')) return 'deploy';
    if (path.includes('/admin/help')) return 'help';
    if (path.includes('/admin/edit') || path.includes('/admin/add')) return 'dish-edit';
    if (path.includes('/admin/wine')) return 'wine';
    if (path.includes('/admin/bar')) return 'bar';
    return 'kitchen';
  };

  const activeSection = getActiveSection();

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased text-text-primary-light dark:text-text-primary-dark transition-colors duration-200 min-h-screen flex">
      {/* Левая колонка - Контент / Меню / Обучение */}
      <aside className="w-64 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-white/10 flex flex-col shrink-0">
        {/* Заголовок левой колонки */}
        <div className="p-4 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mb-1">
            Контент
          </h2>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Меню, блюда, описания
          </p>
        </div>

        {/* Меню левой колонки */}
        <nav className="flex-1 p-2">
          <Link
            to="/admin/kitchen"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
              activeSection === 'kitchen'
                ? 'bg-primary text-white'
                : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-xl">restaurant_menu</span>
            <span className="font-medium">Кухня</span>
          </Link>

          <Link
            to="/admin/wine"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
              activeSection === 'wine'
                ? 'bg-primary text-white'
                : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-xl">wine_bar</span>
            <span className="font-medium">Вино</span>
          </Link>

          <Link
            to="/admin/bar"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
              activeSection === 'bar'
                ? 'bg-primary text-white'
                : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-xl">local_bar</span>
            <span className="font-medium">Бар</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              // Подставляем menu для новых позиций, чтобы не выбирать вручную каждый раз
              const params = new URLSearchParams();
              if (activeSection === 'wine') params.set('menu', 'Вино');
              if (activeSection === 'bar') params.set('menu', 'Барное меню');
              const qs = params.toString();
              navigate(qs ? `/admin/add?${qs}` : '/admin/add');
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
              activeSection === 'dish-edit'
                ? 'bg-primary text-white'
                : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            <span className="font-medium">
              {activeSection === 'wine'
                ? 'Добавить вино'
                : activeSection === 'bar'
                ? 'Добавить напиток'
                : 'Добавить блюдо'}
            </span>
          </button>
        </nav>
      </aside>

      {/* Центральная рабочая область */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Верхняя панель с информацией о пользователе и выходом */}
        <header className="h-16 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold">Админ-панель</h1>
            {currentUser && (
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {currentUser.name} ({currentUser.role})
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          >
            Выйти
          </button>
        </header>

        {/* Контент (Outlet для вложенных маршрутов) */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Правая колонка - Администрирование / Управление */}
      {isAdmin && (
        <aside className="w-64 bg-surface-light dark:bg-surface-dark border-l border-gray-200 dark:border-white/10 flex flex-col shrink-0">
          {/* Заголовок правой колонки */}
          <div className="p-4 border-b border-gray-200 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mb-1">
              Управление
            </h2>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Пользователи и процессы
            </p>
          </div>

          {/* Меню правой колонки */}
          <nav className="flex-1 p-2">
            <Link
              to="/admin/users"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                activeSection === 'users'
                  ? 'bg-primary text-white'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-xl">people</span>
              <span className="font-medium">Пользователи</span>
            </Link>

            <Link
              to="/admin/feedback"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors relative ${
                activeSection === 'feedback'
                  ? 'bg-primary text-white'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-xl">feedback</span>
              <span className="font-medium">Обратная связь</span>
            </Link>

            <Link
              to="/admin/notifications"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                activeSection === 'notifications'
                  ? 'bg-primary text-white'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="font-medium">Уведомления</span>
            </Link>

            <Link
              to="/admin/deploy"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                activeSection === 'deploy'
                  ? 'bg-primary text-white'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-xl">sync</span>
              <span className="font-medium">Обновление</span>
            </Link>

            <Link
              to="/admin/help"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                activeSection === 'help'
                  ? 'bg-primary text-white'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-xl">help</span>
              <span className="font-medium">Справка</span>
            </Link>
          </nav>
        </aside>
      )}
    </div>
  );
}

export default AdminLayout;
