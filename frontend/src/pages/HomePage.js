import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMenus, getSections, submitFeedback, login as apiLogin, loginAsGuest } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import GlobalSearch from '../components/GlobalSearch';
import ComingSoonWrapper from '../components/ComingSoonWrapper';
import HelpPopover from '../components/HelpPopover';
import { isComingSoon } from '../utils/featureStatus';

function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, checking, logout: authLogout, setAuth, enableOfflineGuest, isGuest, canWrite } = useAuth();
  const toast = useToast();
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    // Загружаем уведомления из localStorage
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    const saved = localStorage.getItem('unreadNotifications');
    return saved ? parseInt(saved) : 0;
  });
  const [showMenuPanel, setShowMenuPanel] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // По умолчанию включаем "Запомнить меня"
  const [loginError, setLoginError] = useState(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    name: '',
    type: 'question',
    message: ''
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('menuLanguage') || 'RU';
  });

  // Функция для загрузки уведомлений
  const loadNotifications = () => {
    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications);
        // Фильтруем только активные уведомления (не истекшие)
        // ВРЕМЕННО: показываем все уведомления для отладки
        const activeNotifications = parsed.filter(n => {
          // Если есть expiresAt, проверяем, не истекло ли
          if (n.expiresAt && n.expiresAt !== null) {
            try {
              const expiresDate = new Date(n.expiresAt);
              const now = new Date();
              const isActive = expiresDate > now;
              // ВРЕМЕННО: показываем все для отладки
              // return isActive;
              return true;
            } catch (error) {
              console.error('Ошибка парсинга даты expiresAt:', error, n);
              return true; // Если ошибка, показываем уведомление
            }
          }
          // Если expiresAt нет, считаем активным
          return true;
        });
        setNotifications(activeNotifications);
        const unread = activeNotifications.filter(n => !n.read).length;
        setUnreadCount(unread);
        localStorage.setItem('unreadNotifications', unread.toString());
      } catch (error) {
        console.error('Ошибка парсинга уведомлений:', error);
        setNotifications([]);
        setUnreadCount(0);
      }
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    const loadMenus = async () => {
      try {
        const data = await getMenus();
        setMenus(data);
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
    // Скрываем, если пользователь авторизован
    if (!checking) {
      if (isAuthenticated) {
        setShowLoginModal(false); // Если авторизован, скрываем модальное окно
      } else {
        setShowLoginModal(true); // Если не авторизован, показываем модальное окно входа
      }
    }
  }, [checking, isAuthenticated]);

  // useEffect для обработки уведомлений и изменений localStorage
  useEffect(() => {
    // Слушаем изменения в localStorage для обновления уведомлений в реальном времени
    const handleStorageChange = (e) => {
      if (e.key === 'notifications' || e.key === null) {
        loadNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
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

  // Функция для получения иконки по названию меню
  const getMenuIcon = (menuName) => {
    const menuLower = menuName.toLowerCase();
    if (menuLower.includes('основн') || menuLower.includes('горяч')) return 'restaurant';
    if (menuLower.includes('завтрак')) return 'bakery_dining';
    if (menuLower.includes('ланч')) return 'schedule';
    if (menuLower.includes('сезон')) return 'eco';
    if (menuLower.includes('напит') || menuLower.includes('бар')) return 'local_bar';
    if (menuLower.includes('десерт')) return 'icecream';
    if (menuLower.includes('детск')) return 'child_care';
    if (menuLower.includes('веган')) return 'spa';
    return 'restaurant_menu';
  };

  // Функция для получения описания меню
  const getMenuDescription = (menuName) => {
    const menuLower = menuName.toLowerCase();
    if (menuLower.includes('основн')) return 'Горячее • Салаты';
    if (menuLower.includes('завтрак')) return 'До 16:00';
    if (menuLower.includes('ланч')) return 'Пн-Пт 12-16';
    if (menuLower.includes('сезон')) return 'Осень 2023';
    if (menuLower.includes('напит') || menuLower.includes('бар')) return 'Бар & Кофе';
    if (menuLower.includes('десерт')) return 'Сладкое';
    if (menuLower.includes('детск')) return 'Для малышей';
    if (menuLower.includes('веган')) return 'Полезное';
    return '';
  };

  // Функция для получения изображения меню
  const getMenuImage = (menuName) => {
    const menuLower = menuName.toLowerCase();
    if (menuLower.includes('основн')) {
      return '/images/main-menu-head.webp';
    }
    if (menuLower.includes('завтрак')) {
      return '/images/breakfast-head.webp';
    }
    if (menuLower.includes('детск')) {
      return '/images/kids-menu-head.webp';
    }
    if (menuLower.includes('зимн')) {
      return '/images/winter-menu-head.webp';
    }
    if (menuLower.includes('постн')) {
      return '/images/post-menu-head.webp';
    }
    if (menuLower.includes('вино')) {
      return '/images/wine-menu-head.webp';
    }
    if (menuLower.includes('бар')) {
      return '/images/bar-menu-head.webp';
    }
    if (menuLower.includes('каникул')) {
      return '/images/italian-holydais-head.webp';
    }
    return null;
  };

  // Функция для обработки отправки формы обратной связи
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    
    // Гости не могут отправлять обратную связь
    if (isGuest) {
      setFeedbackError('Доступно после входа. Гостевой режим поддерживает только просмотр данных.');
      return;
    }
    
    // Проверяем, что есть текст сообщения
    if (!feedbackForm.message.trim()) {
      setFeedbackError('Пожалуйста, введите сообщение');
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    try {
      await submitFeedback({
        name: feedbackForm.name.trim() || '',
        type: feedbackForm.type,
        message: feedbackForm.message.trim()
      });

      // Успешная отправка
      setFeedbackSuccess(true);
      setFeedbackForm({ name: '', type: 'question', message: '' });
      
      // Закрываем модальное окно через 2 секунды
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSuccess(false);
      }, 2000);
    } catch (error) {
      setFeedbackError(error.response?.data?.error || error.message || 'Ошибка при отправке сообщения');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Функция для закрытия модального окна обратной связи
  const handleCloseFeedbackModal = () => {
    if (!feedbackSubmitting) {
      setShowFeedbackModal(false);
      setFeedbackForm({ name: '', type: 'question', message: '' });
      setFeedbackError(null);
      setFeedbackSuccess(false);
    }
  };

  // Функция для получения названия типа сообщения
  const getFeedbackTypeLabel = (type) => {
    const types = {
      question: '❓ Вопрос',
      bug: '🐞 Проблема / ошибка',
      suggestion: '💡 Предложение',
      greeting: '📚 Просто пожелать добра 😉 (мм.. лучше вышли донат)'
    };
    return types[type] || types.question;
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
                        setUnreadCount(0);
                        localStorage.setItem('unreadNotifications', '0');
                        const updated = notifications.map(n => ({ ...n, read: true }));
                        setNotifications(updated);
                        localStorage.setItem('notifications', JSON.stringify(updated));
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
                        return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl mb-3 cursor-pointer transition-all ${
                          !notification.read 
                            ? 'bg-primary/10 border-l-4 border-primary shadow-sm' 
                            : 'bg-gray-50 dark:bg-gray-900/50'
                        }`}
                        onClick={() => {
                          const updated = notifications.map((n, i) => 
                            i === idx ? { ...n, read: true } : n
                          );
                          setNotifications(updated);
                          localStorage.setItem('notifications', JSON.stringify(updated));
                          const newUnread = updated.filter(n => !n.read).length;
                          setUnreadCount(newUnread);
                          localStorage.setItem('unreadNotifications', newUnread.toString());
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
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 leading-relaxed break-words">
                              {notification.message || 'Нет сообщения'}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                              {notification.date && (
                                <span>
                                  {new Date(notification.date).toLocaleDateString('ru-RU', {
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
            <div className="col-span-2 text-center py-8">
              <p className="text-[#896f61] dark:text-gray-400 mb-4">Меню пока нет</p>
              {isAuthenticated && currentUser?.role === 'администратор' && (
                <Link to="/admin" className="inline-block px-4 py-2 bg-primary text-white rounded-xl font-bold">
                  Админ-панель
                </Link>
              )}
            </div>
          ) : (
            menus.map((menuName) => {
              const imageUrl = getMenuImage(menuName);
              const icon = getMenuIcon(menuName);
              const description = getMenuDescription(menuName);
              // Если это меню "Вино", переходим на каталог вин, иначе на обычную страницу меню
              const isWineMenu = menuName.toLowerCase().includes('вино');
              const linkTo = isWineMenu ? '/wine-catalog' : `/menu/${encodeURIComponent(menuName)}`;

              return (
                <Link
                  key={menuName}
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
                    <p className="text-white text-base font-bold leading-tight group-hover:text-primary transition-colors">{menuName}</p>
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
        <div className={`grid ${isAuthenticated && currentUser?.role === 'администратор' ? 'grid-cols-5' : 'grid-cols-4'} h-16`}>
          <Link
            to="/"
            className="flex flex-col items-center justify-center gap-1 text-primary"
          >
            <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
            <span className="text-[10px] font-medium">Меню</span>
          </Link>
          {isGuest ? (
            <button
              disabled
              title="Доступно после входа"
              className="flex flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-2xl">favorite</span>
              <span className="text-[10px] font-medium">Избранное</span>
            </button>
          ) : (
            <Link
              to="/favorites"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">favorite</span>
              <span className="text-[10px] font-medium">Избранное</span>
            </Link>
          )}
          <button 
            onClick={() => setShowGlobalSearch(true)}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">search</span>
            <span className="text-[10px] font-medium">Поиск</span>
          </button>
          <Link
            to="/tools"
            className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">new_releases</span>
            <span className="text-[10px] font-medium">Инструменты</span>
          </Link>
          {isAuthenticated && currentUser?.role === 'администратор' && (
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
              <ComingSoonWrapper isComingSoon={isComingSoon('workSchedule')} language={language} badgePosition="inline">
                <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">work</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Режим работы</span>
                </button>
              </ComingSoonWrapper>
              <ComingSoonWrapper isComingSoon={isComingSoon('banquets')} language={language} badgePosition="inline">
                <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">celebration</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Банкеты</span>
                </button>
              </ComingSoonWrapper>
              <ComingSoonWrapper isComingSoon={isComingSoon('guestSituations')} language={language} badgePosition="inline">
                <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">support_agent</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Ситуации с гостем</span>
                </button>
              </ComingSoonWrapper>
              <ComingSoonWrapper isComingSoon={isComingSoon('faq')} language={language} badgePosition="inline">
                <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">help</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Частые вопросы гостей</span>
                </button>
              </ComingSoonWrapper>
              <ComingSoonWrapper isComingSoon={isComingSoon('checklists')} language={language} badgePosition="inline">
                <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">checklist</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Чек-листы</span>
                </button>
              </ComingSoonWrapper>
              <ComingSoonWrapper isComingSoon={isComingSoon('servicePrinciples')} language={language} badgePosition="inline">
                <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">diversity_3</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Принципы сервиса</span>
                </button>
              </ComingSoonWrapper>
              <button 
                onClick={() => {
                  if (isGuest) {
                    // Показываем подсказку для гостей
                    toast.info('Доступно после входа. Гостевой режим поддерживает только просмотр данных.');
                    return;
                  }
                  setShowFeedbackModal(true);
                  setShowMenuPanel(false);
                }}
                disabled={isGuest}
                title={isGuest ? 'Доступно после входа' : 'Обратная связь'}
                className={`w-full text-left p-4 rounded-xl transition-colors flex items-center gap-3 ${
                  isGuest 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-900/50'
                }`}
              >
                <span className={`material-symbols-outlined text-2xl ${isGuest ? 'text-gray-400' : 'text-primary'}`}>feedback</span>
                <span className={`text-base font-medium ${isGuest ? 'text-gray-400' : 'text-[#181311] dark:text-white'}`}>
                  Обратная связь
                  {isGuest && <span className="text-xs text-gray-400 ml-2">(Доступно после входа)</span>}
                </span>
              </button>
              <ComingSoonWrapper isComingSoon={isComingSoon('theme')} language={language} badgePosition="inline">
                <button className="w-full text-left p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">palette</span>
                  <span className="text-base font-medium text-[#181311] dark:text-white">Тема</span>
                </button>
              </ComingSoonWrapper>
              {isAuthenticated && (
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
      {showLoginModal && !isAuthenticated && (
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
            <div className="bg-white dark:bg-[#181311] rounded-2xl shadow-2xl max-w-md w-full">
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

      {/* Глобальный поиск */}
      <GlobalSearch 
        isOpen={showGlobalSearch} 
        onClose={() => setShowGlobalSearch(false)} 
      />

      {/* Модальное окно обратной связи */}
      {showFeedbackModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] transition-opacity"
            onClick={handleCloseFeedbackModal}
          />
          <div 
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-[#181311] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Заголовок */}
              <div className="sticky top-0 bg-white dark:bg-[#181311] border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#181311] dark:text-white">
                    Обратная связь
                  </h2>
                  <HelpPopover title="Справка: обратная связь" icon="help" size="lg">
                    <div className="text-sm" style={{ opacity: 0.95 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Кому уходит сообщение</div>
                      <div style={{ opacity: 0.9 }}>
                        Сообщение попадает в раздел “Обратная связь” в админ‑панели. Его увидит администратор приложения/ресторана.
                      </div>

                      <details>
                        <summary>Зачем это нужно</summary>
                        <div style={{ marginTop: 6, opacity: 0.9 }}>
                          - сообщить об ошибке (“что-то не так на сайте”)
                          <br />- задать вопрос
                          <br />- предложить улучшение (меню, тексты, удобство)
                        </div>
                      </details>

                      <details>
                        <summary>Как написать, чтобы быстрее поняли</summary>
                        <div style={{ marginTop: 6, opacity: 0.9 }}>
                          1) Выберите тип сообщения
                          <br />2) Опишите “что хотели сделать → что получилось”
                          <br />3) Если это ошибка — добавьте шаги (1-2-3) и название блюда/страницы
                        </div>
                      </details>

                      <details>
                        <summary>Важно</summary>
                        <div style={{ marginTop: 6, opacity: 0.9 }}>
                          Это не чат “прямо сейчас”. Для срочных вопросов лучше использовать телефон/мессенджер ресторана.
                        </div>
                      </details>
                    </div>
                  </HelpPopover>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCloseFeedbackModal}
                    disabled={feedbackSubmitting}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              {/* Форма */}
              <form onSubmit={handleFeedbackSubmit} className="p-6 space-y-4">
                {/* Сообщение об успехе */}
                {feedbackSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                    <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                      Спасибо! Ваше сообщение отправлено.
                    </p>
                  </div>
                )}

                {/* Сообщение об ошибке */}
                {feedbackError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                    <p className="text-red-800 dark:text-red-200 text-sm font-medium">
                      {feedbackError}
                    </p>
                  </div>
                )}

                {/* Поле "Имя" (необязательно) */}
                <div>
                  <label className="block text-sm font-medium text-[#181311] dark:text-white mb-2">
                    Имя <span className="text-gray-400 text-xs">(необязательно)</span>
                  </label>
                  <input
                    type="text"
                    value={feedbackForm.name}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#181311] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="Ваше имя"
                    disabled={feedbackSubmitting || feedbackSuccess}
                  />
                </div>

                {/* Поле "Тип сообщения" */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="block text-sm font-medium text-[#181311] dark:text-white">
                      Тип сообщения <span className="text-red-500">*</span>
                    </label>
                    <HelpPopover title="Справка: тип сообщения" icon="help">
                      <div style={{ opacity: 0.9 }}>
                        Выберите категорию — так админ быстрее поймёт, что делать.
                        <details>
                          <summary>Подсказка по вариантам</summary>
                          <div style={{ marginTop: 6, opacity: 0.9 }}>
                            - <b>Вопрос</b>: “как найти…”, “что значит…”
                            <br />- <b>Проблема</b>: “не открывается”, “не грузится”
                            <br />- <b>Предложение</b>: “добавить/улучшить…”
                          </div>
                        </details>
                      </div>
                    </HelpPopover>
                  </div>
                  <select
                    value={feedbackForm.type}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, type: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#181311] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    required
                    disabled={feedbackSubmitting || feedbackSuccess}
                  >
                    <option value="question">❓ Вопрос</option>
                    <option value="bug">🐞 Проблема / ошибка</option>
                    <option value="suggestion">💡 Предложение</option>
                    <option value="greeting">📚 Просто пожелать добра 😉 (мм.. лучше вышли донат)</option>
                  </select>
                </div>

                {/* Поле "Сообщение" (обязательно) */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="block text-sm font-medium text-[#181311] dark:text-white">
                      Сообщение <span className="text-red-500">*</span>
                    </label>
                    <HelpPopover title="Справка: что писать" icon="help" size="lg">
                      <div style={{ opacity: 0.9 }}>
                        Пишите коротко и по делу — так быстрее исправят.
                        <details>
                          <summary>Шаблон (скопируйте)</summary>
                          <div style={{ marginTop: 6, opacity: 0.9 }}>
                            Что хотел сделать:
                            <br />Что получилось:
                            <br />Где это было (страница/блюдо):
                            <br />Шаги (1-2-3):
                          </div>
                        </details>
                      </div>
                    </HelpPopover>
                  </div>
                  <textarea
                    value={feedbackForm.message}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#181311] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    placeholder="Напишите ваше сообщение..."
                    rows={5}
                    required
                    disabled={feedbackSubmitting || feedbackSuccess}
                  />
                </div>

                {/* Кнопки */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseFeedbackModal}
                    disabled={feedbackSubmitting}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-[#181311] dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={feedbackSubmitting || feedbackSuccess || !feedbackForm.message.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {feedbackSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                        <span>Отправка...</span>
                      </>
                    ) : feedbackSuccess ? (
                      <>
                        <span className="material-symbols-outlined text-lg">check</span>
                        <span>Отправлено</span>
                      </>
                    ) : (
                      'Отправить'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default HomePage;
