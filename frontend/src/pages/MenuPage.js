import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDishes } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useVisibility } from '../contexts/VisibilityContext';
import { getDishImageUrl } from '../utils/imageUtils';
import { useFavorites } from '../contexts/FavoritesContext';

function MenuPage({ mode }) {
  const { menuName } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, isGuest } = useAuth();
  const { isVisible } = useVisibility();
  const { catalogIds } = useFavorites();
  const [dishes, setDishes] = useState([]);
  const [allDishes, setAllDishes] = useState([]); // Все блюда из всех меню для избранного
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showSectionFilter, setShowSectionFilter] = useState(false);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [language, setLanguage] = useState(() => {
    // Загружаем язык из localStorage или используем 'RU' по умолчанию
    return localStorage.getItem('menuLanguage') || 'RU';
  });
  const [showFavorites, setShowFavorites] = useState(false);
  const favorites = catalogIds;
  const menuFiltersStorageKey = `menuFilters:${mode === 'tea' ? 'tea' : (menuName || 'all')}`;
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Функция для воспроизведения аудио (Pronunciation)
  const handleAudioPlay = (dish) => {
    const audioPath = dish?.i18n?.en?.['audio-en'];
    const API_URL = process.env.REACT_APP_API_URL || '';
    const isWine = dish.menu?.toLowerCase().includes('вин') || dish.section?.toLowerCase().includes('вин');

    let audioUrl;
    if (audioPath) {
      // Нормализуем путь (убираем лишние пробелы и ..)
      const normalizedPath = String(audioPath).trim().replace(/%20/g, '-').replace(/\s+/g, '-');

      if (normalizedPath.startsWith('../audio/')) {
        audioUrl = `${API_URL}/audio/${normalizedPath.replace('../audio/', '')}`;
      } else if (normalizedPath.startsWith('/audio/')) {
        audioUrl = `${API_URL}/audio/${normalizedPath.replace('/audio/', '')}`;
      } else if (normalizedPath.startsWith('audio/')) {
        audioUrl = `${API_URL}/audio/${normalizedPath.replace('audio/', '')}`;
      } else {
        audioUrl = normalizedPath.startsWith('http') ? normalizedPath : `/${normalizedPath}`;
      }
    } else {
      // Фолбэк на ID-ориентированный путь
      audioUrl = `${API_URL}/audio/${isWine ? 'wine' : 'en'}/${dish.id}.mp3`;
    }

    const audio = new Audio(audioUrl);
    audio.play().catch(err => {
      console.error('Ошибка воспроизведения аудио:', { url: audioUrl, err });
    });
  };

  const isArtItem = (item) => {
    const idNumber = Number(String(item?.id || '').replace(/\D/g, ''));
    const source = String(item?.source || '').toLowerCase();
    const hasAuthor = Boolean(item?.author);
    // Картины: ID 901–999 + источник про "искусство".
    return (
      Number.isFinite(idNumber) &&
      idNumber >= 901 &&
      idNumber <= 999 &&
      (source.includes('искусство') || hasAuthor)
    );
  };

  const isTeaItem = (item) => {
    if (isArtItem(item)) return false;
    const menu = String(item?.menu || '').toLowerCase();
    const section = String(item?.section || '').toLowerCase();
    const idNumber = Number(String(item?.id || '').replace(/\D/g, ''));

    const isTeaById = Number.isFinite(idNumber) && idNumber >= 801 && idNumber <= 899;

    return (
      menu.includes('чай') ||
      menu.includes('tea') ||
      section.includes('чай') ||
      section.includes('tea') ||
      isTeaById
    );
  };

  const isFilled = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  };

  const normalizeSection = (value) =>
    String(value ?? '')
      .normalize('NFKC')
      // Убираем невидимые символы (например, zero‑width).
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Приводим неразрывные пробелы к обычным.
      .replace(/\u00A0/g, ' ')
      // Убираем эмодзи и прочие символы, оставляем только буквы и цифры.
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

  // Нормализуем название меню, чтобы разные варианты совпадали.
  const normalizeMenuName = (value) => {
    const normalized = String(value ?? '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // Старое имя "Основное меню (Sabor de la Vida)" -> "Основное меню"
    if (normalized.includes('основное') && normalized.includes('sabor de la vida')) {
      return 'основное меню';
    }

    return normalized;
  };

  const buildSections = (items) => {
    const map = new Map();
    items.forEach((dish) => {
      if (!dish?.section) return;
      const key = normalizeSection(dish.section);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: String(dish.section).trim(),
          dish,
        });
      }
    });
    return Array.from(map.values());
  };

  // Восстанавливаем фильтры меню из localStorage (память браузера).
  useEffect(() => {
    const saved = localStorage.getItem(menuFiltersStorageKey);
    if (!saved) {
      setFiltersLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      const hasGlobalSearch = sessionStorage.getItem('globalSearchQuery');
      setSelectedSection(parsed?.selectedSection ?? 'all');
      if (!hasGlobalSearch) {
        setSearchQuery(parsed?.searchQuery ?? '');
      }
      setSelectedAllergens(Array.isArray(parsed?.selectedAllergens) ? parsed.selectedAllergens : []);
      setSelectedTags(Array.isArray(parsed?.selectedTags) ? parsed.selectedTags : []);
      setShowFavorites(Boolean(parsed?.showFavorites));
    } catch (error) {
      console.warn('Не удалось прочитать фильтры меню из localStorage:', error);
    } finally {
      setFiltersLoaded(true);
    }
  }, [menuFiltersStorageKey]);

  // Определяем “тип” позиции по полям menu/section (KISS: простые проверки по словам).
  const isWineItem = (it) => {
    const menu = String(it?.menu || '').toLowerCase();
    const section = String(it?.section || '').toLowerCase();
    return (
      menu.includes('вино') ||
      menu.includes('wine') ||
      section.includes('вино') ||
      section.includes('wine')
    );
  };

  const isBarItem = (it) => {
    const menu = String(it?.menu || '').toLowerCase();
    const section = String(it?.section || '').toLowerCase();
    return (
      menu.includes('бар') ||
      menu.includes('bar') ||
      menu.includes('напит') ||
      menu.includes('drink') ||
      section.includes('коктейл') ||
      section.includes('cocktail') ||
      section.includes('пиво') ||
      section.includes('beer') ||
      section.includes('кофе') ||
      section.includes('coffee') ||
      section.includes('напит') ||
      section.includes('drink')
    );
  };

  const isBeer = (it) => {
    const menu = String(it?.menu || '').toLowerCase();
    const section = String(it?.section || '').toLowerCase();
    return (
      menu.includes('пиво') ||
      menu.includes('beer') ||
      section.includes('пиво') ||
      section.includes('beer')
    );
  };

  const getContentTarget = (it) => {
    const id = String(it?.id ?? '').trim();
    if (!id) return null;
    if (isWineItem(it)) return `wine:${id}`;
    if (isBarItem(it)) return `bar:${id}`;
    return `dish:${id}`;
  };

  const isContentVisible = (it) => {
    // Архивные позиции скрываем отдельным правилом.
    const isArchived = it?.status === 'в архиве';
    if (isArchived && !isVisible({ scope: 'contentItem', target: 'status.archived' })) {
      return false;
    }
    const target = getContentTarget(it);
    if (!target) return true;
    return isVisible({ scope: 'contentItem', target });
  };

  const getDetailPathForItem = (it) => {
    const isTea = isTeaItem(it);
    const isWine = isWineItem(it);
    const isBar = isBarItem(it);

    if (isTea) return `/tea/${it.id}`;
    if (isWine) return `/wine/${it.id}`;
    if (isBar) return `/bar/${it.id}`;
    return `/dish/${it.id}`;
  };

  const handleBack = () => {
    if (sessionStorage.getItem('fromSearch') === 'true') {
      sessionStorage.removeItem('fromSearch');
      navigate('/search');
    } else {
      navigate(-1);
    }
  };

  const parseCardIngredients = (value) => {

    if (typeof value !== 'string' || value.trim().length === 0) return [];
    // Если есть '/', делим по нему, иначе по запятой.
    const separator = value.includes('/') ? '/' : ',';
    return value
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);
  };

  useEffect(() => {
    const loadDishes = async () => {
      try {
        const allDishesData = await getDishes();
        const decodedMenuName = menuName ? decodeURIComponent(menuName) : '';

        // Сохраняем все блюда для избранного (включая "в архиве")
        // Термин **архив**: позиция “неактивна”, но мы её показываем затемнённой.
        setAllDishes(allDishesData);

        // Фильтруем блюда: только из нужного меню (архивные тоже показываем, но затемняем в UI)
        const filtered = mode === 'tea'
          ? allDishesData.filter((dish) => isTeaItem(dish))
          : allDishesData.filter(
            (dish) => normalizeMenuName(dish.menu) === normalizeMenuName(decodedMenuName)
          );
        const visibleFiltered = filtered.filter((dish) => isContentVisible(dish));
        setDishes(visibleFiltered);

        const uniqueSections = buildSections(visibleFiltered);
        setSections(uniqueSections);

        // Проверяем, есть ли запрос из глобального поиска для автоскролла
        const globalSearchQuery = sessionStorage.getItem('globalSearchQuery');
        if (globalSearchQuery) {
          // Устанавливаем поисковый запрос
          setSearchQuery(globalSearchQuery);

          // Очищаем sessionStorage после использования
          setTimeout(() => {
            sessionStorage.removeItem('globalSearchQuery');
            sessionStorage.removeItem('globalSearchField');
            sessionStorage.removeItem('globalSearchDishId');
          }, 3000);
        }
      } catch (error) {
        console.error('Ошибка загрузки блюд:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDishes();
  }, [menuName, mode, isVisible]);


  // Сохраняем выбранные фильтры меню в localStorage.
  useEffect(() => {
    if (!filtersLoaded) return;
    const payload = {
      selectedSection,
      searchQuery,
      selectedAllergens,
      selectedTags,
      showFavorites,
    };
    localStorage.setItem(menuFiltersStorageKey, JSON.stringify(payload));
  }, [
    menuFiltersStorageKey,
    selectedSection,
    searchQuery,
    selectedAllergens,
    selectedTags,
    showFavorites,
  ]);

  // Закрытие выпадающих меню при клике вне их области
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSectionFilter(false);
      setShowAllergenFilter(false);
      setShowTagFilter(false);
    };

    if (showSectionFilter || showAllergenFilter || showTagFilter) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSectionFilter, showAllergenFilter, showTagFilter]);

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

    const raw = dish.allergens;
    if (typeof raw === 'string') {
      return raw.split(',').map(a => a.trim()).filter(Boolean);
    }
    return Array.isArray(raw) ? raw : [];
  };

  // Получаем все уникальные аллергены и теги из блюд (с учетом языка)
  // Если показываем избранное, используем все блюда, иначе только из текущего меню
  const visibleAllDishes = allDishes.filter((dish) => isContentVisible(dish));
  const dishesForFilters = showFavorites ? visibleAllDishes : dishes;
  const allAllergens = [...new Set(dishesForFilters.flatMap(d => getAllergensForLanguage(d)))].filter(Boolean);
  const allTags = [...new Set(dishesForFilters.flatMap(d => getTagsForLanguage(d)))].filter(Boolean);

  // Фильтруем блюда с учетом избранного
  // Если показываем избранное, берем все блюда из всех меню, иначе только из текущего меню
  const dishesToShow = showFavorites
    ? visibleAllDishes.filter(dish => favorites.includes(dish.id))
    : dishes;

  const filteredDishes = dishesToShow.filter((dish) => {
    // Фильтр по категории (section)
    const matchesSection =
      selectedSection === 'all' ||
      normalizeSection(dish.section) === selectedSection;

    // Фильтр по поисковому запросу (название, описание, категория, аллергены, теги)
    const queryLower = searchQuery.toLowerCase();
    const dishTitle = getFieldValue(dish, 'title');
    const dishDescription = getFieldValue(dish, 'description');
    const dishSection = getFieldValue(dish, 'section');
    const dishAllergens = getAllergensForLanguage(dish);
    const dishTags = getTagsForLanguage(dish);

    const matchesSearch =
      !searchQuery ||
      dishTitle?.toLowerCase().includes(queryLower) ||
      dishDescription?.toLowerCase().includes(queryLower) ||
      dishSection?.toLowerCase().includes(queryLower) ||
      dishAllergens.some(a => a.toLowerCase().includes(queryLower)) ||
      dishTags.some(t => t.toLowerCase().includes(queryLower));

    // Фильтр по аллергенам
    const matchesAllergens =
      selectedAllergens.length === 0 ||
      selectedAllergens.some(selected =>
        dishAllergens.some(a =>
          a.toLowerCase().includes(selected.toLowerCase()) ||
          selected.toLowerCase().includes(a.toLowerCase())
        )
      );

    // Фильтр по тегам
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some(selected =>
        dishTags.some(t =>
          t.toLowerCase().includes(selected.toLowerCase()) ||
          selected.toLowerCase().includes(t.toLowerCase())
        )
      );

    return matchesSection && matchesSearch && matchesAllergens && matchesTags;
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

  // Иконки аллергенов как в карточке блюда (DishDetailPage).
  const normalizeAllergen = (value) => (value || '').toString().trim().toLowerCase();
  const ALLERGEN_EMOJI_MAP = {
    // Русские
    'орехи': { icon: '🥜', label: 'Орехи' },
    'лактоза': { icon: '🥛', label: 'Лактоза' },
    'глютен': { icon: '🌾', label: 'Глютен' },
    'яйца': { icon: '🥚', label: 'Яйца' },
    'цитрусы': { icon: '🍋', label: 'Цитрусы' },
    'морепродукты': { icon: '🍤', label: 'Морепродукты' },
    'рыба': { icon: '🐟', label: 'Рыба' },
    'кунжут': { icon: '⚪️', label: 'Кунжут' },
    'горчица': { icon: '🌭', label: 'Горчица' },
    'чеснок': { icon: '🧄', label: 'Чеснок' },
    'лук': { icon: '🧅', label: 'Лук' },
    'перец чили': { icon: '🌶️', label: 'Перец чили' },
    'кинза': { icon: '🌿', label: 'Кинза' },
    'алкоголь': { icon: '🍷', label: 'Алкоголь' },
    'грибы': { icon: '🍄', label: 'Грибы' },
    'мёд': { icon: '🍯', label: 'Мёд' },
    'трюфель': { icon: '🍄', label: 'Трюфель' },
    'свинина': { icon: '🐖', label: 'Свинина' },
    'эстрагон': { icon: '🌿', label: 'Эстрагон' },
    'халапеньо': { icon: '🌶️', label: 'Халапеньо' },
    'шафран': { icon: '🧡', label: 'Шафран' },
    'зелень': { icon: '🌿', label: 'Зелень' },

    // Английские / ID из админки
    'nuts': { icon: '🥜', label: 'Nuts' },
    'lactose': { icon: '🥛', label: 'Lactose' },
    'gluten': { icon: '🌾', label: 'Gluten' },
    'egg': { icon: '🥚', label: 'Eggs' },
    'eggs': { icon: '🥚', label: 'Eggs' },
    'citrus': { icon: '🍋', label: 'Citrus' },
    'seafood': { icon: '🍤', label: 'Seafood' },
    'fish': { icon: '🐟', label: 'Fish' },
    'sesame': { icon: '⚪️', label: 'Sesame' },
    'mustard': { icon: '🌭', label: 'Mustard' },
    'garlic': { icon: '🧄', label: 'Garlic' },
    'onion': { icon: '🧅', label: 'Onion' },
    'chili pepper': { icon: '🌶️', label: 'Chili pepper' },
    'cilantro': { icon: '🌿', label: 'Cilantro' },
    'alcohol': { icon: '🍷', label: 'Alcohol' },
    'mushrooms': { icon: '🍄', label: 'Mushrooms' },
    'honey': { icon: '🍯', label: 'Honey' },
    'truffle': { icon: '🍄', label: 'Truffle' },
    'pork': { icon: '🐖', label: 'Pork' },
    'tarragon': { icon: '🌿', label: 'Tarragon' },
    'jalapeño': { icon: '🌶️', label: 'Jalapeño' },
    'saffron': { icon: '🧡', label: 'Saffron' },
    'herbs': { icon: '🌿', label: 'Herbs' },
  };

  const getAllergenDisplay = (raw) => {
    const normalized = normalizeAllergen(raw);
    if (ALLERGEN_EMOJI_MAP[normalized]) {
      return ALLERGEN_EMOJI_MAP[normalized];
    }

    const matchEntry = Object.entries(ALLERGEN_EMOJI_MAP).find(([key]) =>
      normalized.includes(key)
    );
    if (matchEntry) {
      return matchEntry[1];
    }

    return { icon: '⚠️', label: raw || 'Аллерген' };
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

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  const decodedMenuName = menuName
    ? decodeURIComponent(menuName)
    : (mode === 'tea' ? 'Чай' : '');

  const isBarMenu =
    mode !== 'tea' &&
    dishes.length > 0 &&
    dishes.some((dish) => isBarItem(dish));

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden border-x border-gray-100 dark:border-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center px-4 pt-4 pb-2 justify-between">
          <button
            onClick={handleBack}
            className="text-[#181311] dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          <h2 className="text-[#181311] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            {showFavorites
              ? (language === 'EN' ? 'Favorites' : 'Избранное')
              : (language === 'EN' && dishes.length > 0 && dishes[0].i18n?.en?.['menu-en']
                ? dishes[0].i18n.en['menu-en']
                : decodedMenuName)
            }
          </h2>
          <div className="flex w-12 items-center justify-end">
            {isVisible({ scope: 'featureAction', target: 'language.switcher' }) && (
              <button
                onClick={() => {
                  const newLanguage = language === 'RU' ? 'EN' : 'RU';
                  setLanguage(newLanguage);
                  localStorage.setItem('menuLanguage', newLanguage);
                }}
                className={`text-xs font-bold leading-normal tracking-[0.015em] shrink-0 border rounded-lg px-2 py-1 transition-colors ${language === 'EN'
                  ? 'bg-primary text-white border-primary'
                  : 'text-primary border-primary/30 hover:bg-primary hover:text-white'
                  }`}
              >
                {language === 'RU' ? 'EN' : 'RU'}
              </button>
            )}
          </div>
        </div>
        {/* Breadcrumb */}
        {!showFavorites && (
          <div className="px-4 pb-2">
            <nav className="flex text-xs text-[#896f61] dark:text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis items-center">
              <Link to="/" className="hover:text-primary transition-colors cursor-pointer">Menu</Link>
              <span className="material-symbols-outlined text-[10px] mx-1 opacity-60">chevron_right</span>
              <span className="text-primary font-semibold">{decodedMenuName}</span>
            </nav>
          </div>
        )}
        {/* Search */}
        {isVisible({ scope: 'pageBlock', target: 'search.input' }) && (
          <div className="px-4 py-2">
            <div className="flex w-full items-stretch rounded-xl h-10 bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-700/50 group focus-within:border-primary/50 transition-colors">
              <div className="text-[#896f61] dark:text-gray-400 flex items-center justify-center pl-3 pr-2 group-focus-within:text-primary transition-colors">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </div>
              <input
                className="flex w-full flex-1 bg-transparent border-none text-[#181311] dark:text-white placeholder:text-[#896f61] dark:placeholder:text-gray-500 focus:ring-0 text-sm font-normal h-full p-0 pr-3"
                placeholder={
                  mode === 'tea'
                    ? (language === 'EN' ? 'Search tea...' : 'Поиск чая...')
                    : isBarMenu
                      ? (language === 'EN' ? 'Search drinks...' : 'Поиск напитка...')
                      : (language === 'EN' ? 'Search dishes...' : 'Поиск блюд...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
        {/* Filters */}
        <div className="relative">
          <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar items-center pb-3 border-t border-gray-100/50 dark:border-gray-800/50 mt-1">
            {sections.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSectionFilter(!showSectionFilter);
                  setShowAllergenFilter(false);
                  setShowTagFilter(false);
                }}
                className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 transition-transform active:scale-95 shadow-sm ${selectedSection !== 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
                  }`}
              >
                <p className={`text-xs font-medium ${selectedSection !== 'all' ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>{language === 'EN' ? 'Category' : 'Раздел'}</p>
                <span className={`material-symbols-outlined text-[16px] ${selectedSection !== 'all' ? 'text-white' : 'text-gray-500'} ${showSectionFilter ? 'rotate-180' : ''} transition-transform`}>expand_more</span>
              </button>
            )}
            {(mode !== 'tea' || allAllergens.length > 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllergenFilter(!showAllergenFilter);
                  setShowSectionFilter(false);
                  setShowTagFilter(false);
                }}
                className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 transition-transform active:scale-95 shadow-sm ${selectedAllergens.length > 0
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
                  }`}
              >
                <p className={`text-xs font-medium ${selectedAllergens.length > 0 ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>{language === 'EN' ? 'Allergens' : 'Аллергены'}</p>
                <span className={`material-symbols-outlined text-[16px] ${selectedAllergens.length > 0 ? 'text-white' : 'text-gray-500'} ${showAllergenFilter ? 'rotate-180' : ''} transition-transform`}>expand_more</span>
              </button>
            )}
            {(mode !== 'tea' || allTags.length > 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagFilter(!showTagFilter);
                  setShowSectionFilter(false);
                  setShowAllergenFilter(false);
                }}
                className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 shadow-sm transition-transform active:scale-95 ${selectedTags.length > 0
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
                  }`}
              >
                <p className={`text-xs font-semibold ${selectedTags.length > 0 ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>{language === 'EN' ? 'Tags' : 'Теги'}</p>
                <span className={`material-symbols-outlined text-[16px] ${selectedTags.length > 0 ? 'text-white' : 'text-gray-500'} ${showTagFilter ? 'rotate-180' : ''} transition-transform`}>expand_more</span>
              </button>
            )}
          </div>

          {/* Выпадающее меню для категорий */}
          {showSectionFilter && sections.length > 0 && (
            <div
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setSelectedSection('all');
                  setShowSectionFilter(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${selectedSection === 'all' ? 'bg-primary/10 text-primary font-semibold' : ''
                  }`}
              >
                {language === 'EN' ? 'All Categories' : 'Все категории'}
              </button>
              {sections.map((section) => {
                const sectionName =
                  language === 'EN' && section?.dish?.i18n?.en?.['section-en']
                    ? section.dish.i18n.en['section-en']
                    : section.label;
                return (
                  <button
                    key={section.key}
                    onClick={() => {
                      setSelectedSection(section.key);
                      setShowSectionFilter(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${selectedSection === section.key ? 'bg-primary/10 text-primary font-semibold' : ''
                      }`}
                  >
                    {sectionName}
                  </button>
                );
              })}
            </div>
          )}

          {/* Выпадающее меню для аллергенов */}
          {showAllergenFilter && (
            <div
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-1">
                {allAllergens.map((allergen) => {
                  const isSelected = selectedAllergens.includes(allergen);
                  return (
                    <button
                      key={allergen}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAllergens(selectedAllergens.filter(a => a !== allergen));
                        } else {
                          setSelectedAllergens([...selectedAllergens, allergen]);
                        }
                      }}
                      className={`text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 rounded-lg ${isSelected ? 'bg-primary/10 text-primary font-semibold' : ''
                        }`}
                    >
                      <span className={`material-symbols-outlined text-[14px] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="truncate text-xs">{allergen}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Выпадающее меню для тегов */}
          {showTagFilter && (
            <div
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-1">
                {allTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                      className={`text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 rounded-lg ${isSelected ? 'bg-primary/10 text-primary font-semibold' : ''
                        }`}
                    >
                      <span className={`material-symbols-outlined text-[14px] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="truncate text-xs">{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dishes Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-bold text-base dark:text-white">
            {showFavorites
              ? (language === 'EN' ? 'Favorite Dishes' : 'Избранные блюда')
              : (language === 'EN' ? 'All Dishes' : 'Все блюда')
            }
          </h3>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700">
            {filteredDishes.length}{' '}
            {language === 'EN'
              ? (mode === 'tea' ? 'tea' : (isBarMenu ? 'drinks' : 'dishes'))
              : (mode === 'tea' ? 'чаёв' : (isBarMenu ? 'напитков' : 'блюд'))}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {filteredDishes.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-[#896f61] dark:text-gray-400">
              {language === 'EN' ? 'No dishes found' : 'Блюда не найдены'}
            </div>
          ) : (
            filteredDishes.map((dish) => {
              const tags = getDishTags(dish);
              const imageUrl = getDishImageUrl(dish);
              const isArchived = dish.status === 'в архиве';
              if (mode === 'tea') {
                return (
                  <Link
                    key={dish.id}
                    to={getDetailPathForItem(dish)}
                    className="group relative rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-800 hover:border-primary/30 transition-all"
                  >
                    <div className={`flex flex-col h-full ${isArchived ? 'opacity-50 grayscale' : ''}`}>
                      <div className="relative w-full aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {imageUrl ? (
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                            style={{ backgroundImage: `url('${imageUrl}')` }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-400 text-4xl">emoji_food_beverage</span>
                          </div>
                        )}
                        {dish.i18n?.en?.['audio-en'] && language === 'EN' && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAudioPlay(dish);
                            }}
                            className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 shadow-lg z-10 active:scale-90 transition-transform"
                          >
                            <span className="material-symbols-outlined text-white text-[16px]">volume_up</span>
                          </button>
                        )}
                      </div>
                      <div className="p-2 flex flex-col flex-grow">
                        <h3 className="font-bold text-[11px] leading-[1.2] dark:text-white line-clamp-2 mb-1 group-hover:text-primary transition-colors duration-200">
                          {getFieldValue(dish, 'title') || (language === 'EN' ? 'No title' : 'Без названия')}
                        </h3>
                        {isFilled(getFieldValue(dish, 'section')) && (
                          <p className="text-[9px] text-primary/80 uppercase tracking-wide font-semibold mb-1">
                            {getFieldValue(dish, 'section')}
                          </p>
                        )}
                        <div className="mt-auto space-y-1.5 pt-1.5 border-t border-dashed border-gray-100 dark:border-gray-700">
                          {isFilled(dish.origin) && (
                            <p className="text-[9px] text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Страна:</span> {dish.origin}
                            </p>
                          )}
                          {isFilled(dish.caffeine) && (
                            <p className="text-[9px] text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Кофеин:</span> {dish.caffeine}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {isArchived && (
                      <div className="absolute top-2 right-2 bg-gray-700/90 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                        В АРХИВЕ
                      </div>
                    )}
                  </Link>
                );
              }

              const isWine = isWineItem(dish);
              const isBar = isBarItem(dish);
              const cardIngredients = parseCardIngredients(dish.cardIngredients);

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
                          className={`absolute inset-0 ${isBeer(dish) ? 'bg-contain bg-no-repeat' : 'bg-cover'} bg-center transition-transform duration-700 group-hover:scale-110`}
                          style={{ backgroundImage: `url('${imageUrl}')` }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400 text-4xl">restaurant</span>
                        </div>
                      )}

                      {dish.i18n?.en?.['audio-en'] && language === 'EN' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAudioPlay(dish);
                          }}
                          className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 shadow-lg z-10 active:scale-90 transition-transform"
                        >
                          <span className="material-symbols-outlined text-white text-[16px]">volume_up</span>
                        </button>
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
                      <h3 className="font-bold text-[11px] leading-[1.2] dark:text-white line-clamp-2 mb-1 group-hover:text-primary transition-colors duration-200">
                        {getFieldValue(dish, 'title') || (language === 'EN' ? 'No title' : 'Без названия')}
                      </h3>

                      {isBar ? (
                        cardIngredients.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {cardIngredients.map((item, idx) => (
                              <span
                                key={`${dish.id}-card-${idx}`}
                                className="text-[8px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )
                      ) : (
                        isWine &&
                        getFieldValue(dish, 'description') && (
                          <p className="text-[9px] text-[#896f61] dark:text-gray-400 line-clamp-2 mb-2 leading-tight opacity-90">
                            {getFieldValue(dish, 'description')}
                          </p>
                        )
                      )}

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
          className={`grid ${(() => {
            const showFooterMenu = isVisible({ scope: 'menuItem', target: 'footer.menu' });
            const showFooterFavorites = isVisible({ scope: 'menuItem', target: 'footer.favorites' });
            const showFooterSearch = isVisible({ scope: 'menuItem', target: 'footer.search' });
            const showFooterAdmin =
              isAuthenticated &&
              !isGuest &&
              currentUser?.role === 'администратор' &&
              isVisible({ scope: 'menuItem', target: 'footer.admin' });
            const itemCount =
              (showFooterMenu ? 1 : 0) +
              (showFooterFavorites ? 1 : 0) +
              (showFooterSearch ? 1 : 0) +
              (showFooterAdmin ? 1 : 0);
            return itemCount >= 4 ? 'grid-cols-4' : 'grid-cols-3';
          })()
            } px-6 items-center h-[60px]`}
        >
          {isVisible({ scope: 'menuItem', target: 'footer.menu' }) && (
            <Link to="/" className="flex flex-col items-center justify-center gap-1 text-primary">
              <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
              <span className="text-[10px] font-bold">{language === 'EN' ? 'Menu' : 'Меню'}</span>
            </Link>
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.favorites' }) && (
            <button
              onClick={() => {
                if (isGuest) return; // Гости не могут использовать избранное
                // Переключаем показ избранного (та же логика, что и на DishDetailPage.js)
                setShowFavorites(!showFavorites);
              }}
              disabled={isGuest}
              title={isGuest ? 'Доступно после входа' : (language === 'EN' ? 'Favorites' : 'Избранное')}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${isGuest
                ? 'opacity-50 cursor-not-allowed text-gray-400'
                : showFavorites || favorites.length > 0
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-[#181311] dark:hover:text-white'
                }`}
            >
              <span className={`material-symbols-outlined text-[24px] ${showFavorites || favorites.length > 0 ? 'fill-1' : ''}`}>
                {showFavorites || favorites.length > 0 ? 'favorite' : 'favorite_border'}
              </span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
            </button>
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
          {isAuthenticated &&
            currentUser?.role === 'администратор' &&
            isVisible({ scope: 'menuItem', target: 'footer.admin' }) && (
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

export default MenuPage;
