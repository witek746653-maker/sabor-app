import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAdminSidebarStats, logout } from '../services/api';

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
  // Состояния мобильных меню (выдвижные панели)
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);

  // Проверяем, является ли пользователь администратором
  const isAdmin = currentUser?.role === 'администратор';
  const [sidebarStats, setSidebarStats] = useState({
    users: 0,
    feedbackUnread: 0,
    notificationsActive: 0,
    mediaLikesTotal: 0,
    visibilityRulesActive: 0,
    kitchenItems: 0,
    wineItems: 0,
    barItems: 0,
    teaItems: 0,
    artItems: 0,
  });
  const [sidebarStatsLoading, setSidebarStatsLoading] = useState(false);

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

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;

    const load = async () => {
      setSidebarStatsLoading(true);
      try {
        const data = await getAdminSidebarStats();
        if (!alive) return;
        setSidebarStats({
          users: Number(data?.users ?? 0),
          feedbackUnread: Number(data?.feedbackUnread ?? 0),
          notificationsActive: Number(data?.notificationsActive ?? 0),
          mediaLikesTotal: Number(data?.mediaLikesTotal ?? 0),
          visibilityRulesActive: Number(data?.visibilityRulesActive ?? 0),
          kitchenItems: Number(data?.kitchenItems ?? 0),
          wineItems: Number(data?.wineItems ?? 0),
          barItems: Number(data?.barItems ?? 0),
          teaItems: Number(data?.teaItems ?? 0),
          artItems: Number(data?.artItems ?? 0),
        });
      } catch (error) {
        if (alive) {
          console.error('Ошибка загрузки сайдбар-статистики:', error);
        }
      } finally {
        if (alive) setSidebarStatsLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [isAdmin, location.pathname]);

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
    if (path.includes('/admin/media')) return 'media';
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/deploy')) return 'deploy';
    if (path.includes('/admin/visibility')) return 'visibility';
    if (path.includes('/admin/help')) return 'help';
    if (path.includes('/admin/edit') || path.includes('/admin/add')) return 'dish-edit';
    if (path.includes('/admin/wine')) return 'wine';
    if (path.includes('/admin/bar')) return 'bar';
    if (path.includes('/admin/wine')) return 'wine';
    if (path.includes('/admin/bar')) return 'bar';
    if (path.includes('/admin/tea')) return 'tea';
    if (path.includes('/admin/paintings')) return 'art';
    if (path.includes('/admin/trainer')) return 'trainer';
    return 'kitchen';
  };

  const activeSection = getActiveSection();
  const closeMenus = () => {
    setIsLeftMenuOpen(false);
    setIsRightMenuOpen(false);
  };
  const handleNavClick = () => {
    closeMenus();
  };

  const renderBadgeValue = (value) => {
    if (sidebarStatsLoading) return '…';
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const Badge = ({ value }) => (
    <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-primary/15 text-primary">
      {renderBadgeValue(value)}
    </span>
  );

  const leftMenuContent = (
    <>
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
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'kitchen'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">restaurant_menu</span>
          <span className="font-medium">Кухня</span>
          <Badge value={sidebarStats.kitchenItems} />
        </Link>

        <Link
          to="/admin/wine"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'wine'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">wine_bar</span>
          <span className="font-medium">Вино</span>
          <Badge value={sidebarStats.wineItems} />
        </Link>

        <Link
          to="/admin/bar"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'bar'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">local_bar</span>
          <span className="font-medium">Бар</span>
          <Badge value={sidebarStats.barItems} />
        </Link>

        <Link
          to="/admin/tea"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'tea'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">local_cafe</span>
          <span className="font-medium">Чай</span>
          <Badge value={sidebarStats.teaItems} />
        </Link>

        <Link
          to="/admin/paintings"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'art'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">palette</span>
          <span className="font-medium">Картины</span>
          <Badge value={sidebarStats.artItems} />
        </Link>

        <Link
          to="/admin/trainer"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'trainer'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">school</span>
          <span className="font-medium">Тренажер</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            handleNavClick();
            // Подставляем menu для новых позиций, чтобы не выбирать вручную каждый раз
            const params = new URLSearchParams();
            if (activeSection === 'wine') params.set('menu', 'Вино');
            if (activeSection === 'bar') params.set('menu', 'Барное меню');
            if (activeSection === 'tea') params.set('menu', 'Чай');
            const qs = params.toString();
            navigate(qs ? `/admin/add?${qs}` : '/admin/add');
          }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'dish-edit'
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
                : activeSection === 'tea'
                  ? 'Добавить чай'
                  : activeSection === 'art'
                    ? 'Добавить картину'
                    : 'Добавить блюдо'}
          </span>
        </button>
      </nav>
    </>
  );

  const rightMenuContent = (
    <>
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
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'users'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">people</span>
          <span className="font-medium">Пользователи</span>
          <Badge value={sidebarStats.users} />
        </Link>

        <Link
          to="/admin/feedback"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors relative ${activeSection === 'feedback'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">feedback</span>
          <span className="font-medium">Обратная связь</span>
          <Badge value={sidebarStats.feedbackUnread} />
        </Link>

        <Link
          to="/admin/notifications"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'notifications'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">notifications</span>
          <span className="font-medium">Уведомления</span>
          <Badge value={sidebarStats.notificationsActive} />
        </Link>

        <Link
          to="/admin/media"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'media'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">favorite</span>
          <span className="font-medium">Медиа / лайки</span>
          <Badge value={sidebarStats.mediaLikesTotal} />
        </Link>

        <Link
          to="/admin/visibility"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'visibility'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">visibility</span>
          <span className="font-medium">Видимость / Фичи</span>
          <Badge value={sidebarStats.visibilityRulesActive} />
        </Link>

        <Link
          to="/admin/deploy"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'deploy'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">sync</span>
          <span className="font-medium">Обновление</span>
        </Link>

        <Link
          to="/admin/help"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${activeSection === 'help'
            ? 'bg-primary text-white'
            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
        >
          <span className="material-symbols-outlined text-xl">help</span>
          <span className="font-medium">Справка</span>
        </Link>
      </nav>
    </>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased text-text-primary-light dark:text-text-primary-dark transition-colors duration-200 min-h-screen flex">
      {/* Левая колонка - Контент / Меню / Обучение */}
      <aside className="hidden md:flex w-64 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-white/10 flex-col shrink-0">
        {leftMenuContent}
      </aside>

      {/* Центральная рабочая область */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Мобильная верхняя панель */}
        <header className="md:hidden bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              type="button"
              onClick={() => setIsLeftMenuOpen(true)}
              className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">menu</span>
              Контент
            </button>
            <div className="text-center">
              <h1 className="text-base font-bold">Админ-панель</h1>
              {currentUser && (
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  {currentUser.name}
                </span>
              )}
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setIsRightMenuOpen(true)}
                className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                Управление
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </button>
            ) : (
              <div className="w-[92px]" />
            )}
          </div>
          <div className="px-4 pb-3 flex items-center justify-between gap-3">
            {currentUser && (
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {currentUser.name} ({currentUser.role})
              </span>
            )}
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                На главную
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
              >
                Выйти
              </button>
            </div>
          </div>
        </header>

        {/* Верхняя панель с информацией о пользователе и выходом */}
        <header className="hidden md:flex h-16 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold">Админ-панель</h1>
            {currentUser && (
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {currentUser.name} ({currentUser.role})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              На главную
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              Выйти
            </button>
          </div>
        </header>

        {/* Контент (Outlet для вложенных маршрутов) */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Правая колонка - Администрирование / Управление */}
      {isAdmin && (
        <aside className="hidden md:flex w-64 bg-surface-light dark:bg-surface-dark border-l border-gray-200 dark:border-white/10 flex-col shrink-0">
          {rightMenuContent}
        </aside>
      )}

      {/* Мобильное левое меню (оверлей) */}
      {isLeftMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            onClick={closeMenus}
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть меню"
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-white/10 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
              <span className="text-sm font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                Контент
              </span>
              <button
                type="button"
                onClick={closeMenus}
                className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            {leftMenuContent}
          </aside>
        </div>
      )}

      {/* Мобильное правое меню (оверлей) */}
      {isRightMenuOpen && isAdmin && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            onClick={closeMenus}
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть меню"
          />
          <aside className="absolute right-0 top-0 h-full w-72 bg-surface-light dark:bg-surface-dark border-l border-gray-200 dark:border-white/10 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
              <span className="text-sm font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                Управление
              </span>
              <button
                type="button"
                onClick={closeMenus}
                className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            {rightMenuContent}
          </aside>
        </div>
      )}
    </div>
  );
}

export default AdminLayout;
