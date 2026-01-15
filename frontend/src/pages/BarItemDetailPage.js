import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDish } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';
import './DishDetailPage.css';

const isNonEmpty = (v) => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.filter(Boolean).length > 0;
  return Boolean(String(v).trim());
};

// Термин **fallback**: “запасной вариант”, если основное поле пустое.
const parseCardIngredients = (cardIngredients, fallbackIngredients) => {
  if (typeof cardIngredients === 'string' && cardIngredients.trim()) {
    return cardIngredients
      .split('/')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (Array.isArray(fallbackIngredients)) return fallbackIngredients.filter(Boolean);
  return [];
};

function BarItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGuest } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => localStorage.getItem('menuLanguage') || 'RU');
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favoriteDishes');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const searchRefs = useRef({});

  const isFavorite = item && favorites.includes(item.id);
  const isArchived = item?.status === 'в архиве';

  const getFieldValue = (fieldName) => {
    if (!item) return '';
    if (language === 'EN' && item.i18n?.en) {
      const enField = `${fieldName}-en`;
      return item.i18n.en[enField] || item[fieldName] || '';
    }
    return item[fieldName] || '';
  };

  // Термин **\\n**: это “текстовый перенос строки” (два символа: обратный слэш и n).
  // Иногда он попадает в JSON как "\\n". Здесь мы превращаем его в настоящий перенос строки "\n".
  function normalizeNewlines(v) {
    const s = String(v ?? '')
      .replace(/\r\n/g, '\n') // Windows-переносы
      .replace(/\\n/g, '\n'); // текстовые "\n"

    return s
      .replace(/\n{2,}/g, '\n')
      .replace(/\n\s*(<(?:ol|ul|p|div|h[1-6])\b)/gi, '$1')
      .replace(/(<\/(?:ol|ul|p|div|h[1-6])>)\s*\n/gi, '$1')
      .trim();
  }

  const getTagsForLanguage = () => {
    if (!item) return [];
    if (language === 'EN' && item.i18n?.en?.['tags-en']) {
      const tagsEn = item.i18n.en['tags-en'];
      if (typeof tagsEn === 'string') {
        return tagsEn.split(',').map((t) => t.trim()).filter(Boolean);
      }
      return Array.isArray(tagsEn) ? tagsEn : [];
    }
    return Array.isArray(item.tags) ? item.tags : [];
  };

  const getAllergensForLanguage = () => {
    if (!item) return [];
    if (language === 'EN' && item.i18n?.en?.['allergens-en']) {
      const allergensEn = item.i18n.en['allergens-en'];
      if (typeof allergensEn === 'string') {
        return allergensEn.split(',').map((a) => a.trim()).filter(Boolean);
      }
      return Array.isArray(allergensEn) ? allergensEn : [];
    }
    if (typeof item.allergens === 'string' && item.allergens.trim()) {
      return item.allergens.split(',').map((a) => a.trim()).filter(Boolean);
    }
    return Array.isArray(item.allergens) ? item.allergens : [];
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const toggleFavorite = () => {
    if (!item || isGuest) return;
    const newFavorites = isFavorite ? favorites.filter((fid) => fid !== item.id) : [...favorites, item.id];
    setFavorites(newFavorites);
    localStorage.setItem('favoriteDishes', JSON.stringify(newFavorites));
  };

  const handleShare = async () => {
    if (!item) return;
    const title = getFieldValue('title') || (language === 'EN' ? 'Drink' : 'Напиток');
    const description = normalizeNewlines(getFieldValue('description') || '');
    const shareText = `${title}\n\n${description}\n\n${window.location.href}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url: window.location.href });
      } catch (err) {
        console.log('Ошибка отправки:', err);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      alert(language === 'EN' ? 'Link copied to clipboard!' : 'Ссылка скопирована в буфер обмена!');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(language === 'EN' ? 'Link copied to clipboard!' : 'Ссылка скопирована в буфер обмена!');
    }
  };

  useEffect(() => {
    const loadItem = async () => {
      try {
        setLoading(true);
        // Барные позиции сейчас хранятся в общей базе, поэтому берём через getDish(id)
        const data = await getDish(id);
        setItem(data);

        // Подсветка из глобального поиска
        const globalSearchQuery = sessionStorage.getItem('globalSearchQuery');
        const globalSearchDishId = sessionStorage.getItem('globalSearchDishId');
        if (globalSearchQuery && String(globalSearchDishId) === String(id)) {
          setSearchQuery(globalSearchQuery);
          setTimeout(() => {
            sessionStorage.removeItem('globalSearchQuery');
            sessionStorage.removeItem('globalSearchField');
            sessionStorage.removeItem('globalSearchDishId');
            sessionStorage.removeItem('globalSearchType');
          }, 3000);
        }
      } catch (error) {
        console.error('Ошибка загрузки барной позиции:', error);
        setItem(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadItem();
  }, [id]);

  // Скроллим к первому совпадению текста
  useEffect(() => {
    if (!searchQuery || !item) return;
    const query = searchQuery.toLowerCase();
    const allText = [
      getFieldValue('title'),
      getFieldValue('description'),
      getFieldValue('section'),
      item.cardIngredients || '',
      item.contains || '',
      item.features || '',
      item.reference_info || '',
      Array.isArray(item.ingredients) ? item.ingredients.join(' ') : '',
      Array.isArray(item.comments) ? item.comments.join(' ') : (item.comments || ''),
      Array.isArray(item.tags) ? item.tags.join(' ') : '',
      Array.isArray(item.allergens) ? item.allergens.join(' ') : (item.allergens || ''),
    ]
      .join(' ')
      .toLowerCase();

    if (!allText.includes(query)) return;

    const firstMatchKey = Object.keys(searchRefs.current).find((key) => {
      const el = searchRefs.current[key];
      const text = el?.textContent?.toLowerCase() || '';
      return text.includes(query);
    });

    if (firstMatchKey && searchRefs.current[firstMatchKey]) {
      setTimeout(() => {
        searchRefs.current[firstMatchKey].scrollIntoView({ behavior: 'smooth', block: 'center' });
        const el = searchRefs.current[firstMatchKey];
        el.classList.add('search-highlight-temporary');
        setTimeout(() => el.classList.remove('search-highlight-temporary'), 2000);
      }, 250);
    }
  }, [searchQuery, item, language]);

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">{language === 'EN' ? 'Loading...' : 'Загрузка...'}</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-red-500 text-lg font-bold mb-4">{language === 'EN' ? 'Item not found' : 'Позиция не найдена'}</div>
          <Link to="/" className="text-primary hover:underline">
            {language === 'EN' ? 'Return to home' : 'Вернуться на главную'}
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = getDishImageUrl(item);
  const allergens = getAllergensForLanguage();
  const tags = getTagsForLanguage();
  const cardIngredients = parseCardIngredients(item.cardIngredients, item.ingredients);
  const ingredients = Array.isArray(item.ingredients) ? item.ingredients.filter(Boolean) : [];
  const comments = Array.isArray(item.comments) ? item.comments.filter(Boolean) : (item.comments ? [item.comments] : []);

  return (
    <div className="relative z-20 min-h-[100dvh] overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Верхняя панель */}
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
            title={isGuest ? 'Доступно после входа' : isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 transition-all ${
              isGuest ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 active:scale-95 cursor-pointer'
            } ${isFavorite ? 'text-primary' : 'text-white'}`}
          >
            <span className={`material-symbols-outlined ${isFavorite ? 'fill-1' : ''}`}>favorite</span>
          </button>
        </div>
      </div>

      {/* Индикатор свайпа */}
      <div className="w-full flex justify-center pt-3 pb-2">
        <div className="h-1.5 w-12 rounded-full bg-gray-300/80 dark:bg-gray-700/80"></div>
      </div>

      {/* Изображение */}
      <div className="w-full h-[280px] sm:h-[350px] overflow-hidden relative -mt-4 mb-4 cursor-pointer" onClick={() => setIsImageExpanded(true)}>
        {imageUrl ? (
          <img alt={item.image?.alt || item.title} className="h-full w-full object-cover" src={imageUrl} />
        ) : (
          <div className="h-full w-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-gray-400 text-6xl">local_bar</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-2">
          <span className="material-symbols-outlined text-white text-[20px]">zoom_in</span>
        </div>
      </div>

      {/* Модалка увеличенного изображения */}
      {isImageExpanded && imageUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setIsImageExpanded(false)}>
          <button onClick={() => setIsImageExpanded(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10">
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          <img
            alt={item.image?.alt || item.title}
            className="max-w-full max-h-full object-contain"
            src={imageUrl}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Контент */}
      <div className="px-5 pt-1 pb-24">
        {isArchived && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-800 text-white px-3 py-1 text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">archive</span>
            В АРХИВЕ
          </div>
        )}

        <div className={isArchived ? 'opacity-60' : ''}>
          <h1
            ref={(el) => {
              if (el) searchRefs.current['title'] = el;
            }}
            className="text-[28px] font-bold leading-tight text-gray-900 dark:text-white mb-3"
          >
            {searchQuery ? highlightText(getFieldValue('title') || 'Без названия', searchQuery) : getFieldValue('title') || 'Без названия'}
          </h1>

          {getFieldValue('section') && (
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-3 py-1">
                <span className="text-primary text-xs font-semibold uppercase tracking-wide">{getFieldValue('section')}</span>
              </div>
            </div>
          )}

          {getFieldValue('description') && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['description'] = el;
              }}
              className="mb-8"
            >
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 opacity-80">
                {language === 'EN' ? 'Description' : 'Описание'}
              </h2>
              {/* Термин **dangerouslySetInnerHTML**: вставить HTML “как есть” (нужно для списков <ol>/<ul>). */}
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

          {/* Короткий состав для карточки (cardIngredients) */}
          {cardIngredients.length > 0 && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['cardIngredients'] = el;
              }}
              className="mb-8"
            >
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 opacity-80">
                {language === 'EN' ? 'Main ingredients' : 'Главные ингредиенты'}
              </h2>
              <div className="flex flex-wrap gap-2">
                {cardIngredients.map((ing, idx) => (
                  <span key={idx} className="text-sm bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-md text-gray-800 dark:text-gray-100 font-medium">
                    {searchQuery ? highlightText(ing, searchQuery) : ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Подробный состав (ingredients) */}
          {ingredients.length > 0 && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['ingredients'] = el;
              }}
              className="mb-8"
            >
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 opacity-80">
                {language === 'EN' ? 'Ingredients' : 'Ингредиенты'}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {ingredients.map((ing, idx) => (
                  <li key={idx} className="text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-md text-gray-800 dark:text-gray-100 font-medium">
                    {searchQuery ? highlightText(ing, searchQuery) : ing}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contains (часто длинный текст/HTML) */}
          {isNonEmpty(getFieldValue('contains')) && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['contains'] = el;
              }}
              className="mb-4"
            >
              <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-xl border border-primary/20 dark:border-primary/30 shadow-md">
                <h3 className="flex items-center gap-2 mb-3 text-gray-900 dark:text-white font-bold text-lg">
                  <div className="p-1.5 rounded-full bg-primary/20 dark:bg-primary/30 text-primary">
                    <span className="material-symbols-outlined text-[20px] block">menu_book</span>
                  </div>
                  {language === 'EN' ? 'Composition' : 'Состав'}
                </h3>
                <div
                  className="text-gray-700 dark:text-gray-200 text-base leading-relaxed max-w-none contains-list whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: searchQuery
                      ? normalizeNewlines(getFieldValue('contains')).replace(
                          new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                          '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                        )
                      : normalizeNewlines(getFieldValue('contains')),
                  }}
                />
              </div>
            </div>
          )}

          {/* Аллергены */}
          {allergens.length > 0 && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['allergens'] = el;
              }}
              className="mb-8"
            >
              <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-xl border-2 border-red-200 dark:border-red-800/50 shadow-md">
                <h3 className="flex items-center gap-2 mb-3 text-gray-900 dark:text-white font-bold text-lg">
                  <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500">
                    <span className="material-symbols-outlined text-[20px] block">warning</span>
                  </div>
                  {language === 'EN' ? 'Allergens' : 'Аллергены'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {allergens.map((a, idx) => (
                    <span key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-800/60 shadow-sm text-[12px] font-semibold tracking-wide uppercase text-amber-800 dark:text-amber-200">
                      {searchQuery ? highlightText(a, searchQuery) : a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Особенности */}
          {isNonEmpty(item.features) && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['features'] = el;
              }}
              className="mb-8"
            >
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 opacity-80">
                {language === 'EN' ? 'Features' : 'Особенности'}
              </h2>
              <div
                className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{
                  __html: searchQuery
                    ? normalizeNewlines(item.features).replace(
                        new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                        '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                      )
                    : normalizeNewlines(item.features),
                }}
              />
            </div>
          )}

          {/* Комментарии */}
          {comments.length > 0 && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['comments'] = el;
              }}
              className="mb-8"
            >
              <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border-2 border-blue-200 dark:border-blue-800/50 shadow-md">
                <h3 className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-bold text-lg">
                  <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <span className="material-symbols-outlined text-[20px] block">info</span>
                  </div>
                  {language === 'EN' ? 'Comments' : 'Комментарии'}
                </h3>
                <ul className="space-y-3">
                  {comments.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0">
                        <span className="material-symbols-outlined text-[16px] fill-1">fiber_manual_record</span>
                      </span>
                      <div className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed flex-1">
                        {searchQuery ? highlightText(c, searchQuery) : c}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Справочная информация */}
          {isNonEmpty(getFieldValue('reference_info')) && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['reference'] = el;
              }}
              className="mb-4"
            >
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-5 rounded-xl border-2 border-green-200 dark:border-green-800/50 shadow-md">
                <h3 className="flex items-center gap-2 mb-3 text-gray-900 dark:text-white font-bold text-lg">
                  <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined text-[20px] block">lightbulb</span>
                  </div>
                  {language === 'EN' ? 'Reference' : 'Справка'}
                </h3>
                <div
                  className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed max-w-none contains-list whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: searchQuery
                      ? normalizeNewlines(getFieldValue('reference_info')).replace(
                          new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                          '<mark class="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">$1</mark>'
                        )
                      : normalizeNewlines(getFieldValue('reference_info')),
                  }}
                />
              </div>
            </div>
          )}

          {/* Теги */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag, idx) => (
                <div key={idx} className="flex items-center justify-center rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1">
                  <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">{tag}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Нижняя навигация */}
      <nav className="fixed bottom-0 z-50 w-full sabor-fixed bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
        <div className="grid grid-cols-3 px-6 items-center h-[60px]">
          <Link to="/" className="flex flex-col items-center justify-center gap-1 text-primary">
            <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
            <span className="text-[10px] font-bold">{language === 'EN' ? 'Menu' : 'Меню'}</span>
          </Link>
          <Link
            to={isGuest ? '/' : '/favorites'}
            title={isGuest ? 'Доступно после входа' : language === 'EN' ? 'Favorites' : 'Избранное'}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              isGuest ? 'opacity-50 cursor-not-allowed text-gray-400' : isFavorite ? 'text-primary' : 'text-gray-400 hover:text-[#181311] dark:hover:text-white'
            }`}
            onClick={(e) => {
              if (isGuest) e.preventDefault();
            }}
          >
            <span className="material-symbols-outlined text-[24px]">{isFavorite ? 'favorite' : 'favorite_border'}</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
          </Link>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">search</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Up' : 'Наверх'}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default BarItemDetailPage;

