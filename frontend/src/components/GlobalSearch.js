import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDishes, getMenus } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useVisibility } from '../contexts/VisibilityContext';
import mediaItems from '../data/mediaItems';


/**
 * Глобальный поиск по всему приложению
 * Ищет во всех блюдах, меню и других данных (кроме технических настроек)
 */
function GlobalSearch({ isOpen, onClose, searchQuery: externalQuery = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, isGuest } = useAuth();
  const { isVisible } = useVisibility();
  const [searchQuery, setSearchQuery] = useState(() => {
    // KISS + Термин **sessionStorage**: "временная память" вкладки. 
    // Если пользователь уже что-то искал, мы это вспомним.
    return externalQuery || sessionStorage.getItem('globalSearchQuery') || '';
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allDishes, setAllDishes] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [searchIndex, setSearchIndex] = useState([]);
  const [activeFilter, setActiveFilter] = useState(() => {
    return sessionStorage.getItem('globalSearchFilter') || 'all';
  });
  const inputRef = useRef(null);


  const highlightTimeoutRef = useRef(null);
  const isSearchRoute = location.pathname === '/search';

  // Кнопка "Стереть": очищаем запрос и, соответственно, результаты.
  const handleClear = () => {
    setSearchQuery('');
    setResults([]);
    // Удаляем из памяти при полной очистке
    sessionStorage.removeItem('globalSearchQuery');
    // После очистки удобно сразу вернуть фокус на поле ввода.
    setTimeout(() => inputRef.current?.focus(), 0);
  };


  // Загружаем данные при открытии
  useEffect(() => {
    if (isOpen) {
      loadData();
      // Фокус на поле ввода
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Обновляем поиск при изменении запроса или фильтра
  useEffect(() => {
    if (isOpen && searchQuery.trim()) {
      performSearch(searchQuery.trim());
    } else {
      setResults([]);
    }

    // Сохраняем значения в память при каждом изменении
    if (isOpen) {
      sessionStorage.setItem('globalSearchQuery', searchQuery);
      sessionStorage.setItem('globalSearchFilter', activeFilter);
    }
  }, [searchQuery, isOpen, searchIndex, activeFilter]);



  // Загружаем все данные для индексации
  const loadData = async () => {
    setLoading(true);
    try {
      const [dishes, menus, manifestResponse] = await Promise.all([
        getDishes(),
        getMenus(),
        fetch('/content/manifest.json').then(r => r.json()).catch(() => ({ articles: [] }))
      ]);

      setAllDishes(dishes);
      setAllMenus(menus);

      // Создаем поисковый индекс
      const index = buildSearchIndex(dishes, menus, manifestResponse.articles || []);
      setSearchIndex(index);
    } catch (error) {
      console.error('Ошибка загрузки данных для поиска:', error);
    } finally {
      setLoading(false);
    }

  };

  // Строим поисковый индекс из всех данных
  const buildSearchIndex = (dishes, menus, articles) => {
    const index = [];
    const allowArchived = isVisible({ scope: 'contentItem', target: 'status.archived' });

    const getItemKind = (it) => {
      // Проверка на картину (ID начинается с 09)
      if (String(it?.id || '').startsWith('09')) return 'art';

      const menu = String(it?.menu || '').toLowerCase();
      const section = String(it?.section || '').toLowerCase();

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

      if (isWine) return 'wine';
      if (isBar) return 'bar';
      return 'dish';
    };

    const getDetailPathForItem = (it) => {
      const kind = getItemKind(it);
      if (kind === 'art') return `/art/${it.id}`;
      if (kind === 'wine') return `/wine/${it.id}`;
      if (kind === 'bar') return `/bar/${it.id}`;
      return `/dish/${it.id}`;
    };

    // Индексируем меню
    menus.forEach(menuName => {
      index.push({
        type: 'menu',
        id: `menu-${menuName}`,
        title: menuName,
        text: menuName,
        location: 'Главная страница',
        path: `/menu/${encodeURIComponent(menuName)}`,
        menu: menuName,
        category: 'dish'
      });
    });

    // Индексируем блюда, напитки и картины
    dishes.forEach(dish => {
      const isArchived = dish.status === 'в архиве';
      if (isArchived && !allowArchived) return;

      const itemKind = getItemKind(dish);
      const detailPath = getDetailPathForItem(dish);

      // Определяем категорию для фильтрации
      let searchCategory = 'dish';
      if (itemKind === 'wine' || itemKind === 'bar') searchCategory = 'drink';
      if (itemKind === 'art') searchCategory = 'art';

      const searchableFields = {
        title: dish.title || '',
        description: dish.description || '',
        author: dish.author || '', // Для картин
        section: dish.section || '',
        menu: dish.menu || '',
        contains: dish.contains ? stripHtml(dish.contains) : '',
        features: dish.features || '',
        reference_info: dish.reference_info ? stripHtml(dish.reference_info) : '',
        ingredients: Array.isArray(dish.ingredients) ? dish.ingredients.join(' ') : '',
        tags: Array.isArray(dish.tags) ? dish.tags.join(' ') : '',
      };

      Object.entries(searchableFields).forEach(([field, value]) => {
        if (value && value.trim()) {
          index.push({
            type: itemKind === 'art' ? 'art' : 'dish',
            category: searchCategory,
            field: field,
            id: dish.id,
            dishId: dish.id,
            title: dish.title || 'Без названия',
            text: value,
            location: itemKind === 'art'
              ? `Галерея / ${dish.location || 'Зал'}`
              : `${dish.menu || 'Без меню'} / ${dish.section || 'Без раздела'}`,
            path: detailPath,
            dish: dish,
            isArchived: isArchived,
            itemKind: itemKind,
          });
        }
      });
    });

    // Индексируем статьи
    articles.forEach(article => {
      const searchableFields = {
        title: article.title || '',
        description: article.description || '',
        category: article.category || '',
      };

      Object.entries(searchableFields).forEach(([field, value]) => {
        if (value && value.trim()) {
          index.push({
            type: 'article',
            category: 'article',
            field: field,
            id: `article-${article.key}`,
            title: article.title || 'Статья',
            text: value,
            location: `Статьи / ${article.category || 'Общее'}`,
            path: `/article/${article.key}`,
            image: article.image
          });
        }
      });
    });

    // Индексируем медиа
    mediaItems.forEach(media => {
      const searchableFields = {
        title: media.title || '',
        description: media.description || '',
        category: media.category || '',
      };

      Object.entries(searchableFields).forEach(([field, value]) => {
        if (value && value.trim()) {
          index.push({
            type: 'media',
            category: 'media',
            field: field,
            id: media.id,
            title: media.title || 'Медиа',
            text: value,
            location: `Медиа / ${media.category || 'Обучение'}`,
            path: '/media', // Переход в медиа-раздел (т.к. нет отдельной страницы)
            image: media.coverUrl
          });
        }
      });
    });

    return index;
  };


  // Удаляем HTML теги из текста
  const stripHtml = (html) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Выполняем поиск
  const performSearch = (query) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const queryLower = query.toLowerCase();
    const matches = [];

    searchIndex.forEach(item => {
      // Прямой фильтр по категории
      if (activeFilter !== 'all' && item.category !== activeFilter) {
        return;
      }

      const textLower = item.text.toLowerCase();
      if (textLower.includes(queryLower)) {

        // Находим позицию совпадения для подсветки
        const index = textLower.indexOf(queryLower);
        const start = Math.max(0, index - 50);
        const end = Math.min(item.text.length, index + query.length + 50);
        const snippet = item.text.substring(start, end);
        const snippetIndex = snippet.toLowerCase().indexOf(queryLower);

        matches.push({
          ...item,
          snippet: snippet,
          snippetIndex: snippetIndex,
          matchIndex: index
        });
      }
    });

    // Сортируем результаты по релевантности
    matches.sort((a, b) => {
      // Приоритет: название > описание > остальное
      const priority = { title: 3, 'title-en': 3, description: 2, 'description-en': 2, section: 1, 'section-en': 1 };
      const aPriority = priority[a.field] || 0;
      const bPriority = priority[b.field] || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      // Если приоритет одинаковый, сортируем по позиции совпадения (раньше = лучше)
      return a.matchIndex - b.matchIndex;
    });

    setResults(matches.slice(0, 50)); // Ограничиваем 50 результатами
  };

  // Подсветка текста в сниппете
  const highlightSnippet = (snippet, query, matchIndex) => {
    if (!snippet || !query) return snippet;

    const queryLower = query.toLowerCase();
    const snippetLower = snippet.toLowerCase();
    const index = snippetLower.indexOf(queryLower);

    if (index === -1) return snippet;

    const before = snippet.substring(0, index);
    const match = snippet.substring(index, index + query.length);
    const after = snippet.substring(index + query.length);

    return (
      <>
        {before}
        <mark className="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded font-semibold">
          {match}
        </mark>
        {after}
      </>
    );
  };

  // Переход к результату с подсветкой
  const handleResultClick = (result) => {
    // Сохраняем поисковый запрос для подсветки на целевой странице
    sessionStorage.setItem('globalSearchQuery', searchQuery);
    sessionStorage.setItem('globalSearchField', result.field || '');
    sessionStorage.setItem('globalSearchDishId', result.dishId || result.id || '');
    sessionStorage.setItem('globalSearchType', result.type || '');
    sessionStorage.setItem('fromSearch', 'true');

    // Закрываем поиск

    onClose();

    // Небольшая задержка для плавного перехода
    setTimeout(() => {
      navigate(result.path);
    }, 100);
  };

  // Получаем иконку для типа результата
  const getResultIcon = (type, field, itemKind) => {
    if (type === 'menu') return 'restaurant_menu';
    if (type === 'article') return 'article';
    if (type === 'media') return 'play_circle';
    if (type === 'art') return 'palette';
    if (type === 'dish') {
      if (itemKind === 'wine') return 'wine_bar';
      if (itemKind === 'bar') return 'local_bar';
      if (field === 'title' || field === 'title-en') return 'restaurant';
      if (field === 'description' || field === 'description-en') return 'description';
      if (field === 'section' || field === 'section-en') return 'category';
      if (field === 'contains' || field === 'contains-en') return 'menu_book';
      if (field === 'ingredients') return 'inventory';
      if (field === 'comments' || field === 'comments-en') return 'comment';
      if (field === 'tags' || field === 'tags-en') return 'sell';
      if (field === 'allergens' || field === 'allergens-en') return 'warning';
      if (field === 'features') return 'star';
      if (field === 'reference_info') return 'lightbulb';
    }
    return 'search';
  };

  const getFilterIcon = (filter) => {
    switch (filter) {
      case 'all': return 'all_inclusive';
      case 'dish': return 'restaurant';
      case 'drink': return 'local_bar';
      case 'media': return 'play_circle';
      case 'article': return 'article';
      case 'art': return 'palette';
      default: return 'search';
    }
  };

  const getFilterLabel = (filter) => {
    switch (filter) {
      case 'all': return 'Всё';
      case 'dish': return 'Блюда';
      case 'drink': return 'Напитки';
      case 'media': return 'Медиа';
      case 'article': return 'Статьи';
      case 'art': return 'Картины';
      default: return filter;
    }
  };


  // Получаем название поля на русском
  const getFieldName = (field) => {
    const fieldNames = {
      'title': 'Название',
      'title-en': 'Название (EN)',
      'description': 'Описание',
      'description-en': 'Описание (EN)',
      'section': 'Раздел',
      'section-en': 'Раздел (EN)',
      'contains': 'Состав',
      'contains-en': 'Состав (EN)',
      'ingredients': 'Ингредиенты',
      'comments': 'Комментарии',
      'comments-en': 'Комментарии (EN)',
      'tags': 'Теги',
      'tags-en': 'Теги (EN)',
      'allergens': 'Аллергены',
      'allergens-en': 'Аллергены (EN)',
      'features': 'Особенности',
      'reference_info': 'Справочная информация',
      'author': 'Автор',
      'category': 'Категория'
    };

    return fieldNames[field] || field;
  };

  if (!isOpen) return null;
  if (!isVisible({ scope: 'pageBlock', target: 'search.input' })) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col ${
        // На /search используем общую заливку приложения, без затемнения.
        // На других страницах (если вдруг откроют как модалку) оставляем затемнение.
        isSearchRoute
          ? 'bg-background-light dark:bg-background-dark'
          : 'bg-black/60 backdrop-blur-sm'
        }`}
    >
      {/* Верхняя панель (как принято на мобильных): назад + заголовок */}
      {isSearchRoute && (
        <header className="sticky top-0 z-[205] bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
          <div className="sabor-container flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="text-[#181311] dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors"
              aria-label="Назад"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-[#181311] dark:text-white text-base font-bold">
              Поиск
            </h1>
          </div>
        </header>
      )}

      {/* Результаты поиска */}
      <div className="flex-1 overflow-y-auto">
        {/* Фильтры */}
        <div className="sticky top-0 z-[206] bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 py-3 border-b border-gray-100 dark:border-gray-800/50">
          <div className="sabor-container flex gap-2 overflow-x-auto no-scrollbar">
            {['all', 'dish', 'drink', 'media', 'article', 'art'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${activeFilter === filter
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : 'bg-white/50 dark:bg-white/5 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {getFilterIcon(filter)}
                </span>
                {getFilterLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        <div className="sabor-container p-4 pb-40">

          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-6xl mb-4 block opacity-50 animate-spin">refresh</span>
              <p>Загрузка данных...</p>
            </div>
          ) : searchQuery.trim().length < 2 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">search</span>
              <p className="text-lg font-semibold mb-2">Введите запрос для поиска</p>
              <p className="text-sm">Минимум 2 символа</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">search_off</span>
              <p className="text-lg font-semibold mb-2">Ничего не найдено</p>
              <p className="text-sm">Попробуйте изменить запрос</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Найдено результатов: {results.length}
              </div>
              {results.map((result, idx) => (
                <button
                  key={`${result.id}-${idx}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors border border-gray-200 dark:border-gray-800 relative"
                >
                  {result.isArchived && (
                    <span className="absolute top-2 right-2 bg-gray-700/90 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                      В АРХИВЕ
                    </span>
                  )}
                  <div className={`flex items-start gap-3 ${result.isArchived ? 'opacity-60 grayscale' : ''}`}>
                    {/* 
                      KISS: Решаем, показывать ли картинку.
                      Правило: есть изображение И совпадение именно в названии.
                    */}
                    {(result.field === 'title' || result.field === 'title-en') && (result.image || result.dish?.image?.src) ? (
                      <div className="size-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                        <img
                          src={result.image || (result.dish?.image?.src ? result.dish.image.src.replace(/^\.\//, '/') : '')}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Если картинка не загрузилась (битая ссылка), прячем её и показываем иконку
                            if (e.target.parentElement) {
                              e.target.parentElement.innerHTML = `<div class="flex size-full items-center justify-center text-primary"><span class="material-symbols-outlined">search</span></div>`;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="size-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-gray-900 border border-transparent">
                        <span className="material-symbols-outlined text-primary text-2xl">
                          {getResultIcon(result.type, result.field, result.itemKind)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-base text-[#181311] dark:text-white">
                          {result.title}
                        </h3>
                        {result.isEnglish && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                            EN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        {result.location}
                        {result.field && ` • ${getFieldName(result.field)}`}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {highlightSnippet(result.snippet, searchQuery, result.snippetIndex)}
                      </p>
                    </div>
                  </div>

                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Нижняя панель: строка поиска + футер */}
      <div className="fixed bottom-0 left-0 right-0 z-[210]">
        {/* Строка поиска (внизу — удобнее на мобильном) */}
        <div className="bg-white/95 dark:bg-[#181311]/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="sabor-container flex items-center gap-3">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по всему приложению..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2420] text-[#181311] dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-semibold"
            >
              Стереть
            </button>
          </div>
        </div>

        {/* Аналогичный нижний футер (как на остальных страницах) */}
        <div className="w-full bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
          <div
            className={`sabor-container grid ${(() => {
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
              <button
                type="button"
                onClick={() => {
                  // На странице /search просто переходим.
                  // В модальном режиме (на главной) сначала закрываем, потом переходим.
                  if (!isSearchRoute) onClose?.();
                  setTimeout(() => navigate('/'), !isSearchRoute ? 50 : 0);
                }}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${location.pathname === '/'
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
                <span className="text-[10px] font-bold">Меню</span>
              </button>
            )}

            {isVisible({ scope: 'menuItem', target: 'footer.favorites' }) && (
              <button
                type="button"
                onClick={() => {
                  if (isGuest) {
                    if (!isSearchRoute) onClose?.();
                    setTimeout(() => navigate('/', { state: { showLogin: true } }), !isSearchRoute ? 50 : 0);
                    return;
                  }
                  if (!isSearchRoute) onClose?.();
                  setTimeout(() => navigate('/favorites'), !isSearchRoute ? 50 : 0);
                }}
                title={isGuest ? 'Доступно после входа' : 'Избранное'}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${isGuest
                  ? 'opacity-50 cursor-not-allowed text-gray-400'
                  : location.pathname.startsWith('/favorites')
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-[24px] fill-1">favorite</span>
                <span className="text-[10px] font-medium">Избранное</span>
              </button>
            )}

            {isVisible({ scope: 'menuItem', target: 'footer.search' }) && (
              <button
                type="button"
                onClick={() => {
                  // Мы уже в поиске — просто фокусим строку ввода.
                  inputRef.current?.focus();
                }}
                className="flex flex-col items-center justify-center gap-1 text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">search</span>
                <span className="text-[10px] font-medium">Поиск</span>
              </button>
            )}

            {isVisible({ scope: 'menuItem', target: 'footer.tools' }) && (
              <button
                type="button"
                onClick={() => {
                  if (!isSearchRoute) onClose?.();
                  setTimeout(() => navigate('/info'), !isSearchRoute ? 50 : 0);
                }}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${location.pathname.startsWith('/info')
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-[24px]">new_releases</span>
                <span className="text-[10px] font-medium">Информация</span>
              </button>
            )}

            {isAuthenticated &&
              currentUser?.role === 'администратор' &&
              isVisible({ scope: 'menuItem', target: 'footer.admin' }) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isSearchRoute) onClose?.();
                    setTimeout(() => navigate('/admin'), !isSearchRoute ? 50 : 0);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 transition-colors ${location.pathname.startsWith('/admin')
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-[#181311] dark:text-gray-500 dark:hover:text-white'
                    }`}
                >
                  <span className="material-symbols-outlined text-[24px]">person</span>
                  <span className="text-[10px] font-medium">Админ-панель</span>
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
