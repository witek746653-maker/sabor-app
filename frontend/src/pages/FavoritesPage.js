import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { getDishes } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';
import { useVisibility } from '../contexts/VisibilityContext';

function FavoritesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, isGuest } = useAuth();
  const { isVisible } = useVisibility();
  const [allDishes, setAllDishes] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    // Загружаем избранное из localStorage
    // В проекте основной ключ: favoriteDishes
    // Для картин раньше использовался отдельный ключ: art-favorites
    // Объединяем, чтобы ничего не потерять.
    const saved = localStorage.getItem('favoriteDishes');
    const artSaved = localStorage.getItem('art-favorites');
    const ids = [
      ...(saved ? JSON.parse(saved) : []),
      ...(artSaved ? JSON.parse(artSaved) : []),
    ];
    return Array.from(new Set(ids)).filter(Boolean);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => {
    // Загружаем язык из localStorage или используем 'RU' по умолчанию
    return localStorage.getItem('menuLanguage') || 'RU';
  });
  const favoritesFiltersStorageKey = 'favoritesFilters';
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Восстанавливаем фильтр поиска из localStorage (память браузера).
  useEffect(() => {
    const saved = localStorage.getItem(favoritesFiltersStorageKey);
    if (!saved) {
      setFiltersLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setSearchQuery(parsed?.searchQuery ?? '');
    } catch (error) {
      console.warn('Не удалось прочитать фильтр избранного из localStorage:', error);
    } finally {
      setFiltersLoaded(true);
    }
  }, [favoritesFiltersStorageKey]);

  // Избранное может содержать и бар/вино (если их добавляли раньше), поэтому строим правильный путь.
  const getDetailPathForItem = (it) => {
    const menu = String(it?.menu || '').toLowerCase();
    const section = String(it?.section || '').toLowerCase();
    const source = String(it?.source || '').toLowerCase();

    const isArt =
      source.includes('искусство') ||
      String(it?.id || '').startsWith('09') ||
      Boolean(it?.author);

    const isWine =
      menu.includes('вино') ||
      menu.includes('wine') ||
      section.includes('вино') ||
      section.includes('wine');

    const isBar =
      menu.includes('бар') ||
      menu.includes('bar') ||
      menu.includes('напит') ||
      menu.includes('drink') ||
      section.includes('коктейл') ||
      section.includes('cocktail') ||
      section.includes('чай') ||
      section.includes('tea') ||
      section.includes('пиво') ||
      section.includes('beer') ||
      section.includes('кофе') ||
      section.includes('coffee') ||
      section.includes('напит') ||
      section.includes('drink');

    if (isArt) return `/art/${it.id}`;
    if (isWine) return `/wine/${it.id}`;
    if (isBar) return `/bar/${it.id}`;
    return `/dish/${it.id}`;
  };

  const getContentTarget = (it) => {
    const id = String(it?.id ?? '').trim();
    if (!id) return null;
    const menu = String(it?.menu || '').toLowerCase();
    const section = String(it?.section || '').toLowerCase();
    const source = String(it?.source || '').toLowerCase();
    const isArt =
      source.includes('искусство') || String(it?.id || '').startsWith('09') || Boolean(it?.author);
    const isWine =
      menu.includes('вино') ||
      menu.includes('wine') ||
      section.includes('вино') ||
      section.includes('wine');
    const isBar =
      menu.includes('бар') ||
      menu.includes('bar') ||
      menu.includes('напит') ||
      menu.includes('drink') ||
      section.includes('коктейл') ||
      section.includes('cocktail') ||
      section.includes('чай') ||
      section.includes('tea') ||
      section.includes('пиво') ||
      section.includes('beer') ||
      section.includes('кофе') ||
      section.includes('coffee') ||
      section.includes('напит') ||
      section.includes('drink');
    if (isArt) return `art:${id}`;
    if (isWine) return `wine:${id}`;
    if (isBar) return `bar:${id}`;
    return `dish:${id}`;
  };

  const isContentVisible = (it) => {
    const isArchived = it?.status === 'в архиве';
    if (isArchived && !isVisible({ scope: 'contentItem', target: 'status.archived' })) {
      return false;
    }
    const target = getContentTarget(it);
    if (!target) return true;
    return isVisible({ scope: 'contentItem', target });
  };

  useEffect(() => {
    const loadDishes = async () => {
      try {
        const allDishesData = await getDishes();
        
        // Сохраняем все блюда (включая "в архиве") — архивные просто затемняем в UI
        // Термин **архив**: позиция неактивна, но всё ещё доступна для просмотра.
        // Дополнительно грузим картины из статического JSON,
        // потому что бэкенд/БД могут не отдавать их через /api/dishes.
        let artworks = [];
        try {
          const staticRes = await fetch('/data/menu-database.json', { cache: 'no-store' });
          if (staticRes.ok) {
            const staticJson = await staticRes.json();
            artworks = (staticJson || []).filter(
              (it) => it?.source === 'Искусство в Sabor de la Vida' && String(it?.id || '').startsWith('09')
            );
          }
        } catch (e) {
          console.warn('Не удалось загрузить статический список картин для избранного:', e);
          artworks = [];
        }

        // Объединяем и дедуплицируем по id
        const mergedById = new Map();
        (allDishesData || []).forEach((it) => {
          if (!it || !it.id) return;
          mergedById.set(String(it.id), it);
        });
        artworks.forEach((it) => {
          if (!it || !it.id) return;
          mergedById.set(String(it.id), it);
        });

        setAllDishes(Array.from(mergedById.values()));
      } catch (error) {
        console.error('Ошибка загрузки блюд:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDishes();
  }, []);

  // Обновляем избранное при изменении localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'favoriteDishes' || e.key === 'art-favorites' || e.key === null) {
        const saved = localStorage.getItem('favoriteDishes');
        const artSaved = localStorage.getItem('art-favorites');
        const ids = [
          ...(saved ? JSON.parse(saved) : []),
          ...(artSaved ? JSON.parse(artSaved) : []),
        ];
        setFavorites(Array.from(new Set(ids)).filter(Boolean));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Также проверяем изменения localStorage в том же окне
    const checkInterval = setInterval(() => {
      const saved = localStorage.getItem('favoriteDishes');
      const artSaved = localStorage.getItem('art-favorites');
      const currentFavorites = Array.from(
        new Set([...(saved ? JSON.parse(saved) : []), ...(artSaved ? JSON.parse(artSaved) : [])])
      ).filter(Boolean);
      if (JSON.stringify(currentFavorites) !== JSON.stringify(favorites)) {
        setFavorites(currentFavorites);
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [favorites]);

  // Сохраняем фильтр поиска избранного в localStorage.
  useEffect(() => {
    if (!filtersLoaded) return;
    const payload = { searchQuery };
    localStorage.setItem(favoritesFiltersStorageKey, JSON.stringify(payload));
  }, [favoritesFiltersStorageKey, searchQuery]);

  // Функция для получения значения поля в зависимости от языка
  const getFieldValue = (dish, fieldName) => {
    if (language === 'EN' && dish.i18n?.en) {
      const enField = `${fieldName}-en`;
      return dish.i18n.en[enField] || dish[fieldName] || '';
    }
    return dish[fieldName] || '';
  };

  // Функция для получения тегов в зависимости от языка
  const getTagsForLanguage = (dish) => {
    if (language === 'EN' && dish.i18n?.en?.['tags-en']) {
      const tagsEn = dish.i18n.en['tags-en'];
      if (typeof tagsEn === 'string') {
        return tagsEn.split(',').map(t => t.trim()).filter(Boolean);
      }
      return Array.isArray(tagsEn) ? tagsEn : [];
    }
    return dish.tags || [];
  };

  // Функция для получения аллергенов в зависимости от языка
  const getAllergensForLanguage = (dish) => {
    if (language === 'EN' && dish.i18n?.en?.['allergens-en']) {
      const allergensEn = dish.i18n.en['allergens-en'];
      if (typeof allergensEn === 'string') {
        return allergensEn.split(',').map(a => a.trim()).filter(Boolean);
      }
      return Array.isArray(allergensEn) ? allergensEn : [];
    }
    return dish.allergens || [];
  };

  // Если гость пытается зайти на страницу избранного, перенаправляем на главную
  useEffect(() => {
    if (isGuest) {
      navigate('/');
    }
  }, [isGuest, navigate]);

  // Фильтруем блюда: только избранные
  const favoriteDishes = allDishes
    .filter(dish => favorites.includes(dish.id))
    .filter((dish) => isContentVisible(dish));

  // Фильтруем по поисковому запросу
  const filteredDishes = favoriteDishes.filter((dish) => {
    const queryLower = searchQuery.toLowerCase();
    const dishTitle = getFieldValue(dish, 'title');
    const dishDescription = getFieldValue(dish, 'description');
    const dishSection = getFieldValue(dish, 'section');
    const dishAllergens = getAllergensForLanguage(dish);
    const dishTags = getTagsForLanguage(dish);
    
    return !searchQuery ||
      dishTitle?.toLowerCase().includes(queryLower) ||
      dishDescription?.toLowerCase().includes(queryLower) ||
      dishSection?.toLowerCase().includes(queryLower) ||
      dishAllergens.some(a => a.toLowerCase().includes(queryLower)) ||
      dishTags.some(t => t.toLowerCase().includes(queryLower));
  });

  // Функция для получения иконки аллергена
  const getAllergenIcon = (allergen) => {
    const allergenLower = allergen?.toLowerCase() || '';
    if (allergenLower.includes('глютен') || allergenLower.includes('gluten')) return 'bakery_dining';
    if (allergenLower.includes('яйц') || allergenLower.includes('egg')) return 'egg';
    if (allergenLower.includes('молоч') || allergenLower.includes('dairy')) return 'water_drop';
    if (allergenLower.includes('рыб') || allergenLower.includes('fish')) return 'set_meal';
    if (allergenLower.includes('орех') || allergenLower.includes('nut')) return 'check_circle';
    return 'check_circle';
  };

  // Функция для получения тегов блюда
  const getDishTags = (dish) => {
    const tags = [];
    const dishTags = getTagsForLanguage(dish);
    if (dishTags.length > 0) {
      if (dishTags.some(t => t.toLowerCase().includes('остр') || t.toLowerCase().includes('spicy'))) {
        tags.push({ type: 'spicy', icon: 'local_fire_department', color: 'red' });
      }
      if (dishTags.some(t => t.toLowerCase().includes('веган') || t.toLowerCase().includes('vegan'))) {
        tags.push({ type: 'vegan', icon: 'eco', color: 'green' });
      }
      if (dishTags.some(t => t.toLowerCase().includes('вегетариан') || t.toLowerCase().includes('vegetarian'))) {
        tags.push({ type: 'vegetarian', icon: 'eco', color: 'green' });
      }
    }
    return tags;
  };

  // Простое склонение для RU: 1 элемент, 2 элемента, 5 элементов.
  const formatElementsCountRu = (count) => {
    const n = Number(count) || 0;
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} элемент`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} элемента`;
    return `${n} элементов`;
  };

  // Если гость, не показываем страницу
  if (isGuest) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden border-x border-gray-100 dark:border-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center px-4 pt-4 pb-2 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-[#181311] dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-[#181311] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            {language === 'EN' ? 'Favorites' : 'Избранное'}
          </h2>
          <div className="flex w-12 items-center justify-end">
            {isVisible({ scope: 'featureAction', target: 'language.switcher' }) && (
              <button 
                onClick={() => {
                  const newLanguage = language === 'RU' ? 'EN' : 'RU';
                  setLanguage(newLanguage);
                  localStorage.setItem('menuLanguage', newLanguage);
                }}
                className={`text-xs font-bold leading-normal tracking-[0.015em] shrink-0 border rounded-lg px-2 py-1 transition-colors ${
                  language === 'EN' 
                    ? 'bg-primary text-white border-primary' 
                    : 'text-primary border-primary/30 hover:bg-primary hover:text-white'
                }`}
              >
                {language === 'RU' ? 'EN' : 'RU'}
              </button>
            )}
          </div>
        </div>
        {/* Search */}
        {isVisible({ scope: 'pageBlock', target: 'search.input' }) && (
          <div className="px-4 py-2">
            <div className="flex w-full items-stretch rounded-xl h-10 bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-700/50 group focus-within:border-primary/50 transition-colors">
              <div className="text-[#896f61] dark:text-gray-400 flex items-center justify-center pl-3 pr-2 group-focus-within:text-primary transition-colors">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </div>
              <input
                className="flex w-full flex-1 bg-transparent border-none text-[#181311] dark:text-white placeholder:text-[#896f61] dark:placeholder:text-gray-500 focus:ring-0 text-sm font-normal h-full p-0 pr-3"
                placeholder={language === 'EN' ? 'Search favorites...' : 'Поиск в избранном...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dishes Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-bold text-base dark:text-white">
            {language === 'EN' ? 'Favorite items' : 'Избранные карточки'}
          </h3>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700">
            {language === 'EN'
              ? `${filteredDishes.length} items`
              : formatElementsCountRu(filteredDishes.length)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {filteredDishes.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-[#896f61] dark:text-gray-400">
              {favorites.length === 0 
                ? (language === 'EN' ? 'No favorites yet' : 'Пока нет избранных карточек')
                : (language === 'EN' ? 'Nothing found' : 'Ничего не найдено')
              }
            </div>
          ) : (
            filteredDishes.map((dish) => {
              const tags = getDishTags(dish);
              const imageUrl = getDishImageUrl(dish);
              const isArchived = dish.status === 'в архиве';

              return (
                <Link
                  key={dish.id}
                  to={getDetailPathForItem(dish)}
                  className="group relative rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-800 hover:border-primary/30 transition-all"
                >
                  {/* Затемняем ТОЛЬКО контент карточки, чтобы бейдж "В АРХИВЕ" был читабельным */}
                  <div className={`flex flex-col h-full ${isArchived ? 'opacity-50 grayscale' : ''}`}>
                    <div className="relative w-full aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {imageUrl ? (
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                          style={{ backgroundImage: `url('${imageUrl}')` }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400 text-4xl">restaurant</span>
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                          {tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className={`bg-white/95 dark:bg-black/60 backdrop-blur-[2px] p-0.5 rounded-md ${tag.color === 'red' ? 'text-red-500' : 'text-green-600'} shadow-sm ring-1 ring-black/5`}
                              title={tag.type}
                            >
                              <span className="material-symbols-outlined text-[12px] block">{tag.icon}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex flex-col flex-grow">
                      <h3 className="font-bold text-[11px] leading-[1.2] dark:text-white line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                        {getFieldValue(dish, 'title') || (language === 'EN' ? 'No title' : 'Без названия')}
                      </h3>
                      {getFieldValue(dish, 'description') && (
                        <p className="text-[9px] text-[#896f61] dark:text-gray-400 line-clamp-2 mb-2 leading-tight opacity-90">
                          {getFieldValue(dish, 'description')}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-dashed border-gray-100 dark:border-gray-700">
                        {getAllergensForLanguage(dish).length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-[12px]">
                              {getAllergenIcon(getAllergensForLanguage(dish)[0])}
                            </span>
                            <span className="text-[8px] text-gray-400 uppercase font-semibold">
                              {getAllergensForLanguage(dish)[0].substring(0, 5)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Индикатор архива поверх карточки */}
                  {isArchived && (
                    <div className="absolute top-2 right-2 bg-gray-700/90 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                      В АРХИВЕ
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 z-50 w-full sabor-fixed bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
        <div
          className={`grid ${
            (() => {
              const showFooterMenu = isVisible({ scope: 'menuItem', target: 'footer.menu' });
              const showFooterFavorites = isVisible({ scope: 'menuItem', target: 'footer.favorites' });
              const showFooterSearch = isVisible({ scope: 'menuItem', target: 'footer.search' });
              const showFooterTools = isVisible({ scope: 'menuItem', target: 'footer.tools' });
              const showFooterAdmin =
                isAuthenticated &&
                currentUser?.role === 'администратор' &&
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
          } px-6 items-center h-[60px]`}
        >
          {isVisible({ scope: 'menuItem', target: 'footer.menu' }) && (
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                }`
              }
            >
              <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
              <span className="text-[10px] font-bold">{language === 'EN' ? 'Menu' : 'Меню'}</span>
            </NavLink>
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.favorites' }) && (
            <NavLink 
              to="/favorites"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                }`
              }
            >
              <span className="material-symbols-outlined text-[24px] fill-1">favorite</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
            </NavLink>
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.search' }) && (
            <button 
              onClick={() => {
                // Открываем глобальный поиск отдельной страницей.
                navigate('/search');
              }}
              className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">search</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Search' : 'Поиск'}</span>
            </button>
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.tools' }) && (
            <NavLink
              to="/info"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                }`
              }
            >
              <span className="material-symbols-outlined text-[24px]">new_releases</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Info' : 'Информация'}</span>
            </NavLink>
          )}
          {isAuthenticated &&
            currentUser?.role === 'администратор' &&
            isVisible({ scope: 'menuItem', target: 'footer.admin' }) && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 transition-colors ${
                    isActive
                      ? 'text-primary'
                      : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[24px]">person</span>
                <span className="text-[10px] font-medium">{language === 'EN' ? 'Admin' : 'Админ-панель'}</span>
              </NavLink>
            )}
        </div>
      </div>
    </div>
  );
}

export default FavoritesPage;
