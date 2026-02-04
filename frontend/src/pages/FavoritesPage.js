import React, { useState, useEffect, useMemo } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { getDishes } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';
import { useVisibility } from '../contexts/VisibilityContext';
import mediaItems from '../data/mediaItems';
import { useFavorites } from '../contexts/FavoritesContext';

function FavoritesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, isGuest } = useAuth();
  const { isVisible } = useVisibility();
  const {
    catalogIds,
    mediaIds,
    articleIds,
    toggleCatalogFavorite,
    toggleMediaFavorite,
    toggleArticleFavorite
  } = useFavorites();

  // Состояние для всех загруженных "товаров" (блюда, напитки, картины)
  const [allCatalogItems, setAllCatalogItems] = useState([]);

  const favorites = catalogIds;
  const mediaFavorites = mediaIds;
  const articleFavorites = articleIds;

  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => localStorage.getItem('menuLanguage') || 'RU');

  // Текущий активный фильтр (вкладка)
  const [activeFilter, setActiveFilter] = useState('all'); // all, dishes, drinks, paintings, media, articles

  const favoritesFiltersStorageKey = 'favoritesFilters';
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Восстанавливаем строку поиска
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
      console.warn('Не удалось прочитать фильтр избранного:', error);
    } finally {
      setFiltersLoaded(true);
    }
  }, []);

  // Сохраняем строку поиска
  useEffect(() => {
    if (!filtersLoaded) return;
    localStorage.setItem(favoritesFiltersStorageKey, JSON.stringify({ searchQuery }));
  }, [searchQuery, filtersLoaded]);

  // Хелпер для определения типа элемента (Блюдо, Напиток, Картина)
  const getItemType = (it) => {
    const menu = String(it?.menu || '').toLowerCase();
    const section = String(it?.section || '').toLowerCase();
    const source = String(it?.source || '').toLowerCase();
    const title = String(it?.title || '').toLowerCase();
    const id = String(it?.id || '');

    // 1. Картины
    const isArt =
      source.includes('искусство') ||
      id.startsWith('09') ||
      Boolean(it?.author);
    if (isArt) return 'painting';

    // 2. Напитки (Вино + Бар + Чай/Кофе)
    const isDrink =
      menu.includes('вино') || menu.includes('wine') ||
      menu.includes('бар') || menu.includes('bar') ||
      menu.includes('напит') || menu.includes('drink') ||
      menu.includes('чай') || menu.includes('tea') ||
      menu.includes('кофе') || menu.includes('coffee') ||
      section.includes('коктейл') || section.includes('cocktail') ||
      section.includes('чай') || section.includes('tea') ||
      section.includes('пиво') || section.includes('beer') ||
      section.includes('кофе') || section.includes('coffee') ||
      section.includes('напит') || section.includes('drink') ||
      title.includes(' чай ') || title.startsWith('чай ') || title === 'чай' ||
      title.includes(' tea ') || title.startsWith('tea ') || title === 'tea' ||
      title.includes('кофе') || title.includes('coffee');

    if (isDrink) return 'drink';

    // 3. Остальное - Еда
    return 'dish';
  };

  // Хелпер для формирования правильной ссылки на детальную страницу
  const getDetailPath = (it, type) => {
    if (type === 'painting') return `/art/${it.id}`;
    if (type === 'drink') {
      const menu = String(it?.menu || '').toLowerCase();
      const section = String(it?.section || '').toLowerCase();
      const isWine = menu.includes('вино') || menu.includes('wine') || section.includes('вино');
      return isWine ? `/wine/${it.id}` : `/bar/${it.id}`;
    }
    return `/dish/${it.id}`;
  };

  const isContentVisible = (it) => {
    const isArchived = it?.status === 'в архиве';
    if (isArchived && !isVisible({ scope: 'contentItem', target: 'status.archived' })) {
      return false;
    }
    return true;
  };

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // 1. Блюда и Напитки
        const dishesData = await getDishes();

        // 2. Картины (из JSON)
        let artworks = [];
        try {
          const res = await fetch('/data/artworks.json', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            artworks = Array.isArray(data) ? data : [];
          }
        } catch (e) { console.warn('Ошибка загрузки картин:', e); }

        // 3. Статьи (из манифеста)
        try {
          const res = await fetch('/content/manifest.json', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setArticles(data.articles || []);
          }
        } catch (e) { console.warn('Ошибка загрузки статей:', e); }

        // Объединяем "каталожные" элементы
        const merged = new Map();
        (dishesData || []).forEach(it => it.id && merged.set(String(it.id), it));
        artworks.forEach(it => it.id && merged.set(String(it.id), it));

        setAllCatalogItems(Array.from(merged.values()));

      } catch (err) {
        console.error('Global data load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);


  // === ЛОГИКА ФИЛЬТРАЦИИ И ПОИСКА ===

  // 1. Разбиваем избранное на "сырые" группы
  const categorizedData = useMemo(() => {
    const groups = {
      dishes: [],
      drinks: [],
      paintings: [],
      media: [],
      articles: []
    };

    // Проходим по каталогу (еда, напитки, картины)
    allCatalogItems.forEach(item => {
      if (favorites.includes(item.id) && isContentVisible(item)) {
        const type = getItemType(item); // 'dish', 'drink', 'painting'
        if (type === 'dish') groups.dishes.push(item);
        if (type === 'drink') groups.drinks.push(item);
        if (type === 'painting') groups.paintings.push(item);
      }
    });

    // Медиа
    groups.media = mediaItems.filter(m => mediaFavorites.includes(m.id));

    // Статьи
    groups.articles = articles.filter(a => articleFavorites.includes(a.key));

    return groups;
  }, [allCatalogItems, favorites, mediaItems, mediaFavorites, articles, articleFavorites]);

  // 2. Применяем поиск к каждой группе
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categorizedData;

    const matches = (txt) => String(txt || '').toLowerCase().includes(q);

    return {
      dishes: categorizedData.dishes.filter(d =>
        matches(d.title) || matches(d.description) || matches(d.section)
      ),
      drinks: categorizedData.drinks.filter(d =>
        matches(d.title) || matches(d.description) || matches(d.section)
      ),
      paintings: categorizedData.paintings.filter(p =>
        matches(p.title) || matches(p.description) || matches(p.author)
      ),
      media: categorizedData.media.filter(m =>
        matches(m.title) || matches(m.description) || matches(m.category)
      ),
      articles: categorizedData.articles.filter(a =>
        matches(a.title) || matches(a.description) || matches(a.tags)
      )
    };
  }, [categorizedData, searchQuery]);

  // Счетчики (общее количество в избранном, независимо от поиска, чтобы показывать на табах)
  const counts = {
    all: Object.values(categorizedData).reduce((acc, output) => acc + output.length, 0),
    dishes: categorizedData.dishes.length,
    drinks: categorizedData.drinks.length,
    paintings: categorizedData.paintings.length,
    media: categorizedData.media.length,
    articles: categorizedData.articles.length
  };

  // Хелпер: переход к медиа
  const handleOpenMedia = (item) => {
    if (!item) return;
    const raw = localStorage.getItem('media.playerState');
    const saved = raw ? JSON.parse(raw) : {};
    localStorage.setItem('media.playerState', JSON.stringify({
      ...saved,
      currentId: item.id,
      isMiniPlayerVisible: true
    }));
    navigate('/media');
  };

  // Хелпер: Получение данных для отрисовки полей (язык)
  const getLoc = (obj, field) => {
    if (language === 'EN' && obj?.i18n?.en) {
      return obj.i18n.en[`${field}-en`] || obj[field] || '';
    }
    return obj?.[field] || '';
  };

  if (isGuest) return null; // Защита
  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold animate-pulse">
          {language === 'EN' ? 'Loading favorites...' : 'Загружаем избранное...'}
        </div>
      </div>
    );
  }

  // === UI RENDER COMPONENTS ===

  // Кнопка удаления из избранного
  const RemoveFavoriteButton = ({ onClick, title }) => (
    <button
      type="button"
      title={title || (language === 'EN' ? 'Remove from favorites' : 'Убрать из избранного')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className="absolute top-1 right-1 z-10 size-7 rounded-full bg-white/90 dark:bg-black/60 flex items-center justify-center text-red-500 shadow hover:scale-105 transition"
    >
      <span className="material-symbols-outlined text-[18px]">heart_minus</span>
    </button>
  );

  // Компонент Таба фильтра
  const FilterTab = ({ id, label, count, icon }) => (
    <button
      onClick={() => setActiveFilter(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${activeFilter === id
        ? 'bg-[#181311] text-white border-[#181311] dark:bg-white dark:text-black dark:border-white shadow-md'
        : 'bg-white text-gray-500 border-gray-200 dark:bg-surface-dark dark:text-gray-400 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      <span>{label}</span>
      {count > 0 && (
        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-md ${activeFilter === id
          ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}>
          {count}
        </span>
      )}
    </button>
  );

  // Секция списка
  const Section = ({ title, items, type }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-6 animate-fadeIn">
        <h3 className="font-bold text-lg text-[#181311] dark:text-white mb-2 px-1 flex items-center gap-2">
          {title} <span className="text-gray-400 text-sm font-normal">({items.length})</span>
        </h3>
        {/* Compact Grid: 3 columns */}
        <div className="grid grid-cols-3 gap-2">
          {items.map(item => {
            // Рендер для разных типов
            if (type === 'media') {
              return (
                <button
                  key={item.id}
                  onClick={() => handleOpenMedia(item)}
                  className="text-left rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-800 hover:border-primary/50 transition-all group"
                >
                  <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800">
                    <RemoveFavoriteButton onClick={() => toggleMediaFavorite(item.id)} />
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-white text-3xl drop-shadow-md">play_circle</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[10px] dark:text-white line-clamp-2 mb-0.5 leading-tight">{item.title}</p>
                    <p className="text-[9px] text-gray-400 line-clamp-1">{item.duration}</p>
                  </div>
                </button>
              );
            }

            if (type === 'article') {
              return (
                <Link
                  key={item.key}
                  to={`/article/${item.key}`}
                  className="block rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-800 hover:border-primary/50 transition-all"
                >
                  <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800">
                    <RemoveFavoriteButton onClick={() => toggleArticleFavorite(item.key)} />
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${item.image || '/articles/placeholder.jpg'}')` }}
                    />
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[10px] dark:text-white line-clamp-2 mb-0.5 leading-tight">{item.title}</p>
                    <p className="text-[9px] text-gray-400">{item.readingTime}</p>
                  </div>
                </Link>
              );
            }

            // Dish, Drink, Painting
            const path = getDetailPath(item, type);
            const titleVal = getLoc(item, 'title');
            const imgUrl = getDishImageUrl(item);
            const isArchived = item.status === 'в архиве';

            return (
              <Link
                key={item.id}
                to={path}
                className={`block rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-800 hover:border-primary/50 transition-all ${isArchived ? 'opacity-70 grayscale' : ''}`}
              >
                <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800 group">
                  <RemoveFavoriteButton onClick={() => toggleCatalogFavorite(item.id)} />
                  {imgUrl ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url('${imgUrl}')` }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                      <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                    </div>
                  )}
                  {isArchived && (
                    <div className="absolute top-1 right-1 bg-black/70 text-white text-[8px] px-1.5 py-0.5 rounded backdrop-blur">АРХИВ</div>
                  )}
                </div>
                <div className="p-2">
                  <p className="font-bold text-[10px] dark:text-white line-clamp-2 mb-0 leading-tight group-hover:text-primary transition-colors">{titleVal}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const isEmpty = Object.values(filteredData).every(arr => arr.length === 0);

  return (
    <div className="flex bg-background-light dark:bg-background-dark min-h-screen w-full flex-col pb-24">

      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center px-4 pt-4 pb-2 justify-between">
          <button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800">
            <span className="material-symbols-outlined text-[#181311] dark:text-white">arrow_back</span>
          </button>
          <h2 className="text-lg font-bold text-[#181311] dark:text-white">
            {language === 'EN' ? 'Favorites' : 'Избранное'}
          </h2>
          <div className="w-10"></div>
        </div>

        {/* SEARCH */}
        <div className="px-4 pb-3">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'EN' ? 'Search details...' : 'Поиск по избранному...'}
              className="w-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl h-10 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-[#181311] dark:text-white placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* FILTER TABS */}
        <div className="px-4 pb-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            <FilterTab id="all" label={language === 'EN' ? 'All' : 'Все'} count={counts.all} />
            {counts.media > 0 && <FilterTab id="media" label={language === 'EN' ? 'Media' : 'Медиа'} count={counts.media} icon="play_circle" />}
            {counts.articles > 0 && <FilterTab id="articles" label={language === 'EN' ? 'Articles' : 'Статьи'} count={counts.articles} icon="article" />}
            {counts.dishes > 0 && <FilterTab id="dishes" label={language === 'EN' ? 'Dishes' : 'Блюда'} count={counts.dishes} icon="restaurant" />}
            {counts.drinks > 0 && <FilterTab id="drinks" label={language === 'EN' ? 'Drinks' : 'Напитки'} count={counts.drinks} icon="wine_bar" />}
            {counts.paintings > 0 && <FilterTab id="paintings" label={language === 'EN' ? 'Art' : 'Картины'} count={counts.paintings} icon="palette" />}
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 px-3 pt-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
            <span className="material-symbols-outlined text-6xl mb-4 text-gray-300">favorite_border</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {searchQuery
                ? (language === 'EN' ? 'No matches found' : 'Ничего не найдено по запросу')
                : (language === 'EN' ? 'Your favorites list is empty' : 'Вы еще ничего не добавили в избранное')
              }
            </p>
          </div>
        ) : (
          <>
            {/* Logic: Show specific or stack all non-empty filtered sections in PRIORITY order */}
            {/* 1. DISHES */}
            {(activeFilter === 'all' || activeFilter === 'dishes') && <Section title={language === 'EN' ? 'Dishes' : 'Блюда'} items={filteredData.dishes} type="dish" />}

            {/* 2. DRINKS */}
            {(activeFilter === 'all' || activeFilter === 'drinks') && <Section title={language === 'EN' ? 'Drinks' : 'Напитки'} items={filteredData.drinks} type="drink" />}

            {/* 3. ARTICLES */}
            {(activeFilter === 'all' || activeFilter === 'articles') && <Section title={language === 'EN' ? 'Articles' : 'Статьи'} items={filteredData.articles} type="article" />}

            {/* 4. MEDIA */}
            {(activeFilter === 'all' || activeFilter === 'media') && <Section title={language === 'EN' ? 'Media' : 'Медиа'} items={filteredData.media} type="media" />}

            {/* 5. PAINTINGS */}
            {(activeFilter === 'all' || activeFilter === 'paintings') && <Section title={language === 'EN' ? 'Art' : 'Картины'} items={filteredData.paintings} type="painting" />}
          </>
        )}
      </div>

      {/* FOOTER (Navigation) */}
      <div className="fixed bottom-0 z-50 w-full sabor-fixed bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
        <div
          className={`grid ${(() => {
            const showFooterMenu = isVisible({ scope: 'menuItem', target: 'footer.menu' });
            const showFooterFavorites = true; // Always visible on this page? Or use 'footer.favorites'
            const showFooterSearch = isVisible({ scope: 'menuItem', target: 'footer.search' });
            const showFooterTools = isVisible({ scope: 'menuItem', target: 'footer.tools' });
            const showFooterAdmin = isAuthenticated && currentUser?.role === 'администратор' && isVisible({ scope: 'menuItem', target: 'footer.admin' });

            const count = (showFooterMenu ? 1 : 0) + 1 + (showFooterSearch ? 1 : 0) + (showFooterTools ? 1 : 0) + (showFooterAdmin ? 1 : 0);
            if (count >= 5) return 'grid-cols-5';
            if (count === 4) return 'grid-cols-4';
            return 'grid-cols-3';
          })()} px-6 items-center h-[60px]`}
        >
          {isVisible({ scope: 'menuItem', target: 'footer.menu' }) && (
            <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
              <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
              <span className="text-[10px] font-bold">{language === 'EN' ? 'Menu' : 'Меню'}</span>
            </NavLink>
          )}

          <NavLink to="/favorites" className={({ isActive }) => `flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
            <span className="material-symbols-outlined text-[24px] fill-1">favorite</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
          </NavLink>

          {isVisible({ scope: 'menuItem', target: 'footer.search' }) && (
            <button onClick={() => navigate('/search')} className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 transition-colors">
              <span className="material-symbols-outlined text-[24px]">search</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Search' : 'Поиск'}</span>
            </button>
          )}

          {isVisible({ scope: 'menuItem', target: 'footer.tools' }) && (
            <NavLink to="/info" className={({ isActive }) => `flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
              <span className="material-symbols-outlined text-[24px]">new_releases</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Info' : 'Инфо'}</span>
            </NavLink>
          )}

          {isAuthenticated && currentUser?.role === 'администратор' && isVisible({ scope: 'menuItem', target: 'footer.admin' }) && (
            <NavLink to="/admin" className={({ isActive }) => `flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
              <span className="material-symbols-outlined text-[24px]">person</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Admin' : 'Админ'}</span>
            </NavLink>
          )}
        </div>
      </div>
    </div>
  );
}

export default FavoritesPage;
