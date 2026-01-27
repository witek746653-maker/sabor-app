import React, { useEffect, useState } from 'react';
import mediaItems from '../../data/mediaItems';
import { getAdminMediaLikesCounts } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * MediaLikesPage — админ-страница со счётчиками лайков медиа.
 */
export default function MediaLikesPage() {
  const toast = useToast();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);

  const loadCounts = async () => {
    setLoading(true);
    try {
      const ids = (mediaItems || []).map((it) => it?.id).filter(Boolean);
      const data = await getAdminMediaLikesCounts(ids);
      setCounts(data?.counts || {});
    } catch (error) {
      toast.error('Ошибка загрузки лайков медиа: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          Медиа и лайки
        </h2>
        <button
          type="button"
          onClick={loadCounts}
          className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary-light">Загрузка...</div>
      ) : (mediaItems || []).length === 0 ? (
        <div className="text-center py-8 text-text-secondary-light">Медиа пока нет</div>
      ) : (
        <div className="flex flex-col gap-3">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-surface-light dark:bg-surface-dark rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-white/5"
            >
              <div className="flex flex-col">
                <p className="text-text-primary-light dark:text-text-primary-dark text-base font-bold">
                  {item.title || 'Без названия'}
                </p>
                <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs mt-0.5">
                  {item.description || 'Нет описания'}
                </p>
              </div>
              <div className="text-sm font-semibold text-rose-600">
                {Number(counts[item.id] || 0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
