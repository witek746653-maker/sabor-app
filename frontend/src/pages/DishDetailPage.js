import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDish } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';
import './DishDetailPage.css';

function DishDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, isGuest, canWrite } = useAuth();
  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFeaturesExpanded, setIsFeaturesExpanded] = useState(false);
  const [isReferenceExpanded, setIsReferenceExpanded] = useState(false);
  const [language, setLanguage] = useState(() => {
    // Загружаем язык из localStorage или используем 'RU' по умолчанию
    return localStorage.getItem('menuLanguage') || 'RU';
  });
  const [favorites, setFavorites] = useState(() => {
    // Загружаем избранное из localStorage
    const saved = localStorage.getItem('favoriteDishes');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const searchRefs = useRef({});

  // Проверяем, находится ли блюдо в избранном
  const isFavorite = dish && favorites.includes(dish.id);

  // Функция для переключения избранного
  const toggleFavorite = () => {
    if (!dish || isGuest) return; // Гости не могут добавлять в избранное
    const newFavorites = isFavorite
      ? favorites.filter(id => id !== dish.id)
      : [...favorites, dish.id];
    setFavorites(newFavorites);
    localStorage.setItem('favoriteDishes', JSON.stringify(newFavorites));
  };

  // Функция для отправки в мессенджеры (изначальная версия с Web Share API + копирование)
  const handleShare = async () => {
    if (!dish) return;

    const dishTitle = getFieldValue('title');
    const dishDescription = normalizeNewlines(getFieldValue('description'));
    const shareText = `${dishTitle}\n\n${dishDescription}\n\n${window.location.href}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: dishTitle,
          text: dishDescription,
          url: window.location.href,
        });
      } catch (err) {
        // Пользователь отменил или произошла ошибка
        console.log('Ошибка отправки:', err);
      }
    } else {
      // Fallback: копируем в буфер обмена
      try {
        await navigator.clipboard.writeText(shareText);
        alert(language === 'EN' ? 'Link copied to clipboard!' : 'Ссылка скопирована в буфер обмена!');
      } catch (err) {
        // Если не поддерживается, показываем текст для копирования
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(language === 'EN' ? 'Link copied to clipboard!' : 'Ссылка скопирована в буфер обмена!');
      }
    }
  };

  // Функция для получения значения поля в зависимости от языка
  const getFieldValue = (fieldName) => {
    if (!dish) return '';
    if (language === 'EN' && dish.i18n?.en) {
      const enField = `${fieldName}-en`;
      return dish.i18n.en[enField] || dish[fieldName] || '';
    }
    return dish[fieldName] || '';
  };

  // Термин **\\n**: это “текстовый перенос строки” (два символа: обратный слэш и n).
  // Иногда он попадает в JSON как "\\n". Здесь мы превращаем его в настоящий перенос строки "\n".
  function normalizeNewlines(v) {
    const s = String(v ?? '')
      .replace(/\r\n/g, '\n') // Windows-переносы
      .replace(/\\n/g, '\n'); // текстовые "\n"

    // 1) Сжимаем любые двойные переносы до одного (чтобы не было “пустых строк”)
    // 2) Убираем переносы прямо перед/после блочных HTML-тегов, чтобы список не “отъезжал” вниз
    return s
      .replace(/\n{2,}/g, '\n')
      .replace(/\n\s*(<(?:ol|ul|p|div|h[1-6])\b)/gi, '$1')
      .replace(/(<\/(?:ol|ul|p|div|h[1-6])>)\s*\n/gi, '$1')
      .trim();
  }

  // Функция для получения тегов в зависимости от языка
  const getTagsForLanguage = () => {
    if (!dish) return [];
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
  const getAllergensForLanguage = () => {
    if (!dish) return [];
    if (language === 'EN' && dish.i18n?.en?.['allergens-en']) {
      const allergensEn = dish.i18n.en['allergens-en'];
      if (typeof allergensEn === 'string') {
        return allergensEn.split(',').map(a => a.trim()).filter(Boolean);
      }
      return Array.isArray(allergensEn) ? allergensEn : [];
    }
    return dish.allergens || [];
  };

  // Функция для подсветки текста при поиске
  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">{part}</mark>
      ) : part
    );
  };

  useEffect(() => {
    const loadDish = async () => {
      try {
        const data = await getDish(id);
        setDish(data);
        setIsFeaturesExpanded(false); // Сбрасываем состояние развернутости при загрузке нового блюда
        
        // Проверяем, есть ли запрос из глобального поиска
        const globalSearchQuery = sessionStorage.getItem('globalSearchQuery');
        const globalSearchField = sessionStorage.getItem('globalSearchField');
        const globalSearchDishId = sessionStorage.getItem('globalSearchDishId');
        
        if (globalSearchQuery && globalSearchDishId === id) {
          // Устанавливаем поисковый запрос для подсветки
          setSearchQuery(globalSearchQuery);
          
          // Очищаем sessionStorage после использования
          setTimeout(() => {
            sessionStorage.removeItem('globalSearchQuery');
            sessionStorage.removeItem('globalSearchField');
            sessionStorage.removeItem('globalSearchDishId');
          }, 3000); // Убираем подсветку через 3 секунды
        }
      } catch (error) {
        console.error('Ошибка загрузки блюда:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDish();
  }, [id]);

  // Функция для поиска и прокрутки к найденному тексту
  useEffect(() => {
    if (!searchQuery || !dish) return;
    
    const query = searchQuery.toLowerCase();
    const allText = [
      getFieldValue('title'),
      getFieldValue('description'),
      getFieldValue('section'),
      dish.features || '',
      getFieldValue('contains'),
      ...(dish.ingredients || []),
      ...(dish.comments || []),
      dish.reference_info || ''
    ].join(' ').toLowerCase();

    if (allText.includes(query)) {
      // Находим первый элемент с совпадением и прокручиваем к нему
      const firstMatch = Object.keys(searchRefs.current).find(key => {
        const element = searchRefs.current[key];
        if (element) {
          const text = element.textContent?.toLowerCase() || '';
          return text.includes(query);
        }
        return false;
      });

      if (firstMatch && searchRefs.current[firstMatch]) {
        setTimeout(() => {
          searchRefs.current[firstMatch].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Временная подсветка элемента (исчезает при следующем действии)
          const element = searchRefs.current[firstMatch];
          element.classList.add('search-highlight-temporary');
          setTimeout(() => {
            element.classList.remove('search-highlight-temporary');
          }, 2000);
        }, 300);
      }
    }
  }, [searchQuery, dish, language]);

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">{language === 'EN' ? 'Loading...' : 'Загрузка...'}</div>
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-red-500 text-lg font-bold mb-4">{language === 'EN' ? 'Dish not found' : 'Блюдо не найдено'}</div>
          <Link to="/" className="text-primary hover:underline">{language === 'EN' ? 'Return to home' : 'Вернуться на главную'}</Link>
        </div>
      </div>
    );
  }

  const imageUrl = getDishImageUrl(dish);
  const isArchived = dish.status === 'в архиве';

  // Нормализация текста аллергена
  const normalizeAllergen = (value) => (value || '').toString().trim().toLowerCase();

  // Карта аллергенов → эмодзи и подпись (похожа на waiter-database.html)
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

  // Получаем объект с картинкой и подписью по названию аллергена
  const getAllergenDisplay = (raw) => {
    const normalized = normalizeAllergen(raw);
    if (ALLERGEN_EMOJI_MAP[normalized]) {
      return ALLERGEN_EMOJI_MAP[normalized];
    }

    // Пробуем найти подстроку (например, "яйца" внутри длинной строки)
    const matchEntry = Object.entries(ALLERGEN_EMOJI_MAP).find(([key]) =>
      normalized.includes(key)
    );
    if (matchEntry) {
      return matchEntry[1];
    }

    // Фолбэк: общий значок с исходным текстом
    return { icon: '⚠️', label: raw || 'Аллерген' };
  };

  return (
    <div className="relative z-20 min-h-[100dvh] overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Top Navigation */}
      <div className="fixed top-0 p-4 pt-12 flex justify-between items-center z-50 sabor-fixed">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 transition-all active:scale-95 group"
        >
          <span className="material-symbols-outlined text-white group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              const newLanguage = language === 'RU' ? 'EN' : 'RU';
              setLanguage(newLanguage);
              localStorage.setItem('menuLanguage', newLanguage);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 transition-all active:scale-95 text-white"
          >
            <span className="text-xs font-bold">{language === 'RU' ? 'EN' : 'RU'}</span>
          </button>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'EN' ? 'Search...' : 'Поиск...'}
              className="h-10 px-4 pr-10 rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/60 text-sm w-40"
            />
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white text-[18px] pointer-events-none">
              search
            </span>
          </div>
          <button 
            onClick={handleShare}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-white">ios_share</span>
          </button>
          <button 
            onClick={toggleFavorite}
            disabled={isGuest}
            title={isGuest ? 'Доступно после входа' : (isFavorite ? 'Удалить из избранного' : 'Добавить в избранное')}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 transition-all ${
              isGuest 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 active:scale-95 cursor-pointer'
            } ${
              isFavorite ? 'text-primary' : 'text-white'
            }`}
          >
            <span className={`material-symbols-outlined ${isFavorite ? 'fill-1' : ''}`}>favorite</span>
          </button>
        </div>
      </div>

      {/* Swipe Indicator */}
      <div className="w-full flex justify-center pt-3 pb-2">
        <div className="h-1.5 w-12 rounded-full bg-gray-300/80 dark:bg-gray-700/80"></div>
      </div>

      {/* Image */}
      <div 
        className="w-full h-[280px] sm:h-[350px] overflow-hidden relative -mt-4 mb-4 cursor-pointer"
        onClick={() => setIsImageExpanded(true)}
      >
        {imageUrl ? (
          <img
            alt={dish.image?.alt || dish.title}
            className="h-full w-full object-cover"
            src={imageUrl}
          />
        ) : (
          <div className="h-full w-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-gray-400 text-6xl">restaurant</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-2">
          <span className="material-symbols-outlined text-white text-[20px]">zoom_in</span>
        </div>
      </div>

      {/* Модальное окно для увеличенного изображения */}
      {isImageExpanded && imageUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsImageExpanded(false)}
        >
          <button
            onClick={() => setIsImageExpanded(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
          >
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          <img
            alt={dish.image?.alt || dish.title}
            className="max-w-full max-h-full object-contain"
            src={imageUrl}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Content */}
      <div className="px-5 pt-1 pb-24">
        {/* Плашка архива */}
        {isArchived && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-800 text-white px-3 py-1 text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">archive</span>
            В АРХИВЕ
          </div>
        )}

        {/* Затемняем контент, если позиция в архиве */}
        <div className={isArchived ? 'opacity-60' : ''}>
          {/* 1. Название */}
          <h1 
            ref={(el) => { if (el) searchRefs.current['title'] = el; }}
            className="text-[28px] font-bold leading-tight text-gray-900 dark:text-white mb-3"
          >
            {searchQuery ? highlightText(getFieldValue('title') || (language === 'EN' ? 'No title' : 'Без названия'), searchQuery) : (getFieldValue('title') || (language === 'EN' ? 'No title' : 'Без названия'))}
          </h1>

          {/* Section (сразу после названия) */}
          {getFieldValue('section') && (
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-3 py-1">
                <span className="text-primary text-xs font-semibold uppercase tracking-wide">{getFieldValue('section')}</span>
              </div>
            </div>
          )}

        {/* 2. Красочное описание */}
        {getFieldValue('description') && (
          <div 
            ref={(el) => { if (el) searchRefs.current['description'] = el; }}
            className="mb-8"
          >
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 opacity-80">
              {language === 'EN' ? 'Description' : 'Красочное описание'}
            </h2>
            {/* Термин **dangerouslySetInnerHTML**: вставить HTML “как есть” (нужно для <ol><li>...</li></ol>). */}
            {/* ВАЖНО: если HTML приходит от пользователей, это риск **XSS** (вредный HTML/скрипты). */}
            <div
              className="text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed whitespace-pre-line contains-list"
              dangerouslySetInnerHTML={{
                __html: searchQuery
                  ? normalizeNewlines(getFieldValue('description')).replace(
                      new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                      '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                    )
                  : normalizeNewlines(getFieldValue('description')),
              }}
            />
          </div>
        )}

        {/* 3. Аллергены и особенности */}
        {(() => {
          const allergens = getAllergensForLanguage();
          const hasAllergens = allergens && allergens.length > 0;
          const hasFeatures = dish.features;
          const hasBoth = hasAllergens && hasFeatures;
          
          if (!hasAllergens && !hasFeatures) return null;
          
          // Если есть только один блок, используем grid-cols-1 (на всю ширину)
          // Если оба блока, используем grid-cols-2
          return (
            <div className={`grid ${hasBoth ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mb-8 ${hasBoth ? 'items-stretch' : ''}`}>
              {/* Блок аллергенов */}
              {hasAllergens && (
                <div 
                  ref={(el) => { if (el) searchRefs.current['allergens'] = el; }}
                  className="allergens-features-card allergens-card bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-5 rounded-xl shadow-md border-2 border-red-200 dark:border-red-800/50 hover:border-red-300 dark:hover:border-red-700 transition-all duration-300 hover:shadow-xl flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-semibold">
                    <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 animate-pulse-slow">
                      <span className="material-symbols-outlined text-[18px] block">warning</span>
                    </div>
                    <span className="text-base">{language === 'EN' ? 'Allergens' : 'Аллергены'}</span>
                  </div>
                  <div className="flex-1 flex items-start pt-1">
                    <div className="flex flex-wrap gap-2 w-full">
                      {allergens.map((allergen, idx) => {
                        const { icon, label } = getAllergenDisplay(allergen);
                        return (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-800/60 shadow-sm text-[12px] font-semibold tracking-wide uppercase text-amber-800 dark:text-amber-200"
                          >
                            <span className="text-base leading-none">
                              {icon}
                            </span>
                            <span className="leading-tight">
                              {searchQuery ? highlightText(label, searchQuery) : label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Блок особенностей */}
              {hasFeatures && (() => {
                // Убираем HTML теги для подсчета длины текста
                const textContent = dish.features.replace(/<[^>]*>/g, '').trim();
                // Если текст длиннее 100 символов, считаем его длинным
                const needsTruncation = textContent.length > 100;
                
                return (
                  <div 
                    ref={(el) => { if (el) searchRefs.current['features'] = el; }}
                    className="allergens-features-card features-card bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-5 rounded-xl shadow-md border-2 border-purple-200 dark:border-purple-800/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300 hover:shadow-xl flex flex-col"
                  >
                    <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-semibold">
                      <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 animate-pulse-slow">
                        <span className="material-symbols-outlined text-[18px] block">grade</span>
                      </div>
                      <span className="text-base">{language === 'EN' ? 'Features' : 'Особенности'}</span>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div 
                        className={`text-gray-700 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-line transition-all duration-300 ${!isFeaturesExpanded && needsTruncation ? 'features-text-collapsed' : ''}`}
                        dangerouslySetInnerHTML={{ 
                          __html: searchQuery 
                            ? normalizeNewlines(dish.features).replace(
                                new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                                '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                              )
                            : normalizeNewlines(dish.features)
                        }}
                      />
                      {needsTruncation && (
                        <button
                          onClick={() => setIsFeaturesExpanded(!isFeaturesExpanded)}
                          className="mt-3 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-xs font-semibold flex items-center gap-1 self-start transition-colors group"
                        >
                          <span>{isFeaturesExpanded ? (language === 'EN' ? 'Collapse' : 'Свернуть') : (language === 'EN' ? 'Expand' : 'Развернуть')}</span>
                          <span className={`material-symbols-outlined text-[16px] transition-transform duration-300 ${isFeaturesExpanded ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* 4. Состав блюда */}
        {(dish.ingredients && dish.ingredients.length > 0) || dish.contains ? (
          <div 
            ref={(el) => { if (el) searchRefs.current['composition'] = el; }}
            className="grid grid-cols-1 gap-4 mb-4"
          >
            <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-xl border border-primary/20 dark:border-primary/30 shadow-md">
              <h3 className="flex items-center gap-2 mb-3 text-gray-900 dark:text-white font-bold text-lg">
                <div className="p-1.5 rounded-full bg-primary/20 dark:bg-primary/30 text-primary">
                  <span className="material-symbols-outlined text-[20px] block">menu_book</span>
                </div>
                {language === 'EN' ? 'Dish Composition' : 'Состав блюда'}
              </h3>
              <div className="max-h-96 overflow-y-auto no-scrollbar pr-2 -mr-2">
                {/* Ингредиенты */}
                {dish.ingredients && dish.ingredients.length > 0 && (
                  <div className="mb-5">
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">{language === 'EN' ? 'Ingredients:' : 'Ингредиенты:'}</h4>
                    <ul className="flex flex-wrap gap-2">
                      {dish.ingredients.map((ingredient, idx) => (
                        <li
                          key={idx}
                          className="text-sm bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-md text-gray-800 dark:text-gray-100 font-medium"
                        >
                          {searchQuery ? highlightText(ingredient, searchQuery) : ingredient}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Приготовление */}
                {dish.contains && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">{language === 'EN' ? 'Preparation:' : 'Приготовление:'}</h4>
                    <div 
                      className="text-gray-700 dark:text-gray-200 text-base leading-relaxed max-w-none contains-list whitespace-pre-line"
                      dangerouslySetInnerHTML={{ 
                        __html: searchQuery 
                          ? normalizeNewlines(getFieldValue('contains')).replace(
                              new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                              '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                            )
                          : normalizeNewlines(getFieldValue('contains'))
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Комментарии */}
        {dish.comments && dish.comments.length > 0 && (
          <div 
            ref={(el) => { if (el) searchRefs.current['comments'] = el; }}
            className="mb-8"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border-2 border-blue-200 dark:border-blue-800/50 shadow-md hover:shadow-lg transition-shadow">
              <h3 className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-bold text-lg">
                <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <span className="material-symbols-outlined text-[20px] block">info</span>
                </div>
                {language === 'EN' ? 'Comments' : 'Комментарии'}
              </h3>
              <ul className="space-y-3">
                {(language === 'EN' && dish.i18n?.en?.['comments-en'] 
                  ? (Array.isArray(dish.i18n.en['comments-en']) ? dish.i18n.en['comments-en'] : [dish.i18n.en['comments-en']].filter(Boolean))
                  : (dish.comments || [])
                ).map((comment, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] fill-1">fiber_manual_record</span>
                    </span>
                    <div 
                      className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed flex-1"
                      dangerouslySetInnerHTML={{ 
                        __html: searchQuery 
                          ? comment.replace(
                              new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                              '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                            )
                          : comment
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Reference Info - перед тегами */}
        {getFieldValue('reference_info') && String(getFieldValue('reference_info')).trim() && (
          <div 
            ref={(el) => { if (el) searchRefs.current['reference'] = el; }}
            className="mb-4"
          >
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-5 rounded-xl border-2 border-green-200 dark:border-green-800/50 shadow-md hover:shadow-lg transition-shadow">
              <button
                onClick={() => setIsReferenceExpanded(!isReferenceExpanded)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2 mb-3 text-gray-900 dark:text-white font-bold text-lg">
                  <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined text-[20px] block">lightbulb</span>
                  </div>
                  <span className="flex-1">{language === 'EN' ? 'Reference Information' : 'Справочная информация'}</span>
                  <span className={`material-symbols-outlined text-green-600 dark:text-green-400 transition-transform duration-300 ${isReferenceExpanded ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>
              </button>
              <div 
                className={`text-gray-700 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-line transition-all duration-300 overflow-hidden contains-list ${
                  !isReferenceExpanded ? 'max-h-20' : 'max-h-none'
                }`}
                dangerouslySetInnerHTML={{ 
                  __html: searchQuery 
                    ? normalizeNewlines(getFieldValue('reference_info')).replace(
                        new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                        '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                      )
                    : normalizeNewlines(getFieldValue('reference_info'))
                }}
              />
            </div>
          </div>
        )}

          {/* 5. Тэги (в самом конце) */}
          {getTagsForLanguage().length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {getTagsForLanguage().map((tag, idx) => {
            const tagLower = tag.toLowerCase();
            
            // Красные теги (критические): сырой, острый, долгое ожидание, свинина, на кости
            if (tagLower.includes('остр') || tagLower.includes('spicy') || 
                tagLower.includes('сыр') || tagLower.includes('raw') ||
                tagLower.includes('долг') || tagLower.includes('long wait') ||
                tagLower.includes('ожидан') || tagLower.includes('wait') ||
                tagLower.includes('свинин') || tagLower.includes('pork') ||
                tagLower.includes('на кост') || tagLower.includes('bone')) {
              return (
                <div key={idx} className="flex items-center justify-center gap-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 px-3 py-1">
                  <span className="material-symbols-outlined text-[14px] text-red-600 dark:text-red-400">
                    {tagLower.includes('остр') || tagLower.includes('spicy') ? 'local_fire_department' : 
                     tagLower.includes('сыр') || tagLower.includes('raw') ? 'warning' : 
                     tagLower.includes('долг') || tagLower.includes('wait') ? 'schedule' : 'restaurant'}
                  </span>
                  <span className="text-red-700 dark:text-red-300 text-xs font-medium">{tag}</span>
                </div>
              );
            }
            
            // Синие теги: морепродукты, рыба
            if (tagLower.includes('морепродукт') || tagLower.includes('seafood') ||
                tagLower.includes('рыб') || tagLower.includes('fish')) {
              return (
                <div key={idx} className="flex items-center justify-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 px-3 py-1">
                  <span className="material-symbols-outlined text-[14px] text-blue-600 dark:text-blue-400">set_meal</span>
                  <span className="text-blue-700 dark:text-blue-300 text-xs font-medium">{tag}</span>
                </div>
              );
            }
            
            // Оранжевые теги: курица, утка, говядина, баранина
            if (tagLower.includes('куриц') || tagLower.includes('chicken') ||
                tagLower.includes('утк') || tagLower.includes('duck') ||
                tagLower.includes('говядин') || tagLower.includes('beef') ||
                tagLower.includes('баранин') || tagLower.includes('lamb') ||
                tagLower.includes('ягнен') || tagLower.includes('mutton')) {
              return (
                <div key={idx} className="flex items-center justify-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 px-3 py-1">
                  <span className="material-symbols-outlined text-[14px] text-orange-600 dark:text-orange-400">restaurant</span>
                  <span className="text-orange-700 dark:text-orange-300 text-xs font-medium">{tag}</span>
                </div>
              );
            }
            
            // Коричневые теги: сытное блюдо
            if (tagLower.includes('сытн') || tagLower.includes('hearty') ||
                tagLower.includes('плотн') || tagLower.includes('substantial')) {
              return (
                <div key={idx} className="flex items-center justify-center gap-1 rounded-full bg-amber-700/10 dark:bg-amber-900/30 border border-amber-700/30 dark:border-amber-800/30 px-3 py-1">
                  <span className="material-symbols-outlined text-[14px] text-amber-800 dark:text-amber-400">lunch_dining</span>
                  <span className="text-amber-800 dark:text-amber-300 text-xs font-medium">{tag}</span>
                </div>
              );
            }
            
            // Серые теги: к вину, на компанию, к пиву, к водке
            if (tagLower.includes('к вин') || tagLower.includes('with wine') ||
                tagLower.includes('на компани') || tagLower.includes('to share') ||
                tagLower.includes('к пив') || tagLower.includes('with beer') ||
                tagLower.includes('к водк') || tagLower.includes('with vodka')) {
              return (
                <div key={idx} className="flex items-center justify-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 px-3 py-1">
                  <span className="material-symbols-outlined text-[14px] text-gray-600 dark:text-gray-400">wine_bar</span>
                  <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">{tag}</span>
                </div>
              );
            }
            
            // Зеленые теги: веганское, вегетарианское, легкое блюдо, низкоуглеводное
            if (tagLower.includes('веган') || tagLower.includes('vegan') ||
                tagLower.includes('вегетариан') || tagLower.includes('vegetarian') ||
                tagLower.includes('легк') || tagLower.includes('light dish') ||
                tagLower.includes('низкоуглевод') || tagLower.includes('low carb')) {
              return (
                <div key={idx} className="flex items-center justify-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800/30 px-3 py-1">
                  <span className="material-symbols-outlined text-[14px] text-green-700 dark:text-green-400">
                    {tagLower.includes('веган') || tagLower.includes('vegan') || 
                     tagLower.includes('вегетариан') || tagLower.includes('vegetarian') ? 'eco' : 
                     tagLower.includes('легк') || tagLower.includes('light') ? 'spa' : 'fitness_center'}
                  </span>
                  <span className="text-green-700 dark:text-green-400 text-xs font-medium">{tag}</span>
                </div>
              );
            }
            
            // Желтые теги: без какого-то ингредиента
            if (tagLower.includes('без ') || tagLower.includes('free') || 
                tagLower.includes('-free')) {
              return (
                <div key={idx} className="flex items-center justify-center gap-1 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 px-3 py-1">
                  <span className="material-symbols-outlined text-[14px] text-yellow-600 dark:text-yellow-400">check_circle</span>
                  <span className="text-yellow-700 dark:text-yellow-300 text-xs font-medium">{tag}</span>
                </div>
              );
            }
            
            // Остальные теги без цвета
            return (
              <div key={idx} className="flex items-center justify-center rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1">
                <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">{tag}</span>
              </div>
            );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 z-50 w-full sabor-fixed bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
        <div className={`grid ${isAuthenticated && currentUser?.role === 'администратор' ? 'grid-cols-4' : 'grid-cols-3'} px-6 items-center h-[60px]`}>
          <Link to="/" className="flex flex-col items-center justify-center gap-1 text-primary">
            <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
            <span className="text-[10px] font-bold">{language === 'EN' ? 'Menu' : 'Меню'}</span>
          </Link>
          <button 
            onClick={() => {
              if (isGuest) return; // Гости не могут использовать избранное
              const saved = localStorage.getItem('favoriteDishes');
              const favoriteIds = saved ? JSON.parse(saved) : [];
              if (favoriteIds.length > 0 && dish) {
                // Навигация к меню с фильтром избранного
                navigate(`/menu/${encodeURIComponent(dish.menu || '')}?favorites=true`);
              }
            }}
            disabled={isGuest}
            title={isGuest ? 'Доступно после входа' : (language === 'EN' ? 'Favorites' : 'Избранное')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              isGuest 
                ? 'opacity-50 cursor-not-allowed text-gray-400' 
                : isFavorite 
                  ? 'text-primary' 
                  : 'text-gray-400 hover:text-[#181311] dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">{isFavorite ? 'favorite' : 'favorite_border'}</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
          </button>
          <button 
            onClick={() => {
              // Прокручиваем к началу страницы или можно добавить поиск
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">search</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Search' : 'Поиск'}</span>
          </button>
          {isAuthenticated && !isGuest && currentUser?.role === 'администратор' && (
            <Link
              to="/admin"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">person</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Admin' : 'Админ-панель'}</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}

export default DishDetailPage;
