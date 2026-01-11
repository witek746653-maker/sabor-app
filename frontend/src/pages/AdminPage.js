import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  login,
  logout,
  checkAuth,
  getDishes,
  saveDishes,
  deleteDish,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';

function AdminPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, setAuth, checking: authChecking } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Состояния для управления пользователями
  const [users, setUsers] = useState([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // ID пользователя, которого редактируем (null = создание нового)
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes' или 'users'
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'официант',
    customRole: ''
  });

  useEffect(() => {
    // Проверяем авторизацию и загружаем данные
    const check = async () => {
      if (authChecking) {
        return; // Ждём, пока AuthProvider проверит авторизацию
      }
      
      if (isAuthenticated && currentUser) {
        loadDishes();
        loadUsers();
      }
      setChecking(false);
    };
    check();
  }, [isAuthenticated, currentUser, authChecking]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const loginResult = await login(username, password);
      setAuth(loginResult.user || null); // Обновляем контекст авторизации
      setUsername('');
      setPassword('');
      loadDishes();
      loadUsers();
    } catch (error) {
      setError(error.response?.data?.error || 'Неверный логин или пароль');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Контекст авторизации обновится автоматически через AuthProvider
      navigate('/');
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  const loadDishes = async () => {
    setLoading(true);
    try {
      const data = await getDishes();
      setDishes(data);
    } catch (error) {
      alert('Ошибка загрузки блюд: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await saveDishes(dishes);
      alert('✅ Данные сохранены!');
    } catch (error) {
      alert('❌ Ошибка сохранения: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить это блюдо?')) return;

    try {
      await deleteDish(id);
      setDishes(dishes.filter((d) => d.id !== id));
      alert('✅ Блюдо удалено');
    } catch (error) {
      alert('❌ Ошибка удаления: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      // Используем произвольную роль, если выбрано "Другое"
      let roleToUse = userForm.role === 'Другое' ? userForm.customRole.trim() : userForm.role;
      
      // Проверяем, что если выбрано "Другое", то роль должна быть указана
      if (userForm.role === 'Другое' && !roleToUse) {
        alert('❌ Пожалуйста, введите произвольную роль');
        return;
      }
      
      // Если роль всё равно пустая, используем роль по умолчанию
      if (!roleToUse) {
        roleToUse = 'официант';
      }
      
      await createUser({
        name: userForm.name,
        username: userForm.username,
        password: userForm.password,
        role: roleToUse
      });
      setUserForm({ name: '', username: '', password: '', role: 'официант', customRole: '' });
      setEditingUser(null);
      setShowUserForm(false);
      loadUsers();
      alert('✅ Пользователь создан!');
    } catch (error) {
      alert('❌ Ошибка создания пользователя: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditUser = (user) => {
    // Заполняем форму данными пользователя для редактирования
    const role = ['официант', 'администратор', 'хостес'].includes(user.role) 
      ? user.role 
      : 'Другое';
    
    setUserForm({
      name: user.name,
      username: user.username,
      password: '', // Не заполняем пароль при редактировании
      role: role,
      customRole: role === 'Другое' ? user.role : ''
    });
    setEditingUser(user.id);
    setShowUserForm(true);
    // Прокручиваем к форме
    setTimeout(() => {
      const formElement = document.querySelector('[data-user-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      // Используем произвольную роль, если выбрано "Другое"
      let roleToUse = userForm.role === 'Другое' ? userForm.customRole.trim() : userForm.role;
      
      // Проверяем, что если выбрано "Другое", то роль должна быть указана
      if (userForm.role === 'Другое' && !roleToUse) {
        alert('❌ Пожалуйста, введите произвольную роль');
        return;
      }
      
      // Если роль всё равно пустая, используем роль по умолчанию
      if (!roleToUse) {
        roleToUse = 'официант';
      }
      
      // Подготавливаем данные для обновления
      const updateData = {
        name: userForm.name,
        username: userForm.username,
        role: roleToUse
      };
      
      // Добавляем пароль только если он указан (при редактировании можно оставить пустым)
      if (userForm.password && userForm.password.trim()) {
        updateData.password = userForm.password;
      }
      
      await updateUser(editingUser, updateData);
      setUserForm({ name: '', username: '', password: '', role: 'официант', customRole: '' });
      setEditingUser(null);
      setShowUserForm(false);
      loadUsers();
      alert('✅ Пользователь обновлён!');
    } catch (error) {
      alert('❌ Ошибка обновления пользователя: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Удалить этого пользователя?')) return;

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
      alert('✅ Пользователь удален');
    } catch (error) {
      alert('❌ Ошибка удаления: ' + (error.response?.data?.error || error.message));
    }
  };

  const filteredDishes = dishes.filter((dish) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      dish.title?.toLowerCase().includes(query) ||
      dish.description?.toLowerCase().includes(query) ||
      dish.menu?.toLowerCase().includes(query) ||
      dish.section?.toLowerCase().includes(query)
    );
  });

  // Проверяем, является ли текущий пользователь администратором
  const isAdmin = currentUser?.role === 'администратор';

  if (authChecking || checking) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Проверка...</div>
      </div>
    );
  }

  // Страница входа (форма входа показывается только если не авторизован)
  if (!isAuthenticated) {
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

  // Если пользователь авторизован, но не администратор - показываем сообщение об отказе в доступе
  if (isAuthenticated && !isAdmin) {
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

  // Страница со списком блюд (только для администраторов)
  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased text-text-primary-light dark:text-text-primary-dark transition-colors duration-200 min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-b border-gray-100 dark:border-white/5 transition-colors">
          <div className="flex items-center justify-between p-4 pb-3">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold leading-tight tracking-tight">Админ-панель</h1>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {currentUser?.name && `Вы вошли как: ${currentUser.name} (${currentUser.role})`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin/feedback')}
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">feedback</span>
                Обратная связь
              </button>
              <button
                onClick={() => navigate('/admin/notifications')}
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                Уведомления
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
              >
                Выйти
              </button>
            </div>
          </div>
          
          {/* Вкладки (табы) */}
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => setActiveTab('dishes')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dishes'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-white/10 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-white/20'
              }`}
            >
              Блюда
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-white/20'
                }`}
              >
                Пользователи
              </button>
            )}
          </div>
        </header>

        {/* Вкладка "Блюда" */}
        {activeTab === 'dishes' && (
          <>
            {/* Search */}
            <div className="px-4 py-3 bg-background-light dark:bg-background-dark sticky top-[108px] z-40">
              <div className="flex w-full items-center rounded-xl bg-surface-light dark:bg-surface-dark shadow-sm border border-transparent focus-within:border-primary/50 transition-colors h-12 mb-3">
                <div className="flex items-center justify-center pl-4 text-text-secondary-light dark:text-text-secondary-dark">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  className="flex w-full min-w-0 flex-1 bg-transparent border-none text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light/70 dark:placeholder:text-text-secondary-dark/70 focus:outline-none focus:ring-0 px-3 text-base font-normal leading-normal"
                  placeholder="Название, ингредиенты..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Dishes Count */}
            <div className="px-4 pb-2 flex justify-between items-end">
              <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
                Найдено {filteredDishes.length} блюд
              </span>
            </div>

            {/* Dishes List */}
            <div className="flex flex-col gap-3 px-4 pb-24">
              {loading ? (
                <div className="text-center py-8 text-text-secondary-light">Загрузка...</div>
              ) : filteredDishes.length === 0 ? (
                <div className="text-center py-8 text-text-secondary-light">
                  {searchQuery ? 'Блюда не найдены' : 'Блюда не загружены'}
                </div>
              ) : (
                filteredDishes.map((dish) => {
                  // Проверяем, находится ли блюдо в архиве
                  const isArchived = dish.status === 'в архиве';
                  
                  return (
                  <div
                    key={dish.id}
                    className={`flex flex-col bg-surface-light dark:bg-surface-dark rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group ${
                      isArchived ? 'opacity-50 grayscale' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-xl size-20 shrink-0"
                        style={{
                          backgroundImage: getDishImageUrl(dish)
                            ? `url('${getDishImageUrl(dish)}')`
                            : 'none',
                          backgroundColor: getDishImageUrl(dish) ? 'transparent' : '#e5e7eb',
                        }}
                      >
                        {!getDishImageUrl(dish) && (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-400 text-2xl">restaurant</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between py-0.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col">
                            <p className="text-text-primary-light dark:text-text-primary-dark text-base font-bold leading-tight">
                              {dish.title || 'Без названия'}
                            </p>
                            <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs mt-0.5">
                              {dish.description || 'Нет описания'}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-100 dark:border-orange-800/30">
                            {dish.menu || 'БЕЗ МЕНЮ'}: {dish.section || 'БЕЗ РАЗДЕЛА'}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => navigate(`/admin/edit/${dish.id}`)}
                              className="p-1.5 rounded-lg bg-gray-50 dark:bg-white/5 text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(dish.id)}
                              className="p-1.5 rounded-lg bg-gray-50 dark:bg-white/5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Индикатор статуса архива */}
                    {isArchived && (
                      <div className="absolute top-2 right-2 bg-gray-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                        В АРХИВЕ
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </>
        )}

        {/* Вкладка "Пользователи" (только для администраторов) */}
        {activeTab === 'users' && isAdmin && (
          <div className="px-4 pb-24">
            <div className="flex justify-between items-center mb-4 mt-4">
              <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Управление пользователями
              </h2>
              <button
                onClick={() => {
                  if (showUserForm) {
                    // Если форма открыта, сбрасываем её при закрытии
                    setUserForm({ name: '', username: '', password: '', role: 'официант', customRole: '' });
                    setEditingUser(null);
                  }
                  setShowUserForm(!showUserForm);
                }}
                className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showUserForm ? 'close' : 'person_add'}
                </span>
                {showUserForm ? 'Отменить' : 'Новый пользователь'}
              </button>
            </div>

            {/* Форма создания/редактирования пользователя */}
            {showUserForm && (
              <div className="mb-6 p-4 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5" data-user-form>
                <h3 className="text-base font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">
                  {editingUser ? 'Редактировать пользователя' : 'Создать нового пользователя'}
                </h3>
                <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      Имя
                    </label>
                    <input
                      type="text"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="w-full rounded-xl bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-12 px-4 text-base text-gray-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary"
                      placeholder="Введите имя"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      Логин
                    </label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full rounded-xl bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-12 px-4 text-base text-gray-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary"
                      placeholder="Введите логин"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      Пароль {editingUser && <span className="text-xs text-text-secondary-light">(оставьте пустым, если не хотите менять)</span>}
                    </label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full rounded-xl bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-12 px-4 text-base text-gray-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary"
                      placeholder={editingUser ? "Оставьте пустым, если не хотите менять пароль" : "Введите пароль"}
                      required={!editingUser}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      Роль
                    </label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full rounded-xl bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-12 px-4 text-base text-gray-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="официант">Официант</option>
                      <option value="администратор">Администратор</option>
                      <option value="хостес">Хостес</option>
                      <option value="Другое">Другое (произвольная роль)</option>
                    </select>
                    {userForm.role === 'Другое' && (
                      <input
                        type="text"
                        value={userForm.customRole}
                        onChange={(e) => setUserForm({ ...userForm, customRole: e.target.value })}
                        placeholder="Введите произвольную роль (обязательно)"
                        className="w-full rounded-xl bg-white dark:bg-[#2f221c] border border-gray-200 dark:border-gray-700 h-12 px-4 text-base text-gray-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary mt-2"
                        required={userForm.role === 'Другое'}
                      />
                    )}
                  </div>
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors"
                  >
                    {editingUser ? 'Сохранить изменения' : 'Создать пользователя'}
                  </button>
                </form>
              </div>
            )}

            {/* Список пользователей */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
                Всего пользователей: {users.length}
              </h3>
              {users.length === 0 ? (
                <div className="text-center py-8 text-text-secondary-light">
                  Пользователи не найдены
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5"
                  >
                    <div className="flex flex-col">
                      <p className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                        {user.name}
                      </p>
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Логин: {user.username} • Роль: {user.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Редактировать пользователя"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          title="Удалить пользователя"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Сообщение, если пользователь не администратор */}
        {activeTab === 'users' && !isAdmin && (
          <div className="px-4 py-8 text-center">
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              ⚠️ Доступ запрещён. Только администраторы могут управлять пользователями.
            </p>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mt-2 text-sm">
              Ваша роль: {currentUser?.role || 'не определена'}
            </p>
          </div>
        )}

        {/* Floating Action Button */}
        <Link
          to="/admin/add"
          className="fixed bottom-6 right-6 z-50 group flex h-14 px-4 cursor-pointer items-center justify-center rounded-full bg-primary hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-primary/30"
        >
          <span className="material-symbols-outlined text-white mr-1" style={{ fontSize: '20px' }}>add</span>
          <span className="text-white text-sm font-bold">Блюдо</span>
        </Link>
      </div>
    </div>
  );
}

export default AdminPage;
