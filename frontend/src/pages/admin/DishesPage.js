import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getDishes, deleteDish } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDishImageUrl } from '../../utils/imageUtils';
import HelpPopover from '../../components/HelpPopover';

/**
 * DishesPage - Страница списка позиций
 * Отображается в центральной области AdminLayout
 */
function DishesPage({ mode = 'kitchen' }) {
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

  const pageTitle = useMemo(() => {
    if (mode === 'wine') return 'Вино';
    if (mode === 'bar') return 'Бар';
    return 'Кухня';
  }, [mode]);

  const modeFiltered = useMemo(() => {
    const isWine = (dish) => dish?.menu === 'Вино';
    const isBar = (dish) => dish?.menu === 'Барное меню';

    if (mode === 'wine') return dishes.filter(isWine);
    if (mode === 'bar') return dishes.filter(isBar);
    // kitchen = всё, кроме вина и бара
    return dishes.filter((d) => !isWine(d) && !isBar(d));
  }, [dishes, mode]);

  const filteredDishes = useMemo(() => {
    if (!searchQuery) return modeFiltered;
    const query = searchQuery.toLowerCase();
    return modeFiltered.filter((dish) => {
      return (
        dish.title?.toLowerCase().includes(query) ||
        dish.description?.toLowerCase().includes(query) ||
        dish.menu?.toLowerCase().includes(query) ||
        dish.section?.toLowerCase().includes(query)
      );
    });
  }, [modeFiltered, searchQuery]);

  return (
    <div className="h-full flex flex-col">
      {/* Поиск */}
      <div className="p-4 bg-background-light dark:bg-background-dark border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
              {pageTitle}
            </h2>
            <HelpPopover title="Справка: список позиций" icon="help">
              <div style={{ opacity: 0.9 }}>
                Здесь вы видите позиции выбранного раздела (Кухня / Вино / Бар).
                <details>
                  <summary>Почему “Кухня” не показывает Вино/Бар</summary>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    Для удобства “Кухня” фильтрует всё, кроме <b>menu = Вино</b> и <b>menu = Барное меню</b>.
                  </div>
                </details>
                <details>
                  <summary>Про “В архиве”</summary>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    Термин <b>архив</b>: позиция скрыта для гостей, но видна в админке.
                  </div>
                </details>
              </div>
            </HelpPopover>
          </div>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              if (mode === 'wine') params.set('menu', 'Вино');
              if (mode === 'bar') params.set('menu', 'Барное меню');
              const qs = params.toString();
              navigate(qs ? `/admin/add?${qs}` : '/admin/add');
            }}
            className="inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Добавить
          </button>
        </div>
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
          <div className="pr-2">
            <HelpPopover title="Справка: поиск" icon="help">
              <div style={{ opacity: 0.9 }}>
                Поиск ищет по: названию, описанию, меню и разделу.
                <br />
                Подсказка: если вы в режиме предпросмотра “Файл через бэкенд”, результаты берутся из файла.
              </div>
            </HelpPopover>
          </div>
        </div>

        {/* Счетчик */}
        <div className="flex justify-between items-end">
          <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
            Найдено {filteredDishes.length} позиций
          </span>
        </div>
      </div>

      {/* Список блюд */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {loading ? (
            <div className="col-span-full text-center py-8 text-text-secondary-light">Загрузка...</div>
          ) : filteredDishes.length === 0 ? (
            <div className="col-span-full text-center py-8 text-text-secondary-light">
              {searchQuery ? 'Ничего не найдено' : 'Позиции не загружены'}
            </div>
          ) : (
            filteredDishes.map((dish) => {
              const isArchived = dish.status === 'в архиве';
              
              return (
                <div
                  key={dish.id}
                  className={`flex flex-col bg-surface-light dark:bg-surface-dark rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group min-h-[260px] ${
                    isArchived ? 'opacity-50 grayscale' : ''
                  }`}
                >
                  {/* Картинка */}
                  <div
                    className="w-full aspect-square rounded-xl bg-center bg-no-repeat bg-cover border border-gray-100 dark:border-white/5"
                    style={{
                      backgroundImage: getDishImageUrl(dish)
                        ? `url('${getDishImageUrl(dish)}')`
                        : 'none',
                      backgroundColor: getDishImageUrl(dish) ? 'transparent' : '#e5e7eb',
                    }}
                  >
                    {!getDishImageUrl(dish) && (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-gray-400 text-4xl">
                          {mode === 'wine' ? 'wine_bar' : mode === 'bar' ? 'local_bar' : 'restaurant'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Текст */}
                  <div className="mt-3 flex flex-col gap-1">
                    <p className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold leading-snug line-clamp-2">
                      {dish.title || 'Без названия'}
                    </p>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs line-clamp-3">
                      {dish.description || 'Нет описания'}
                    </p>
                    <span className="mt-1 inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-100 dark:border-orange-800/30">
                      {dish.menu || 'БЕЗ МЕНЮ'}: {dish.section || 'БЕЗ РАЗДЕЛА'}
                    </span>
                  </div>

                  {/* Кнопки */}
                  <div className="mt-auto pt-3 flex justify-between items-center">
                    <button
                      onClick={() => navigate(`/admin/edit/${dish.id}`)}
                      className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-gray-50 dark:bg-white/5 text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-xs font-bold"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Править
                    </button>
                    <button
                      onClick={() => handleDelete(dish.id)}
                      className="inline-flex items-center justify-center size-9 rounded-xl bg-gray-50 dark:bg-white/5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Удалить"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
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
