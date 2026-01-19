import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeedbackMessages, markFeedbackRead, deleteFeedbackMessage, checkAuth } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function FeedbackMessagesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'

  useEffect(() => {
    const check = async () => {
      try {
        const result = await checkAuth();
        setIsAuthenticated(result.authenticated);
        if (result.authenticated) {
          loadMessages();
        } else {
          navigate('/admin');
        }
      } catch (error) {
        setIsAuthenticated(false);
        navigate('/admin');
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [navigate]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await getFeedbackMessages();
      setMessages(data);
    } catch (error) {
      toast.error('Ошибка загрузки сообщений: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (messageId) => {
    try {
      await markFeedbackRead(messageId);
      // Обновляем сообщение в списке
      setMessages(messages.map(msg => 
        msg.id === messageId ? { ...msg, read: true } : msg
      ));
    } catch (error) {
      toast.error('Ошибка при обновлении сообщения: ' + error.message);
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm('Удалить это сообщение?')) return;

    try {
      await deleteFeedbackMessage(messageId);
      // Удаляем сообщение из списка
      setMessages(messages.filter(msg => msg.id !== messageId));
      toast.success('Сообщение удалено');
    } catch (error) {
      toast.error('Ошибка удаления: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Дата неизвестна';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Функция для получения названия и иконки типа сообщения
  const getFeedbackTypeInfo = (type) => {
    const types = {
      question: { label: '❓ Вопрос', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
      bug: { label: '🐞 Проблема / ошибка', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
      suggestion: { label: '💡 Предложение', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' },
      greeting: { label: '📚 Просто пожелать добра 😉', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' }
    };
    return types[type] || types.question;
  };

  // Фильтруем сообщения
  const filteredMessages = messages.filter(msg => {
    if (filter === 'unread') return !msg.read;
    if (filter === 'read') return msg.read;
    return true;
  });

  // Считаем непрочитанные сообщения
  const unreadCount = messages.filter(msg => !msg.read).length;

  if (checking) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Проверка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Перенаправление уже произошло
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased text-text-primary-light dark:text-text-primary-dark transition-colors duration-200 min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark shadow-2xl">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md p-4 pb-3 border-b border-gray-100 dark:border-white/5 transition-colors">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold leading-tight tracking-tight">Обратная связь</h1>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все прочитано'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin')}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              Назад
            </button>
          </div>
        </header>

        {/* Фильтры */}
        <div className="px-4 py-3 bg-background-light dark:bg-background-dark sticky top-[68px] z-40 border-b border-gray-100 dark:border-white/5">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-white/10 text-text-primary-light dark:text-text-primary-dark hover:bg-gray-200 dark:hover:bg-white/20'
              }`}
            >
              Все ({messages.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                filter === 'unread'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-white/10 text-text-primary-light dark:text-text-primary-dark hover:bg-gray-200 dark:hover:bg-white/20'
              }`}
            >
              Непрочитанные
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'read'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-white/10 text-text-primary-light dark:text-text-primary-dark hover:bg-gray-200 dark:hover:bg-white/20'
              }`}
            >
              Прочитанные ({messages.filter(msg => msg.read).length})
            </button>
          </div>
        </div>

        {/* Список сообщений */}
        <div className="flex flex-col gap-3 px-4 pb-24">
          {loading ? (
            <div className="text-center py-8 text-text-secondary-light">Загрузка...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-text-secondary-light">
              {filter === 'unread' ? 'Нет непрочитанных сообщений' : 
               filter === 'read' ? 'Нет прочитанных сообщений' : 
               'Нет сообщений'}
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border ${
                  message.read 
                    ? 'border-gray-100 dark:border-white/5 opacity-75' 
                    : 'border-primary/30 dark:border-primary/20'
                } relative`}
              >
                {/* Индикатор непрочитанного */}
                {!message.read && (
                  <div className="absolute top-3 right-3 w-3 h-3 bg-primary rounded-full"></div>
                )}

                {/* Информация об отправителе и тип сообщения */}
                <div className="flex flex-col gap-2 mb-3">
                  {message.name && (
                    <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {message.name}
                    </p>
                  )}
                  {message.type && (
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border ${getFeedbackTypeInfo(message.type).color}`}>
                      {getFeedbackTypeInfo(message.type).label}
                    </span>
                  )}
                </div>

                {/* Текст сообщения */}
                <p className="text-text-primary-light dark:text-text-primary-dark text-base leading-relaxed mb-3 whitespace-pre-wrap">
                  {message.message}
                </p>

                {/* Дата и действия */}
                <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-white/5">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {formatDate(message.created_at)}
                  </span>
                  <div className="flex gap-2">
                    {!message.read && (
                      <button
                        onClick={() => handleMarkRead(message.id)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        title="Отметить как прочитанное"
                      >
                        Прочитано
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(message.id)}
                      className="p-1.5 rounded-lg bg-gray-50 dark:bg-white/5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Удалить"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default FeedbackMessagesPage;
