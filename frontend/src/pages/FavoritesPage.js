import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDishes } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';

function FavoritesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, isGuest } = useAuth();
  const [allDishes, setAllDishes] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    // Загружаем избранное из localStorage
    const saved = localStorage.getItem('favoriteDishes');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => {
    // Загружаем язык из localStorage или используем 'RU' по умолчанию
    return localStorage.getItem('menuLanguage') || 'RU';
  });

  useEffect(() => {
    const loadDishes = async () => {
      try {
        const allDishesData = await getDishes();
        
        // Сохраняем все активные блюда (не в архиве)
        const activeAllDishes = allDishesData.filter(
          (dish) => dish.status !== 'в архиве'
        );
        setAllDishes(activeAllDishes);
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
      if (e.key === 'favoriteDishes' || e.key === null) {
        const saved = localStorage.getItem('favoriteDishes');
        setFavorites(saved ? JSON.parse(saved) : []);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Также проверяем изменения localStorage в том же окне
    const checkInterval = setInterval(() => {
      const saved = localStorage.getItem('favoriteDishes');
      const currentFavorites = saved ? JSON.parse(saved) : [];
      if (JSON.stringify(currentFavorites) !== JSON.stringify(favorites)) {
        setFavorites(currentFavorites);
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [favorites]);

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
  const favoriteDishes = allDishes.filter(dish => favorites.includes(dish.id));

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
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden border-x border-gray-100 dark:border-gray-800">
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
          </div>
        </div>
        {/* Breadcrumb */}
        <div className="px-4 pb-2">
          <nav className="flex text-xs text-[#896f61] dark:text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis items-center">
            <Link to="/" className="hover:text-primary transition-colors cursor-pointer">Menu</Link>
            <span className="material-symbols-outlined text-[10px] mx-1 opacity-60">chevron_right</span>
            <span className="text-primary font-semibold">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
          </nav>
        </div>
        {/* Search */}
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
      </div>

      {/* Dishes Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-bold text-base dark:text-white">
            {language === 'EN' ? 'Favorite Dishes' : 'Избранные блюда'}
          </h3>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700">
            {filteredDishes.length} {language === 'EN' ? 'items' : 'блюд'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {filteredDishes.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-[#896f61] dark:text-gray-400">
              {favorites.length === 0 
                ? (language === 'EN' ? 'No favorites yet' : 'Пока нет избранных блюд')
                : (language === 'EN' ? 'No dishes found' : 'Блюда не найдены')
              }
            </div>
          ) : (
            filteredDishes.map((dish) => {
              const tags = getDishTags(dish);
              const imageUrl = getDishImageUrl(dish);

              return (
                <Link
                  key={dish.id}
                  to={`/dish/${dish.id}`}
                  className="group flex flex-col rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-800 hover:border-primary/30 transition-all"
                >
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
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 z-50 w-full max-w-md bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
        <div className={`grid ${isAuthenticated && currentUser?.role === 'администратор' ? 'grid-cols-4' : 'grid-cols-3'} px-6 items-center h-[60px]`}>
          <Link to="/" className="flex flex-col items-center justify-center gap-1 text-primary">
            <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
            <span className="text-[10px] font-bold">{language === 'EN' ? 'Menu' : 'Меню'}</span>
          </Link>
          <Link 
            to="/favorites"
            className="flex flex-col items-center justify-center gap-1 text-primary"
          >
            <span className="material-symbols-outlined text-[24px] fill-1">favorite</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
          </Link>
          <button 
            onClick={() => {
              // Прокручиваем к поиску
              document.querySelector('input[placeholder*="Search"], input[placeholder*="Поиск"]')?.focus();
            }}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">search</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Search' : 'Поиск'}</span>
          </button>
          {isAuthenticated && currentUser?.role === 'администратор' && (
            <Link
              to="/admin"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">person</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Admin' : 'Админ-панель'}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default FavoritesPage;
