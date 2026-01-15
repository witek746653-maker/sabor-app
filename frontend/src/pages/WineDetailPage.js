import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getWine } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';
import './DishDetailPage.css';

// Термин **парсинг**: простыми словами “разобрать строку на кусочки”.
const parseOrigin = (originStr, wineData) => {
  if (!originStr && !wineData?.region) return { country: null, region: null };
  // Убираем точку в конце, если она есть
  const cleaned = originStr ? originStr.replace(/\.$/, '').trim() : '';
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  if (wineData?.region) {
    return {
      country: parts[0] || null,
      region: wineData.region || parts.slice(1).join(', ') || null,
    };
  }
  return {
    country: parts[0] || null,
    region: parts.slice(1).join(', ') || null,
  };
};

const toCleanText = (v) => (v == null ? '' : String(v).replace(/\.$/, '').trim());

const isNonEmpty = (v) => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.filter(Boolean).length > 0;
  return Boolean(String(v).trim());
};

function WineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGuest } = useAuth();

  const [wine, setWine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => localStorage.getItem('menuLanguage') || 'RU');
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favoriteDishes');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audio] = useState(() => new Audio());

  const searchRefs = useRef({});

  const isFavorite = wine && favorites.includes(wine.id);
  const isArchived = wine?.status === 'в архиве';

  const getFieldValue = (fieldName) => {
    if (!wine) return '';
    if (language === 'EN' && wine.i18n?.en) {
      const enField = `${fieldName}-en`;
      return wine.i18n.en[enField] || wine[fieldName] || '';
    }
    return wine[fieldName] || '';
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
    if (!wine) return [];
    if (language === 'EN' && wine.i18n?.en?.['tags-en']) {
      const tagsEn = wine.i18n.en['tags-en'];
      if (typeof tagsEn === 'string') {
        return tagsEn.split(',').map((t) => t.trim()).filter(Boolean);
      }
      return Array.isArray(tagsEn) ? tagsEn : [];
    }
    return Array.isArray(wine.tags) ? wine.tags : [];
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
    if (!wine || isGuest) return;
    const newFavorites = isFavorite ? favorites.filter((fid) => fid !== wine.id) : [...favorites, wine.id];
    setFavorites(newFavorites);
    localStorage.setItem('favoriteDishes', JSON.stringify(newFavorites));
  };

  const handleShare = async () => {
    if (!wine) return;
    const title = getFieldValue('title') || (language === 'EN' ? 'Wine' : 'Вино');
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

  const handleAudioPlay = () => {
    const audioPath = wine?.i18n?.en?.['audio-en'];
    if (!audioPath) return;

    if (audioPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setAudioPlaying(false);
      return;
    }

    // Термин **API_URL**: “адрес бэкенда”, куда мы ходим за файлами.
    const API_URL = process.env.REACT_APP_API_URL || '';
    let audioUrl;

    if (audioPath.startsWith('../audio/')) {
      audioUrl = `${API_URL}/audio/${audioPath.replace('../audio/', '')}`;
    } else if (audioPath.startsWith('/audio/')) {
      audioUrl = `${API_URL}/audio/${audioPath.replace('/audio/', '')}`;
    } else if (audioPath.startsWith('audio/')) {
      audioUrl = `${API_URL}/audio/${audioPath.replace('audio/', '')}`;
    } else {
      audioUrl = audioPath.startsWith('http') ? audioPath : `/${audioPath}`;
    }

    audio.src = audioUrl;
    audio.load();
    audio
      .play()
      .then(() => setAudioPlaying(true))
      .catch((err) => {
        console.error('Ошибка воспроизведения аудио:', err);
        setAudioPlaying(false);
      });
  };

  useEffect(() => {
    const handleEnded = () => setAudioPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio]);

  useEffect(() => {
    const loadWine = async () => {
      try {
        setLoading(true);
        const data = await getWine(id);
        setWine(data);

        // Если пришли из глобального поиска — подсветим найденный текст.
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
        console.error('Ошибка загрузки вина:', error);
        setWine(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadWine();
  }, [id]);

  // Скроллим к первому совпадению (как “лупа” в книге)
  useEffect(() => {
    if (!searchQuery || !wine) return;
    const query = searchQuery.toLowerCase();
    const allText = [
      getFieldValue('title'),
      getFieldValue('description'),
      getFieldValue('section'),
      wine.origin || '',
      wine.region || '',
      wine.producer || '',
      Array.isArray(wine.grapeVarieties) ? wine.grapeVarieties.join(' ') : (wine.grapeVarieties || ''),
      Array.isArray(wine.comments) ? wine.comments.join(' ') : (wine.comments || ''),
      Array.isArray(wine.tags) ? wine.tags.join(' ') : (wine.tags || ''),
      wine.features || '',
      wine.reference_info || '',
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
  }, [searchQuery, wine, language]);

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">{language === 'EN' ? 'Loading...' : 'Загрузка...'}</div>
      </div>
    );
  }

  if (!wine) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-red-500 text-lg font-bold mb-4">{language === 'EN' ? 'Wine not found' : 'Вино не найдено'}</div>
          <Link to="/wine-catalog" className="text-primary hover:underline">
            {language === 'EN' ? 'Return to catalog' : 'Вернуться в каталог'}
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = getDishImageUrl(wine);
  const { country, region } = parseOrigin(wine.origin || '', wine);
  const grapeVarietiesText = Array.isArray(wine.grapeVarieties)
    ? wine.grapeVarieties.map(toCleanText).filter(Boolean).join(', ')
    : toCleanText(wine.grapeVarieties);

  const producer = toCleanText(wine.producer);
  const origin = toCleanText(wine.origin);
  const sweetness = toCleanText(wine.sweetness);
  const alcoholContent = toCleanText(wine.alcoholContent);

  const pairingsDishes = Array.isArray(wine.pairings?.dishes) ? wine.pairings.dishes.filter(Boolean) : [];
  const pairingsNotes = Array.isArray(wine.pairings?.notes) ? wine.pairings.notes.filter(Boolean) : [];
  const comments = Array.isArray(wine.comments) ? wine.comments.filter(Boolean) : (wine.comments ? [wine.comments] : []);

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

          {wine?.i18n?.en?.['audio-en'] && (
            <button
              onClick={handleAudioPlay}
              title={language === 'EN' ? 'Pronunciation' : 'Произношение (EN)'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-white">{audioPlaying ? 'stop_circle' : 'volume_up'}</span>
            </button>
          )}

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
      <div
        className="w-full h-[420px] sm:h-[520px] overflow-hidden relative -mt-4 mb-4 cursor-pointer bg-white/40 dark:bg-white/5"
        onClick={() => setIsImageExpanded(true)}
      >
        {imageUrl ? (
          <img
            alt={wine.image?.alt || wine.title}
            // Вино: показываем бутылку целиком, поэтому **object-contain** (вписываем, а не обрезаем).
            className="h-full w-full object-contain p-4"
            src={imageUrl}
          />
        ) : (
          <div className="h-full w-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-gray-400 text-6xl">wine_bar</span>
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
            alt={wine.image?.alt || wine.title}
            className="max-w-full max-h-full object-contain"
            src={imageUrl}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Контент */}
      <div className="px-5 pt-1 pb-24">
        {/* “В архиве” (статус отдельно не показываем нигде) */}
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

          {wine.features && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['features'] = el;
              }}
              className="mb-8"
            >
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 opacity-80">
                {language === 'EN' ? 'Features' : 'Особенности'}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed whitespace-pre-line">
                {searchQuery ? highlightText(normalizeNewlines(wine.features), searchQuery) : normalizeNewlines(wine.features)}
              </p>
            </div>
          )}

          {/* Карточки характеристик: показываем только то, что реально заполнено */}
          {(isNonEmpty(country) || isNonEmpty(region) || isNonEmpty(origin) || isNonEmpty(producer) || isNonEmpty(grapeVarietiesText) || isNonEmpty(sweetness) || isNonEmpty(alcoholContent)) && (
            <div className="grid grid-cols-2 gap-4 mb-8">
              {(country || origin) && (
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 dark:border-primary/30 shadow-sm">
                  <div className="text-xs font-bold text-gray-900 dark:text-white mb-1 opacity-80">
                    {language === 'EN' ? 'Country' : 'Страна'}
                  </div>
                  <div className="text-gray-700 dark:text-gray-200 text-sm">
                    {searchQuery ? highlightText(country || origin, searchQuery) : country || origin}
                  </div>
                </div>
              )}
              {region && (
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 dark:border-primary/30 shadow-sm">
                  <div className="text-xs font-bold text-gray-900 dark:text-white mb-1 opacity-80">
                    {language === 'EN' ? 'Region' : 'Регион'}
                  </div>
                  <div className="text-gray-700 dark:text-gray-200 text-sm">{searchQuery ? highlightText(region, searchQuery) : region}</div>
                </div>
              )}
              {producer && (
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 dark:border-primary/30 shadow-sm">
                  <div className="text-xs font-bold text-gray-900 dark:text-white mb-1 opacity-80">
                    {language === 'EN' ? 'Producer' : 'Производитель'}
                  </div>
                  <div className="text-gray-700 dark:text-gray-200 text-sm">{searchQuery ? highlightText(producer, searchQuery) : producer}</div>
                </div>
              )}
              {grapeVarietiesText && (
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 dark:border-primary/30 shadow-sm">
                  <div className="text-xs font-bold text-gray-900 dark:text-white mb-1 opacity-80">
                    {language === 'EN' ? 'Grapes' : 'Сорт винограда'}
                  </div>
                  <div className="text-gray-700 dark:text-gray-200 text-sm">
                    {searchQuery ? highlightText(grapeVarietiesText, searchQuery) : grapeVarietiesText}
                  </div>
                </div>
              )}
              {sweetness && (
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 dark:border-primary/30 shadow-sm">
                  <div className="text-xs font-bold text-gray-900 dark:text-white mb-1 opacity-80">
                    {language === 'EN' ? 'Sweetness' : 'Сладость'}
                  </div>
                  <div className="text-gray-700 dark:text-gray-200 text-sm">{searchQuery ? highlightText(sweetness, searchQuery) : sweetness}</div>
                </div>
              )}
              {alcoholContent && (
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 dark:border-primary/30 shadow-sm">
                  <div className="text-xs font-bold text-gray-900 dark:text-white mb-1 opacity-80">
                    {language === 'EN' ? 'Alcohol' : 'Алкоголь'}
                  </div>
                  <div className="text-gray-700 dark:text-gray-200 text-sm">{searchQuery ? highlightText(alcoholContent, searchQuery) : alcoholContent}</div>
                </div>
              )}
            </div>
          )}

          {/* Пэринг */}
          {(pairingsDishes.length > 0 || pairingsNotes.length > 0) && (
            <div
              ref={(el) => {
                if (el) searchRefs.current['pairings'] = el;
              }}
              className="mb-8"
            >
              <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-xl border border-primary/20 dark:border-primary/30 shadow-md">
                <h3 className="flex items-center gap-2 mb-3 text-gray-900 dark:text-white font-bold text-lg">
                  <div className="p-1.5 rounded-full bg-primary/20 dark:bg-primary/30 text-primary">
                    <span className="material-symbols-outlined text-[20px] block">wine_bar</span>
                  </div>
                  {language === 'EN' ? 'Pairing' : 'Пэринг'}
                </h3>

                {pairingsDishes.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      {language === 'EN' ? 'Dishes' : 'Блюда'}
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {pairingsDishes.map((p, idx) => (
                        <li key={idx} className="text-sm bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-md text-gray-800 dark:text-gray-100 font-medium">
                          {searchQuery ? highlightText(p, searchQuery) : p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {pairingsNotes.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      {language === 'EN' ? 'Notes' : 'Заметки'}
                    </div>
                    <ul className="space-y-2">
                      {pairingsNotes.map((note, idx) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
                          {searchQuery ? highlightText(note, searchQuery) : note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
          {getFieldValue('reference_info') && String(getFieldValue('reference_info')).trim() && (
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
                  // Термин **dangerouslySetInnerHTML**: “вставить HTML как есть”.
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
          {getTagsForLanguage().length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {getTagsForLanguage().map((tag, idx) => (
                <div key={idx} className="flex items-center justify-center rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1">
                  <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">{tag}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Нижняя навигация (та же логика, что и на DishDetailPage) */}
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
              if (isGuest) {
                e.preventDefault();
              }
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

export default WineDetailPage;

