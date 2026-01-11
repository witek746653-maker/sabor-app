import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getDishes, deleteDish } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDishImageUrl } from '../../utils/imageUtils';

/**
 * DishesPage - Страница списка блюд
 * Отображается в центральной области AdminLayout
 */
function DishesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadDishes();
    }
  }, [isAuthenticated]);

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

  return (
    <div className="h-full flex flex-col">
      {/* Поиск */}
      <div className="p-4 bg-background-light dark:bg-background-dark border-b border-gray-200 dark:border-white/10">
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

        {/* Счетчик */}
        <div className="flex justify-between items-end">
          <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
            Найдено {filteredDishes.length} блюд
          </span>
        </div>
      </div>

      {/* Список блюд */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-8 text-text-secondary-light">Загрузка...</div>
          ) : filteredDishes.length === 0 ? (
            <div className="text-center py-8 text-text-secondary-light">
              {searchQuery ? 'Блюда не найдены' : 'Блюда не загружены'}
            </div>
          ) : (
            filteredDishes.map((dish) => {
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
      </div>
    </div>
  );
}

export default DishesPage;
