import React, { useState, useEffect } from 'react';

/**
 * NotificationsPage - Страница управления уведомлениями
 * Отображается в центральной области AdminLayout (правая колонка - администрирование)
 */
function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'drafts', 'archive'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showBotSettings, setShowBotSettings] = useState(false);
  const [botSettings, setBotSettings] = useState(() => {
    const saved = localStorage.getItem('telegramBotSettings');
    return saved ? JSON.parse(saved) : {
      enabled: false,
      telegramToken: '',
      chatIds: [],
      autoModeration: false,
      keywords: []
    };
  });
  
  // Форма создания/редактирования уведомления
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: '', // 'закончился', 'изменилось', 'обратить внимание', 'гости спрашивают'
    type: 'announcement', // 'update', 'announcement', 'attention', 'question'
    lifetimeType: '', // 'shift_end', 'date', 'manual'
    expiresAt: '', // дата/время для 'date'
    author: '', // имя отправителя
    status: 'draft' // 'draft', 'active', 'archived'
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = () => {
    const saved = localStorage.getItem('adminNotifications');
    const savedDrafts = localStorage.getItem('notificationDrafts');
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotifications(parsed);
    }
    if (savedDrafts) {
      const parsed = JSON.parse(savedDrafts);
      setDrafts(parsed);
    }
  };

  const saveNotifications = (notifs) => {
    localStorage.setItem('adminNotifications', JSON.stringify(notifs));
    setNotifications(notifs);
  };

  const saveDrafts = (draftsList) => {
    localStorage.setItem('notificationDrafts', JSON.stringify(draftsList));
    setDrafts(draftsList);
  };

  // Получаем активные уведомления (не архив)
  const getActiveNotifications = () => {
    return notifications.filter(n => {
      if (n.status === 'archived') return false;
      if (n.lifetimeType === 'date' && n.expiresAt) {
        return new Date(n.expiresAt) > new Date();
      }
      if (n.lifetimeType === 'shift_end') {
        // Проверяем, не закончилась ли смена (можно настроить логику)
        return true; // Упрощенная версия
      }
      if (n.lifetimeType === 'manual') {
        return n.status === 'active';
      }
      // Если статус 'active', считаем активным
      return n.status === 'active';
    });
  };

  const handleCreate = () => {
    setEditingNotification(null);
    setFormData({
      title: '',
      message: '',
      category: '',
      type: 'announcement',
      lifetimeType: '',
      expiresAt: '',
      author: '',
      status: 'draft'
    });
    setShowCreateModal(true);
  };

  const handleEdit = (notification) => {
    setEditingNotification(notification);
    setFormData(notification);
    setShowCreateModal(true);
  };

  const handleSave = () => {
    // Критический фильтр: если срок жизни не задан - сообщение не отправляется
    if (!formData.lifetimeType) {
      alert('⚠️ Ошибка: Необходимо задать срок жизни уведомления!');
      return;
    }

    if (formData.lifetimeType === 'date' && !formData.expiresAt) {
      alert('⚠️ Ошибка: Необходимо указать дату окончания!');
      return;
    }

    if (!formData.title || !formData.message) {
      alert('⚠️ Ошибка: Заполните все обязательные поля!');
      return;
    }

    const notification = {
      ...formData,
      id: editingNotification?.id || `notif-${Date.now()}`,
      createdAt: editingNotification?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingNotification) {
      // Обновляем существующее
      if (notification.status === 'draft') {
        const updatedDrafts = drafts.map(d => 
          d.id === notification.id ? notification : d
        );
        saveDrafts(updatedDrafts);
      } else {
        const updated = notifications.map(n => 
          n.id === notification.id ? notification : n
        );
        saveNotifications(updated);
      }
    } else {
      // Создаем новое
      if (notification.status === 'draft') {
        saveDrafts([...drafts, notification]);
      } else {
        // Отправляем активное уведомление
        notification.status = 'active';
        saveNotifications([...notifications, notification]);
        // Отправляем в систему уведомлений для пользователей
        sendToUsers(notification);
      }
    }

    setShowCreateModal(false);
    loadNotifications();
  };

  const sendToUsers = (notification) => {
    try {
      // Получаем все уведомления пользователей
      const userNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
      
      // Создаем уведомление для пользователей (упрощенная версия без технических полей)
      const userNotification = {
        id: notification.id || `notif-${Date.now()}`,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'announcement',
        category: notification.category || '',
        read: false,
        date: new Date().toISOString(),
        author: notification.author || '',
        expiresAt: notification.expiresAt || null
      };
      
      // Добавляем в начало списка
      userNotifications.unshift(userNotification);
      
      // Сохраняем в localStorage
      localStorage.setItem('notifications', JSON.stringify(userNotifications));
      
      // Обновляем счетчик непрочитанных
      const unread = userNotifications.filter(n => !n.read).length;
      localStorage.setItem('unreadNotifications', unread.toString());
      
      // Триггерим событие для обновления в других компонентах
      window.dispatchEvent(new Event('storage'));
      
      console.log('Уведомление отправлено пользователям:', userNotification);
    } catch (error) {
      console.error('Ошибка отправки уведомления пользователям:', error);
      alert('Ошибка отправки уведомления: ' + error.message);
    }
  };

  const handleSendDraft = (draft) => {
    if (!draft.lifetimeType) {
      alert('⚠️ Ошибка: Необходимо задать срок жизни уведомления!');
      return;
    }

    if (draft.lifetimeType === 'date' && !draft.expiresAt) {
      alert('⚠️ Ошибка: Необходимо указать дату окончания!');
      return;
    }

    // Переводим черновик в активные
    const activeNotification = {
      ...draft,
      status: 'active',
      updatedAt: new Date().toISOString()
    };

    const updatedDrafts = drafts.filter(d => d.id !== draft.id);
    saveDrafts(updatedDrafts);
    saveNotifications([...notifications, activeNotification]);
    sendToUsers(activeNotification);
    loadNotifications();
  };

  const handleArchive = (notification) => {
    const updated = notifications.map(n => 
      n.id === notification.id ? { ...n, status: 'archived' } : n
    );
    saveNotifications(updated);
    loadNotifications();
  };

  const handleDelete = (notification, isDraft = false) => {
    if (!window.confirm('Удалить это уведомление?')) return;
    
    if (isDraft) {
      const updated = drafts.filter(d => d.id !== notification.id);
      saveDrafts(updated);
    } else {
      const updated = notifications.filter(n => n.id !== notification.id);
      saveNotifications(updated);
    }
    loadNotifications();
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'закончился': return 'inventory_2';
      case 'изменилось': return 'edit';
      case 'обратить внимание': return 'priority_high';
      case 'гости спрашивают': return 'help';
      default: return 'info';
    }
  };

  const getLifetimeText = (notification) => {
    if (notification.lifetimeType === 'shift_end') {
      return 'До конца смены';
    }
    if (notification.lifetimeType === 'date' && notification.expiresAt) {
      const date = new Date(notification.expiresAt);
      const now = new Date();
      const diff = date - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diff < 0) return 'Истекло';
      if (hours > 0) return `Осталось: ${hours}ч ${minutes}м`;
      return `Осталось: ${minutes}м`;
    }
    if (notification.lifetimeType === 'manual') {
      return 'Вручную';
    }
    return 'Не задано';
  };

  const activeNotifications = getActiveNotifications();

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Управление уведомлениями</h2>
        </div>
        <div className="flex gap-2">
            <button
              onClick={() => setShowBotSettings(true)}
              className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined">smart_toy</span>
              Бот
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-semibold hover:bg-primary/20 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined">visibility</span>
              Предпросмотр
            </button>
            <button
              onClick={handleCreate}
              className="bg-primary text-white px-4 py-2 rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined">add</span>
              Создать
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'active'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Активные ({activeNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'drafts'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Черновики ({drafts.length})
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'archive'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Архив
          </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
          {activeTab === 'active' && (
            <>
              {activeNotifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">notifications_off</span>
                  <p>Нет активных уведомлений</p>
                </div>
              ) : (
                activeNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-800"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-2xl">
                          {getCategoryIcon(notification.category)}
                        </span>
                        <div>
                          <h3 className="font-bold text-lg text-[#181311] dark:text-white">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {notification.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(notification)}
                          className="text-gray-500 hover:text-primary"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          onClick={() => handleArchive(notification)}
                          className="text-gray-500 hover:text-orange-600"
                        >
                          <span className="material-symbols-outlined">archive</span>
                        </button>
                        <button
                          onClick={() => handleDelete(notification)}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{notification.message}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {notification.author && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">person</span>
                          {notification.author}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        {getLifetimeText(notification)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        {new Date(notification.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'drafts' && (
            <>
              {drafts.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">drafts</span>
                  <p>Нет черновиков</p>
                </div>
              ) : (
                drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-800 border-dashed"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400 text-2xl">drafts</span>
                        <div>
                          <h3 className="font-bold text-lg text-[#181311] dark:text-white">
                            {draft.title || 'Без названия'}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {draft.category || 'Категория не выбрана'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(draft)}
                          className="text-gray-500 hover:text-primary"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          onClick={() => handleSendDraft(draft)}
                          className="bg-primary text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-primary/90"
                          disabled={!draft.lifetimeType}
                        >
                          Отправить
                        </button>
                        <button
                          onClick={() => handleDelete(draft, true)}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{draft.message || 'Сообщение не заполнено'}</p>
                    {!draft.lifetimeType && (
                      <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                        ⚠️ Необходимо задать срок жизни для отправки
                      </p>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'archive' && (
            <>
              {notifications.filter(n => n.status === 'archived').length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">archive</span>
                  <p>Архив пуст</p>
                </div>
              ) : (
                notifications.filter(n => n.status === 'archived').map((notification) => (
                  <div
                    key={notification.id}
                    className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-800 opacity-60"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400 text-2xl">
                          {getCategoryIcon(notification.category)}
                        </span>
                        <div>
                          <h3 className="font-bold text-lg text-[#181311] dark:text-white">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {notification.category}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(notification)}
                        className="text-gray-500 hover:text-red-600"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{notification.message}</p>
                  </div>
                ))
              )}
            </>
          )}
      </div>

      {/* Modal создания/редактирования */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181311] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-[#181311] border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#181311] dark:text-white">
                {editingNotification ? 'Редактировать уведомление' : 'Создать уведомление'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Название *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                    placeholder="Введите название уведомления"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Сообщение *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white min-h-[100px]"
                    placeholder="Введите текст уведомления"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Категория *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                  >
                    <option value="">Выберите категорию</option>
                    <option value="закончился">Закончился</option>
                    <option value="изменилось">Изменилось</option>
                    <option value="обратить внимание">Обратить внимание</option>
                    <option value="гости спрашивают">Гости спрашивают</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Тип уведомления
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                  >
                    <option value="announcement">Объявление</option>
                    <option value="update">Обновление</option>
                    <option value="attention">Внимание</option>
                    <option value="question">Вопрос</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Срок жизни * (критический фильтр)
                  </label>
                  <select
                    value={formData.lifetimeType}
                    onChange={(e) => setFormData({ ...formData, lifetimeType: e.target.value, expiresAt: e.target.value === 'date' ? formData.expiresAt : '' })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                  >
                    <option value="">Выберите срок жизни</option>
                    <option value="shift_end">До конца смены</option>
                    <option value="date">До даты</option>
                    <option value="manual">Вручную снять</option>
                  </select>
                  {!formData.lifetimeType && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      ⚠️ Это обязательное поле! Без срока жизни уведомление не будет отправлено.
                    </p>
                  )}
                </div>

                {formData.lifetimeType === 'date' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Дата и время окончания *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Имя отправителя
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                    placeholder="Введите имя отправителя"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Статус
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                  >
                    <option value="draft">Черновик</option>
                    <option value="active">Активное (отправить сразу)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90"
                  >
                    {editingNotification ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
            </div>
          </div>
        </div>
        )}

      {/* Модальное окно предпросмотра "как это увидит официант" */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181311] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-[#181311] border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#181311] dark:text-white">Предпросмотр для официанта</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
                {activeNotifications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">notifications_off</span>
                    <p>Нет активных уведомлений для предпросмотра</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="bg-primary/10 border-l-4 border-primary rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-primary text-2xl mt-0.5 flex-shrink-0">
                            {getCategoryIcon(notification.category)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-base text-[#181311] dark:text-white">
                                {notification.title}
                              </h4>
                              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                              {notification.author && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">person</span>
                                  {notification.author}
                                </span>
                              )}
                              {notification.expiresAt && (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                                  {getLifetimeText(notification)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
        )}

      {/* Модальное окно настроек бота */}
      {showBotSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181311] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-[#181311] border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#181311] dark:text-white">Настройки Telegram бота</h2>
              <button
                onClick={() => setShowBotSettings(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Как это работает:</strong> Бот будет фильтровать сообщения из рабочих Telegram чатов,
                    находить важные по ключевым словам и отправлять их как черновики на модерацию.
                    После утверждения админом уведомления будут отправлены официантам.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={botSettings.enabled}
                      onChange={(e) => {
                        const updated = { ...botSettings, enabled: e.target.checked };
                        setBotSettings(updated);
                        localStorage.setItem('telegramBotSettings', JSON.stringify(updated));
                      }}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Включить автоматическую систему
                    </span>
                  </label>
                </div>

                {botSettings.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Telegram Bot Token
                      </label>
                      <input
                        type="password"
                        value={botSettings.telegramToken}
                        onChange={(e) => {
                          const updated = { ...botSettings, telegramToken: e.target.value };
                          setBotSettings(updated);
                          localStorage.setItem('telegramBotSettings', JSON.stringify(updated));
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                        placeholder="Введите токен бота"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Получите токен у @BotFather в Telegram
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        ID чатов для мониторинга (через запятую)
                      </label>
                      <input
                        type="text"
                        value={botSettings.chatIds.join(', ')}
                        onChange={(e) => {
                          const ids = e.target.value.split(',').map(id => id.trim()).filter(Boolean);
                          const updated = { ...botSettings, chatIds: ids };
                          setBotSettings(updated);
                          localStorage.setItem('telegramBotSettings', JSON.stringify(updated));
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                        placeholder="123456789, -987654321"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={botSettings.autoModeration}
                          onChange={(e) => {
                            const updated = { ...botSettings, autoModeration: e.target.checked };
                            setBotSettings(updated);
                            localStorage.setItem('telegramBotSettings', JSON.stringify(updated));
                          }}
                          className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Автоматическая модерация (требует настройки AI)
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Ключевые слова для фильтрации (через запятую)
                      </label>
                      <input
                        type="text"
                        value={botSettings.keywords.join(', ')}
                        onChange={(e) => {
                          const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                          const updated = { ...botSettings, keywords };
                          setBotSettings(updated);
                          localStorage.setItem('telegramBotSettings', JSON.stringify(updated));
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white"
                        placeholder="закончилось, нет в наличии, изменилось, важно"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Сообщения с этими словами будут отправляться как черновики
                      </p>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        <strong>Примечание:</strong> Для полной работы бота необходимо настроить серверную часть,
                        которая будет подключаться к Telegram Bot API и обрабатывать сообщения.
                        Это можно сделать позже, когда будет готов backend.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowBotSettings(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Закрыть
                  </button>
                </div>
            </div>
          </div>
        </div>
        )}
    </div>
  );
}

export default NotificationsPage;
