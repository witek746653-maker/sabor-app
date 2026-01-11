import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * UsersPage - Страница управления пользователями
 * Отображается в центральной области AdminLayout (правая колонка - администрирование)
 */
function UsersPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'официант',
    customRole: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

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
      let roleToUse = userForm.role === 'Другое' ? userForm.customRole.trim() : userForm.role;
      
      if (userForm.role === 'Другое' && !roleToUse) {
        alert('❌ Пожалуйста, введите произвольную роль');
        return;
      }
      
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
    const role = ['официант', 'администратор', 'хостес'].includes(user.role) 
      ? user.role 
      : 'Другое';
    
    setUserForm({
      name: user.name,
      username: user.username,
      password: '',
      role: role,
      customRole: role === 'Другое' ? user.role : ''
    });
    setEditingUser(user.id);
    setShowUserForm(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      let roleToUse = userForm.role === 'Другое' ? userForm.customRole.trim() : userForm.role;
      
      if (userForm.role === 'Другое' && !roleToUse) {
        alert('❌ Пожалуйста, введите произвольную роль');
        return;
      }
      
      if (!roleToUse) {
        roleToUse = 'официант';
      }
      
      const updateData = {
        name: userForm.name,
        username: userForm.username,
        role: roleToUse
      };
      
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

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Управление пользователями
        </h2>
        <button
          onClick={() => {
            if (showUserForm) {
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
        <div className="mb-6 p-4 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col p-4 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5"
              >
                <div className="flex flex-col mb-4">
                  <p className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
                    {user.name}
                  </p>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Логин: {user.username}
                  </p>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Роль: {user.role}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="flex-1 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-1"
                    title="Редактировать пользователя"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    <span className="text-xs font-medium">Изменить</span>
                  </button>
                  {user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="flex-1 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-1"
                      title="Удалить пользователя"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                      <span className="text-xs font-medium">Удалить</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UsersPage;
