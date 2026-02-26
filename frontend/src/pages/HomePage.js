import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { formatMessageWithLinks } from '../utils/textFormatter';
import { getMenus, getSections, login as apiLogin, loginAsGuest, getPublicNotifications } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useVisibility } from '../contexts/VisibilityContext';
import ComingSoonWrapper from '../components/ComingSoonWrapper';
import HelpPopover from '../components/HelpPopover';
import AppTour from '../components/AppTour';
import MenuImagePlaceholder from '../components/MenuImagePlaceholder';
import { isComingSoon } from '../utils/featureStatus';

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, currentUser, checking, logout: authLogout, setAuth, enableOfflineGuest, isGuest, canWrite } = useAuth();
  const toast = useToast();
  // Текущая тема и переключатель.
  const { theme, toggleTheme } = useTheme();
  const { isVisible, isFeatureComingSoon, isFeatureAccessAllowed } = useVisibility();
  const isDarkTheme = theme === 'dark';
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenuPanel, setShowMenuPanel] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('menuLanguage') || 'RU';
  });
  // Состояние для тура по приложению
  const [showTour, setShowTour] = useState(false);

  // Ключ для списка прочитанных уведомлений (храним локально на устройстве)
  const NOTIFICATIONS_READ_KEY = 'sabor.notificationsReadIds.v1';

  const readNotificationIds = () => {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_READ_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (error) {
      return [];
    }
  };

  const writeNotificationIds = (ids) => {
    try {
      localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(ids));
    } catch (error) {
      // Если localStorage недоступен — просто молча пропускаем.
    }
  };

  // Функция для загрузки уведомлений
  const loadNotifications = async () => {
    try {
      const data = await getPublicNotifications();
      const readIds = readNotificationIds();
      const normalized = data.map((item) => ({
        ...item,
        // Прочитано ли уведомление на этом устройстве
        read: readIds.includes(String(item.id)),
      }));
      setNotifications(normalized);
      setUnreadCount(normalized.filter((n) => !n.read).length);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  // Состояние для конфига меню
  const [menuConfig, setMenuConfig] = useState(null);

  useEffect(() => {
    const loadMenus = async () => {
      try {
        const [data, configRes] = await Promise.all([
          getMenus(),
          fetch('/data/menu-config.json').then(r => r.ok ? r.json() : null)
        ]);
        setMenus(data);
        setMenuConfig(configRes);
      } catch (err) {
        setError('Ошибка загрузки меню. Убедитесь, что сервер запущен.');
        console.error('Ошибка загрузки меню:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMenus();

    // Загружаем уведомления при монтировании
    loadNotifications();

    // Показываем модальное окно входа, если не авторизован (только после завершения проверки)
    // Скрываем, если пользователь авторизован (и это не гость, который хочет войти)
    if (!checking) {
      if (isAuthenticated) {
        // Если это гость и в состоянии роутера есть просьба показать вход — не закрываем
        if (!(isGuest && location.state?.showLogin)) {
          setShowLoginModal(false);
        }

        // Проверяем, проходил ли пользователь тур раньше
        const tourCompleted = localStorage.getItem('sabor.tourCompleted');
        if (!tourCompleted && !isGuest) {
          setTimeout(() => {
            setShowTour(true);
          }, 1000);
        }
      } else {
        setShowLoginModal(true);
      }
    }
  }, [checking, isAuthenticated, isGuest, location.state]);

  const [imageErrors, setImageErrors] = useState({});

  const handleImageError = (menuName) => {
    setImageErrors(prev => ({ ...prev, [menuName]: true }));
  };
  // Обработка принудительного открытия модалки входа (например, из GuestBlocker)
  useEffect(() => {
    if (location.state?.showLogin && isGuest) {
      setShowLoginModal(true);
      // Очищаем state, чтобы при обновлении страницы или навигации назад модалка не открывалась снова
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, isGuest, navigate]);

  // Обновляем уведомления, если в другой вкладке поменялись "прочитанные"
  // А также при фокусе окна и периодически (раз в 60 сек)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === NOTIFICATIONS_READ_KEY || e.key === null) {
        loadNotifications();
      }
    };

    const handleFocus = () => {
      loadNotifications();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    // Периодическое обновление, чтобы ловить новые уведомления от админа
    const intervalId = setInterval(loadNotifications, 60000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, []);

  // Закрытие меню уведомлений при клике вне его области
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Не закрываем, если клик был на кнопке колокольчика или внутри панели
      if (showNotifications &&
        !e.target.closest('.notifications-panel') &&
        !e.target.closest('button[aria-label="notifications"]') &&
        !e.target.closest('.notifications-button')) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      // Небольшая задержка, чтобы не закрыть сразу после открытия
      const timeout = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeout);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showNotifications]);

  // Обработка свайпов для закрытия панелей
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && showNotifications) {
      setShowNotifications(false);
    }
    if (isRightSwipe && showMenuPanel) {
      setShowMenuPanel(false);
    }
  };

  const TEA_MENU_NAME = 'Чай';
  const TEA_MENU_DESCRIPTION = 'Полезные напитки';
  const TEA_MENU_ICON = 'emoji_food_beverage';
  const TEA_MENU_IMAGE = '/images/covers/tea-head.webp';
  const MENU_ORDER_MATCHERS = [
    { key: 'основн', match: (name) => name.includes('основн') },
    { key: 'завтрак', match: (name) => name.includes('завтрак') },
    { key: 'зимн', match: (name) => name.includes('зимн') },
    { key: 'каникул', match: (name) => name.includes('каникул') },
    { key: 'детск', match: (name) => name.includes('детск') },
    { key: 'постн', match: (name) => name.includes('постн') },
    { key: 'специальн', match: (name) => name.includes('специальн') },
    { key: 'барн', match: (name) => name.includes('барн') },
    { key: 'вино', match: (name) => name.includes('вино') },
    { key: 'чай', match: (name) => name.includes('чай') }
  ];

  const getMenuOrderIndex = (menuName) => {
    const lowerName = menuName.toLowerCase();
    // Ищем нужный порядок по ключевым словам.
    const matchedIndex = MENU_ORDER_MATCHERS.findIndex((item) => item.match(lowerName));
    return matchedIndex === -1 ? Number.POSITIVE_INFINITY : matchedIndex;
  };

  // Функция для получения описания меню
  const getMenuDescription = (menuName) => {
    if (!menuConfig) {
      // Фолбэк на старую логику, если конфиг не загружен
      const menuLower = menuName.toLowerCase();
      if (menuLower.includes('основн')) return 'Главные позиции ресторана';
      if (menuLower.includes('завтрак')) return 'Утреннее меню от Шефа';
      if (menuLower.includes('детск')) return 'Любимые блюда для детей';
      if (menuLower.includes('чай')) return 'Полезные напитки';
      return '';
    }

    const groups = Object.values(menuConfig);
    const group = groups.find(g => g.items?.includes(menuName));
    return group?.description || '';
  };

  // Функция для получения иконки по названию меню
  const getMenuIcon = (menuName) => {
    if (menuConfig) {
      const groups = Object.values(menuConfig);
      const group = groups.find(g => g.items?.includes(menuName));
      if (group?.icon) return group.icon;
    }

    const menuLower = menuName.toLowerCase();
    if (menuLower.includes('основн')) return 'restaurant';
    if (menuLower.includes('завтрак')) return 'bakery_dining';
    if (menuLower.includes('чай')) return 'emoji_food_beverage';
    return 'restaurant_menu';
  };

  // Функция для получения изображения меню
  const getMenuImage = (menuName) => {
    if (menuConfig) {
      const groups = Object.values(menuConfig);
      const group = groups.find(g => g.items?.includes(menuName));
      if (group) {
        if (group.images && group.images[menuName]) return group.images[menuName];
        if (group.image) return group.image;
      }
    }

    const menuLower = menuName.toLowerCase();
    if (menuLower.includes('основн')) return '/images/covers/main-menu-head.webp';
    if (menuLower.includes('завтрак')) return '/images/covers/breakfast-head.webp';
    if (menuLower.includes('чай')) return '/images/covers/tea-head.webp';
    return null;
  };



  // Обработчик входа
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);

    try {
      const result = await apiLogin(loginForm.username, loginForm.password, rememberMe);
      setAuth(result.user || null); // Обновляем контекст авторизации
      setLoginForm({ username: '', password: '' });
      setShowLoginModal(false); // Скрываем модальное окно входа после успешного входа
    } catch (error) {
      setLoginError(error.response?.data?.error || 'Неверный логин или пароль');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Обработчик входа как гость
  const handleGuestLogin = async () => {
    setLoginError(null);
    setLoginSubmitting(true);

    try {
      const result = await loginAsGuest();
      setAuth(result.user || null); // Обновляем контекст авторизации
      setShowLoginModal(false); // Скрываем модальное окно входа после успешного входа
    } catch (error) {
      // Если сервер недоступен — включаем офлайн-гостя (только просмотр меню).
      // Так меню будет доступно даже при падении API.
      const msg = error?.response?.data?.error || error?.message || 'Ошибка входа в гостевой режим';
      setLoginError(`${msg}. Включаем офлайн‑режим просмотра меню.`);
      enableOfflineGuest();
      setShowLoginModal(false);
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Обработчик выхода
  const handleLogout = async () => {
    try {
      await authLogout();
      setShowLogoutConfirm(false);
      setShowMenuPanel(false);
      // Модальное окно входа покажется автоматически через useEffect, когда isAuthenticated станет false
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-[#181311] dark:text-white font-display antialiased min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-primary text-xl font-bold">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-[#181311] dark:text-white font-display antialiased min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-red-500 text-lg font-bold mb-2">{error}</div>
          {isAuthenticated && currentUser?.role === 'администратор' && (
            <Link to="/admin" className="text-primary hover:underline">Перейти в админ-панель</Link>
          )}
        </div>
      </div>
    );
  }

  const menuCards = [
    ...menus
      .filter((menuName) => menuName.toLowerCase() !== TEA_MENU_NAME.toLowerCase())
      .map((menuName, originalIndex) => ({
        type: 'menu',
        name: menuName,
        originalIndex,
        orderIndex: getMenuOrderIndex(menuName)
      })),
    {
      type: 'tea',
      name: TEA_MENU_NAME,
      originalIndex: menus.length,
      orderIndex: getMenuOrderIndex(TEA_MENU_NAME)
    }
  ];
  // Сортируем плашки по заданной логике, остальные — после них.
  const sortedMenuCards = menuCards
    .slice()
    .sort((a, b) => (a.orderIndex !== b.orderIndex ? a.orderIndex - b.orderIndex : a.originalIndex - b.originalIndex));

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden pb-20 bg-background-light dark:bg-background-dark text-[#181311] dark:text-white font-display antialiased" style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center bg-white/95 dark:bg-[#181311]/95 backdrop-blur-sm p-4 pb-2 justify-between border-b border-orange-100/50 dark:border-gray-800 shadow-sm transition-all">
        <button
          onClick={() => setShowMenuPanel(true)}
          className="text-[#181311] dark:text-white flex size- shrink-0 items-center justify-center rounded-full hover:bg-orange-50 dark:hover:bg-white/5 transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <img
          // Абсолютный путь: чтобы логотип работал на любых маршрутах (например, /menu/..., /wine-catalog/...)
          src="/icons/logo.png"
          alt="Sabor de la Vida"
          className="h-8 mx-auto"
        />
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Обновляем уведомления при открытии панели
              loadNotifications();
              const newState = !showNotifications;
              setShowNotifications(newState);
            }}
            className="notifications-button text-[#181311] dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-orange-50 dark:hover:bg-white/5 transition-colors relative"
            aria-label="notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {/* Полноэкранный оверлей уведомлений */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setShowNotifications(false)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                  zIndex: 9998,
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0
                }}
              />
              <div
                className="notifications-panel fixed top-0 right-0 h-screen w-full max-w-md bg-white dark:bg-[#181311] shadow-2xl z-[9999] overflow-y-auto transform transition-transform duration-300 ease-out"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                  zIndex: 9999,
                  position: 'fixed',
                  top: 0,
                  right: 0,
                  height: '100vh',
                  maxHeight: '100vh',
                  overflowY: 'auto'
                }}
              >
                <div className="sticky top-0 bg-white dark:bg-[#181311] z-10 border-b border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-[#181311] dark:text-white">Уведомления</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        const allIds = notifications.map((n) => String(n.id)).filter(Boolean);
                        const mergedIds = Array.from(new Set([...readNotificationIds(), ...allIds]));
                        writeNotificationIds(mergedIds);
                        const updated = notifications.map((n) => ({ ...n, read: true }));
                        setNotifications(updated);
                        setUnreadCount(0);
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      Отметить все как прочитанные
                    </button>
                  )}
                </div>
                <div
                  className="p-4"
                  style={{
                    minHeight: '200px',
                    position: 'relative',
                    zIndex: 10000,
                    paddingTop: '1rem',
                    paddingBottom: '1rem'
                  }}
                >
                  {notifications.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">notifications_off</span>
                      <p className="text-base">Нет уведомлений</p>
                      <p className="text-xs mt-2 opacity-70">Проверьте консоль для отладки</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notification, idx) => {
                        if (!notification.title && !notification.message) {
                          console.warn('Уведомление без title и message:', notification);
                          return null;
                        }
                        const displayDate = notification.createdAt || notification.date || notification.created_at;
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl mb-3 cursor-pointer transition-all ${!notification.read
                              ? 'bg-primary/10 border-l-4 border-primary shadow-sm'
                              : 'bg-gray-50 dark:bg-gray-900/50'
                              }`}
                            onClick={() => {
                              const readIds = new Set(readNotificationIds());
                              readIds.add(String(notification.id));
                              writeNotificationIds(Array.from(readIds));
                              const updated = notifications.map((n, i) =>
                                i === idx ? { ...n, read: true } : n
                              );
                              setNotifications(updated);
                              const newUnread = updated.filter((n) => !n.read).length;
                              setUnreadCount(newUnread);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <span className="material-symbols-outlined text-primary text-[24px] mt-0.5 flex-shrink-0">
                                {notification.type === 'update' ? 'update' :
                                  notification.type === 'announcement' ? 'campaign' :
                                    notification.type === 'attention' ? 'priority_high' : 'info'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className="font-bold text-base text-[#181311] dark:text-white break-words">
                                    {notification.title || 'Без названия'}
                                  </h4>
                                  {!notification.read && (
                                    <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 leading-relaxed break-words whitespace-pre-wrap">
                                  {formatMessageWithLinks(notification.message || 'Нет сообщения')}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                                  {displayDate && (
                                    <span>
                                      {new Date(displayDate).toLocaleDateString('ru-RU', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                  {notification.author && (
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[14px]">person</span>
                                      {notification.author}
                                    </span>
                                  )}
                                  {notification.expiresAt && (
                                    <span className="flex items-center gap-1 text-orange-600">
                                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                                      До {new Date(notification.expiresAt).toLocaleTimeString('ru-RU', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[#181311] dark:text-white tracking-tight text-xl font-bold leading-tight">
              Разделы меню
            </h2>
          </div>

        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {menus.length === 0 ? (
            <>
              {sortedMenuCards.map((card) => {
                if (card.type === 'tea') {
                  return (
                    <Link
                      key={card.name}
                      to="/tea"
                      className="group relative overflow-hidden rounded-xl aspect-[4/3] shadow-md shadow-orange-900/5 active:scale-[0.98] transition-all duration-300"
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                        style={{ backgroundImage: `url("${TEA_MENU_IMAGE}")` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end h-full">
                        <span className="material-symbols-outlined text-white mb-0.5 text-xl opacity-90">
                          {TEA_MENU_ICON}
                        </span>
                        <p className="text-white text-base font-bold leading-tight group-hover:text-primary transition-colors">
                          {TEA_MENU_NAME}
                        </p>
                        <p className="text-white/70 text-[10px] mt-0.5 font-medium uppercase tracking-wide">
                          {TEA_MENU_DESCRIPTION}
                        </p>
                      </div>
                    </Link>
                  );
                }

                const imageUrl = getMenuImage(card.name);
                const icon = getMenuIcon(card.name);
                const description = getMenuDescription(card.name);
                // Если это меню "Вино", переходим на каталог вин, иначе на обычную страницу меню
                const isWineMenu = card.name.toLowerCase().includes('вино');
                const linkTo = isWineMenu ? '/wine-catalog' : `/menu/${encodeURIComponent(card.name)}`;

                return (
                  <Link
                    key={card.name}
                    to={linkTo}
                    className="group relative overflow-hidden rounded-xl aspect-[4/3] shadow-md shadow-orange-900/5 active:scale-[0.98] transition-all duration-300"
                  >
                    {imageUrl ? (
                      <>
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                          style={{ backgroundImage: `url("${imageUrl}")` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-orange-100 dark:bg-gray-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary/40 dark:text-white/10 text-6xl">
                          {icon}
                        </span>
                      </div>
                    )}
                    {!imageUrl && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end h-full">
                      <span className="material-symbols-outlined text-white mb-0.5 text-xl opacity-90">
                        {icon}
                      </span>
                      <p className="text-white text-base font-bold leading-tight group-hover:text-primary transition-colors">
                        {card.name}
                      </p>
                      {description && (
                        <p className="text-white/70 text-[10px] mt-0.5 font-medium uppercase tracking-wide">
                          {description}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}

              <div className="col-span-2 text-center py-8">
                <p className="text-[#896f61] dark:text-gray-400 mb-4">Меню пока нет</p>
                {isAuthenticated && currentUser?.role === 'администратор' && (
                  <Link to="/admin" className="inline-block px-4 py-2 bg-primary text-white rounded-xl font-bold">
                    Админ-панель
                  </Link>
                )}
              </div>
            </>
          ) : (
            sortedMenuCards.map((card) => {
              if (card.type === 'tea') {
                const showTeaTile = isVisible({ scope: 'pageBlock', target: 'home.tile.tea' });
                if (!showTeaTile) {
                  return null;
                }
                return (
                  <Link
                    key={card.name}
                    to="/tea"
                    className="group relative overflow-hidden rounded-xl aspect-[4/3] shadow-md shadow-orange-900/5 active:scale-[0.98] transition-all duration-300"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url("${TEA_MENU_IMAGE}")` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end h-full">
                      <span className="material-symbols-outlined text-white mb-0.5 text-xl opacity-90">
                        {TEA_MENU_ICON}
                      </span>
                      <p className="text-white text-base font-bold leading-tight group-hover:text-primary transition-colors">
                        {TEA_MENU_NAME}
                      </p>
                      <p className="text-white/70 text-[10px] mt-0.5 font-medium uppercase tracking-wide">
                        {TEA_MENU_DESCRIPTION}
                      </p>
                    </div>
                  </Link>
                );
              }

              if (card.type === 'journal') {
                return (
                  <Link
                    key={card.name}
                    to="/useful"
                    className="group relative overflow-hidden rounded-xl aspect-[4/3] shadow-md shadow-orange-900/5 active:scale-[0.98] transition-all duration-300"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url("${card.image}")` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end h-full">
                      <span className="material-symbols-outlined text-white mb-0.5 text-xl opacity-90">
                        {card.icon}
                      </span>
                      <p className="text-white text-base font-bold leading-tight group-hover:text-primary transition-colors">
                        {card.name}
                      </p>
                      <p className="text-white/70 text-[10px] mt-0.5 font-medium uppercase tracking-wide">
                        {card.description}
                      </p>
                    </div>
                  </Link>
                );
              }

              const imageUrl = getMenuImage(card.name);
              const icon = getMenuIcon(card.name);
              const description = getMenuDescription(card.name);
              // Если это меню "Вино", переходим на каталог вин, иначе на обычную страницу меню
              const isWineMenu = card.name.toLowerCase().includes('вино');
              const linkTo = isWineMenu ? '/wine-catalog' : `/menu/${encodeURIComponent(card.name)}`;
              const menuLower = String(card.name || '').toLowerCase().trim();
              let tileTarget = null;
              if (menuLower.includes('маслениц')) tileTarget = 'home.tile.maslenitsa';
              else if (isWineMenu) tileTarget = 'home.tile.wine';
              else if (menuLower.includes('основ')) tileTarget = 'home.tile.main';
              else if (menuLower.includes('авторск') && menuLower.includes('завтра')) tileTarget = 'home.tile.breakfast';
              else if (menuLower.includes('зимн')) tileTarget = 'home.tile.winter';
              else if (menuLower.includes('детск')) tileTarget = 'home.tile.kids';
              else if (menuLower.includes('пост')) tileTarget = 'home.tile.plantBased';
              else if (menuLower.includes('бар')) tileTarget = 'home.tile.bar';
              else if (menuLower.includes('чай') || menuLower.includes('tea')) tileTarget = 'home.tile.tea';
              else if (menuLower.includes('специаль')) tileTarget = 'home.tile.special';

              if (tileTarget && !isVisible({ scope: 'pageBlock', target: tileTarget })) {
                return null;
              }

              return (
                <Link
                  key={card.name}
                  to={linkTo}
                  className="group relative overflow-hidden rounded-xl aspect-[4/3] shadow-md shadow-orange-900/5 active:scale-[0.98] transition-all duration-300"
                >
                  {imageUrl && !imageErrors[card.name] ? (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                        style={{ backgroundImage: `url("${imageUrl}")` }}
                      />
                      {/* Скрытый img для отлова ошибки загрузки */}
                      <img
                        src={imageUrl}
                        className="hidden"
                        alt=""
                        onError={() => handleImageError(card.name)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    </>
                  ) : (
                    <MenuImagePlaceholder menuName={card.name} className="p-0" />
                  )}
                  {!imageUrl && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end h-full">
                    <span className="material-symbols-outlined text-white mb-0.5 text-xl opacity-90">
                      {icon}
                    </span>
                    <p className="text-white text-base font-bold leading-tight group-hover:text-primary transition-colors">
                      {card.name}
                    </p>
                    {description && (
                      <p className="text-white/70 text-[10px] mt-0.5 font-medium uppercase tracking-wide">
                        {description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 bg-white dark:bg-[#181311] border-t border-orange-100 dark:border-gray-800 pb-safe z-40 w-full sabor-fixed">
        <div
          className={`grid ${(() => {
            const showFooterMenu = isVisible({ scope: 'menuItem', target: 'footer.menu' });
            const showFooterFavorites = isVisible({ scope: 'menuItem', target: 'footer.favorites' });
            const showFooterSearch = isVisible({ scope: 'menuItem', target: 'footer.search' });
            const showFooterTools = isVisible({ scope: 'menuItem', target: 'footer.tools' });
            const showFooterAdmin =
              isAuthenticated &&
              currentUser?.role === 'администратор' &&
              !showTour &&
              isVisible({ scope: 'menuItem', target: 'footer.admin' });
            const itemCount =
              (showFooterMenu ? 1 : 0) +
              (showFooterFavorites ? 1 : 0) +
              (showFooterSearch ? 1 : 0) +
              (showFooterTools ? 1 : 0) +
              (showFooterAdmin ? 1 : 0);
            if (itemCount >= 5) return 'grid-cols-5';
            if (itemCount === 4) return 'grid-cols-4';
            return 'grid-cols-3';
          })()
            } h-16`}
        >
          {isVisible({ scope: 'menuItem', target: 'footer.menu' }) && (
            <Link
              to="/"
              className="flex flex-col items-center justify-center gap-1 text-primary"
            >
              <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
              <span className="text-[10px] font-medium">Меню</span>
            </Link>
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.favorites' }) && (
            <>
              {isGuest ? (
                <button
                  disabled
                  data-tour="footer-favorites"
                  title="Доступно после входа"
                  className="flex flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-2xl">favorite</span>
                  <span className="text-[10px] font-medium">Избранное</span>
                </button>
              ) : (
                <Link
                  to="/favorites"
                  data-tour="footer-favorites"
                  className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">favorite</span>
                  <span className="text-[10px] font-medium">Избранное</span>
                </Link>
              )}
            </>
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.search' }) && (
            <button
              onClick={() => navigate('/search')}
              data-tour="footer-search"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">search</span>
              <span className="text-[10px] font-medium">Поиск</span>
            </button>
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.tools' }) && (
            <Link
              to="/info"
              data-tour="footer-info"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">new_releases</span>
              <span className="text-[10px] font-medium">Информация</span>
            </Link>
          )}
          {isAuthenticated &&
            currentUser?.role === 'администратор' &&
            !showTour &&
            isVisible({ scope: 'menuItem', target: 'footer.admin' }) && (
              <Link
                to="/admin"
                className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">person</span>
                <span className="text-[10px] font-medium">Админ-панель</span>
              </Link>
            )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)] bg-white dark:bg-[#181311]" />
      </footer>

      {/* Полноэкранная slide-in панель меню */}
      {showMenuPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity"
            onClick={() => setShowMenuPanel(false)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
          <div
            className="fixed top-0 left-0 h-full w-full max-w-sm bg-white dark:bg-[#181311] shadow-2xl z-[101] overflow-y-auto transform transition-transform duration-300 ease-out"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="sticky top-0 bg-white dark:bg-[#181311] z-10 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#181311] dark:text-white">Меню</h2>
              <button
                onClick={() => setShowMenuPanel(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {/* Индикация гостевого режима */}
            {isGuest && (
              <div className="mx-4 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 flex-shrink-0">visibility</span>
                <div className="flex-1">
                  <p className="text-blue-900 dark:text-blue-200 text-sm font-semibold mb-1">Гостевой / Demo режим</p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs">
                    Вы находитесь в режиме просмотра. Доступны только функции просмотра меню и блюд.
                  </p>
                </div>
              </div>
            )}
            {/* Информация о пользователе */}
            {isAuthenticated && !isGuest && currentUser && (
              <div className="mx-4 mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Вы вошли как:</p>
                <p className="text-base font-semibold text-[#181311] dark:text-white">{currentUser.name || currentUser.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Роль: {currentUser.role}</p>
              </div>
            )}
            <div className="p-4 space-y-2">
              {isVisible({ scope: 'pageBlock', target: 'home.sidebar.workSchedule' }) && (
                <ComingSoonWrapper
                  isComingSoon={isFeatureComingSoon('workSchedule')}
                  allowAccess={isFeatureAccessAllowed('workSchedule')}
                  language={language}
                  badgePosition="inline"
                >
                  <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-2xl">work</span>
                    <span className="text-base font-medium text-[#181311] dark:text-white">Режим работы</span>
                  </button>
                </ComingSoonWrapper>
              )}
              {isVisible({ scope: 'pageBlock', target: 'home.sidebar.banquets' }) && (
                <ComingSoonWrapper
                  isComingSoon={isFeatureComingSoon('banquets')}
                  allowAccess={isFeatureAccessAllowed('banquets')}
                  language={language}
                  badgePosition="inline"
                >
                  <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-2xl">celebration</span>
                    <span className="text-base font-medium text-[#181311] dark:text-white">Банкеты</span>
                  </button>
                </ComingSoonWrapper>
              )}
              {isVisible({ scope: 'pageBlock', target: 'home.sidebar.guestSituations' }) && (
                <ComingSoonWrapper
                  isComingSoon={isFeatureComingSoon('guestSituations')}
                  allowAccess={isFeatureAccessAllowed('guestSituations')}
                  language={language}
                  badgePosition="inline"
                >
                  <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-2xl">support_agent</span>
                    <span className="text-base font-medium text-[#181311] dark:text-white">Ситуации с гостем</span>
                  </button>
                </ComingSoonWrapper>
              )}
              {isVisible({ scope: 'pageBlock', target: 'home.sidebar.faq' }) && (
                <ComingSoonWrapper
                  isComingSoon={isFeatureComingSoon('faq')}
                  allowAccess={isFeatureAccessAllowed('faq')}
                  language={language}
                  badgePosition="inline"
                >
                  <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-2xl">help</span>
                    <span className="text-base font-medium text-[#181311] dark:text-white">Частые вопросы гостей</span>
                  </button>
                </ComingSoonWrapper>
              )}
              {isVisible({ scope: 'pageBlock', target: 'home.sidebar.checklists' }) && (
                <ComingSoonWrapper
                  isComingSoon={isFeatureComingSoon('checklists')}
                  allowAccess={isFeatureAccessAllowed('checklists')}
                  language={language}
                  badgePosition="inline"
                >
                  <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-2xl">checklist</span>
                    <span className="text-base font-medium text-[#181311] dark:text-white">Чек-листы</span>
                  </button>
                </ComingSoonWrapper>
              )}
              {isVisible({ scope: 'pageBlock', target: 'home.sidebar.servicePrinciples' }) && (
                <ComingSoonWrapper
                  isComingSoon={isFeatureComingSoon('servicePrinciples')}
                  allowAccess={isFeatureAccessAllowed('servicePrinciples')}
                  language={language}
                  badgePosition="inline"
                >
                  <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-2xl">diversity_3</span>
                    <span className="text-base font-medium text-[#181311] dark:text-white">Принципы сервиса</span>
                  </button>
                </ComingSoonWrapper>
              )}

              {/* Кнопка "Тур по приложению" */}
              <button
                onClick={() => {
                  setShowTour(true);
                  setShowMenuPanel(false); // Закрываем боковое меню
                }}
                className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-primary text-2xl">tour</span>
                <span className="text-base font-medium text-[#181311] dark:text-white">Тур по приложению</span>
              </button>
              {isVisible({ scope: 'pageBlock', target: 'home.sidebar.theme' }) && (
                <button
                  onClick={toggleTheme}
                  aria-pressed={isDarkTheme}
                  aria-label="Переключить тему"
                  className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-primary text-2xl">
                    {isDarkTheme ? 'dark_mode' : 'light_mode'}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-base font-medium text-[#181311] dark:text-white">Тема</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Сейчас: {isDarkTheme ? 'тёмная' : 'светлая'}
                    </span>
                  </span>
                </button>
              )}
              {isAuthenticated && isVisible({ scope: 'pageBlock', target: 'home.sidebar.logout' }) && (
                <button
                  onClick={() => {
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-primary text-2xl">logout</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Выйти из системы</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Модальное окно входа в систему */}
      {showLoginModal && (!isAuthenticated || showTour) && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] transition-opacity"
            onClick={() => {
              // Не позволяем закрыть модальное окно входа кликом вне его
              // Пользователь должен войти, чтобы использовать приложение
            }}
          />
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-tour="login-modal"
              className="bg-white dark:bg-[#181311] rounded-2xl shadow-2xl max-w-md w-full"
            >
              <div className="p-6">
                <h2 className="text-2xl font-bold text-[#181311] dark:text-white mb-2 text-center">
                  Вход в систему
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                  Введите логин и пароль выданные админом.
                </p>

                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-lg">error</span>
                      <p className="text-red-800 dark:text-red-200 text-sm">{loginError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-[#181311] dark:text-white mb-2">
                      Логин
                    </label>
                    <input
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#181311] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Введите логин"
                      required
                      disabled={loginSubmitting}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#181311] dark:text-white mb-2">
                      Пароль
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#181311] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="Введите пароль"
                        required
                        disabled={loginSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showPassword ? 'visibility' : 'visibility_off'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* "Запомнить меня" */}
                  <label className="flex items-center gap-3 select-none text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      disabled={loginSubmitting}
                    />
                    <span>Запомнить меня</span>
                  </label>

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full px-4 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loginSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                        <span>Вход...</span>
                      </>
                    ) : (
                      'Войти'
                    )}
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
                  disabled={loginSubmitting}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 text-[#181311] dark:text-white font-bold"
                >
                  <span className="material-symbols-outlined text-lg">visibility</span>
                  <span>Войти как гость / Demo режим</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Модальное окно подтверждения выхода */}
      {showLogoutConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] transition-opacity"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-[#181311] rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-xl font-bold text-[#181311] dark:text-white mb-4 text-center">
                  Как уже уходите? 😢
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                  Вы действительно хотите выйти из системы?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-[#181311] dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
                  >
                    Выйти
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}



      {/* Тур по приложению */}
      <AppTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onThemeToggle={toggleTheme}
        onToggleLoginModal={setShowLoginModal}
        onToggleMenu={setShowMenuPanel}
      />
    </div>
  );
}

export default HomePage;
