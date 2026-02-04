import React, { useState, useEffect } from 'react';
import { getFeedbackMessages, markFeedbackRead, deleteFeedbackMessage } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * FeedbackMessagesPage - Страница обратной связи
 * Отображается в центральной области AdminLayout (правая колонка - администрирование)
 */
function FeedbackMessagesPage() {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'

  useEffect(() => {
    loadMessages();
  }, []);

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

  const getFeedbackTypeInfo = (type) => {
    const types = {
      question: { label: '❓ Вопрос', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
      bug: { label: '🐞 Проблема / ошибка', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
      suggestion: { label: '💡 Предложение', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' },
      greeting: { label: '📚 Просто пожелать добра 😉', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' }
    };
    return types[type] || types.question;
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'unread') return !msg.read;
    if (filter === 'read') return msg.read;
    return true;
  });

  const unreadCount = messages.filter(msg => !msg.read).length;

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
          Обратная связь
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все прочитано'}
        </p>
      </div>

      {/* Фильтры */}
      <div className="mb-4 flex gap-2">
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

      {/* Список сообщений */}
      <div className="flex flex-col gap-3 flex-1">
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
              {!message.read && (
                <div className="absolute top-3 right-3 w-3 h-3 bg-primary rounded-full"></div>
              )}

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

              <p className="text-text-primary-light dark:text-text-primary-dark text-base leading-relaxed mb-3 whitespace-pre-wrap">
                {message.message}
              </p>
              {Array.isArray(message.tags) && message.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {message.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-white/10 text-text-secondary-light dark:text-text-secondary-dark"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {message.attachments.map((att, idx) => (
                    <a
                      key={`${message.id}-${idx}`}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border border-gray-100 dark:border-white/10 rounded-lg overflow-hidden"
                    >
                      <img src={att.url} alt={att.name || ''} className="w-full h-24 object-cover" />
                    </a>
                  ))}
                </div>
              )}

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
  );
}

export default FeedbackMessagesPage;
