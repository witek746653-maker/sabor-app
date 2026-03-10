import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getWine } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useVisibility } from '../contexts/VisibilityContext';
import { getDishImageUrl } from '../utils/imageUtils';
import { useFavorites } from '../contexts/FavoritesContext';
import GuestBlocker from '../components/GuestBlocker';
import MenuImagePlaceholder from '../components/MenuImagePlaceholder';
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

const CharacteristicScale = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1 w-full mt-1.5">
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`w-1.5 h-1.5 rounded-full ${step <= value
                  ? 'bg-purple-600 dark:bg-purple-400'
                  : 'bg-gray-200 dark:bg-white/10'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

function WineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGuest, isAuthenticated } = useAuth();
  const guestBlocked = !isAuthenticated || isGuest;
  const toast = useToast();
  const { isVisible } = useVisibility();
  const { catalogIds, toggleCatalogFavorite } = useFavorites();

  const [wine, setWine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => localStorage.getItem('menuLanguage') || 'RU');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audio] = useState(() => new Audio());
  const [wineComparison, setWineComparison] = useState(null);
  const [isWineGuideOpen, setIsWineGuideOpen] = useState(false);
  // id → объект вина (для показа фото в модалке)
  const [wineImages, setWineImages] = useState({});

  const searchRefs = useRef({});

  const isFavorite = wine && catalogIds.includes(wine.id);
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
    toggleCatalogFavorite(wine.id);
  };

  const handleBack = () => {
    if (sessionStorage.getItem('fromSearch') === 'true') {
      sessionStorage.removeItem('fromSearch');
      navigate('/search');
    } else {
      navigate(-1);
    }
  };


  const handleShare = async () => {
    if (!wine) return;
    if (isGuest) {
      toast.info(language === 'EN' ? 'Sharing is available after login.' : 'Действие доступно только после входа');
      return;
    }
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
      toast.success(language === 'EN' ? 'Link copied to clipboard!' : 'Ссылка скопирована в буфер обмена!');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success(language === 'EN' ? 'Link copied to clipboard!' : 'Ссылка скопирована в буфер обмена!');
    }
  };

  const handleAudioPlay = () => {
    if (guestBlocked) {
      toast.info(language === 'EN' ? 'Audio is available after login.' : 'Аудио доступно после авторизации');
      return;
    }
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
    // Нормализуем путь: если в данных вдруг есть пробелы, превращаем их в "-".
    const normalizedAudioPath = String(audioPath)
      .trim()
      .replace(/%20/g, '-')
      .replace(/\s+/g, '-');
    let audioUrl;

    if (normalizedAudioPath.startsWith('../audio/')) {
      audioUrl = `${API_URL}/audio/${normalizedAudioPath.replace('../audio/', '')}`;
    } else if (normalizedAudioPath.startsWith('/audio/')) {
      audioUrl = `${API_URL}/audio/${normalizedAudioPath.replace('/audio/', '')}`;
    } else if (normalizedAudioPath.startsWith('audio/')) {
      audioUrl = `${API_URL}/audio/${normalizedAudioPath.replace('audio/', '')}`;
    } else {
      audioUrl = normalizedAudioPath.startsWith('http') ? normalizedAudioPath : `/${normalizedAudioPath}`;
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

        // Загружаем сравнение вин
        try {
          const resp = await fetch('/data/wine-comparison.json');
          if (resp.ok) {
            const compData = await resp.json();
            // Находим категорию по секции текущего вина
            const cat = compData.find(c =>
              c.sections && c.sections.some(s => (data.section || '').includes(s))
            );
            setWineComparison(cat || null);
          }
        } catch (e) {
          console.error('Ошибка загрузки wine-comparison:', e);
        }

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

  // Загружаем объекты вин группы при открытии модалки (для фото)
  useEffect(() => {
    if (!isWineGuideOpen || !wineComparison) return;
    const missing = wineComparison.wines
      .map(w => String(w.id))
      .filter(wid => wid !== String(wine?.id) && !wineImages[wid]);
    if (missing.length === 0) return;

    Promise.all(missing.map(wid => getWine(wid).catch(() => null)))
      .then(results => {
        const map = {};
        results.forEach((data, i) => { if (data) map[missing[i]] = data; });
        setWineImages(prev => ({ ...prev, ...map }));
      });
  }, [isWineGuideOpen, wineComparison]);

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

  const contentTarget = `wine:${wine.id}`;
  if (!isVisible({ scope: 'contentItem', target: contentTarget })) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-red-500 text-lg font-bold mb-4">
            {language === 'EN' ? 'This item is hidden by visibility settings' : 'Эта позиция скрыта настройками видимости'}
          </div>
          <Link to="/wine-catalog" className="text-primary hover:underline">
            {language === 'EN' ? 'Return to catalog' : 'Вернуться в каталог'}
          </Link>
        </div>
      </div>
    );
  }

  if (isArchived && !isVisible({ scope: 'contentItem', target: 'status.archived' })) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-red-500 text-lg font-bold mb-4">
            {language === 'EN' ? 'This item is hidden by visibility settings' : 'Эта позиция скрыта настройками видимости'}
          </div>
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
  const comments = (Array.isArray(wine.comments) ? wine.comments : [wine.comments]).filter(c => String(c || '').trim());

  return (
    <div className="relative z-20 min-h-[100dvh] overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Верхняя панель */}
      <div className="fixed top-0 w-full p-4 pt-14 flex justify-between items-center z-50 sabor-fixed">
        <button
          onClick={handleBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 transition-all active:scale-95 group"
        >
          <span className="material-symbols-outlined text-white group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        </button>


        <div className="flex gap-2 sm:gap-3">
          {isVisible({ scope: 'featureAction', target: 'language.switcher' }) && (
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
          )}

          {!guestBlocked && isVisible({ scope: 'pageBlock', target: 'search.input' }) && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'EN' ? 'Search...' : 'Поиск...'}
                className="h-10 px-4 pr-10 rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/60 text-sm w-28 sm:w-40 transition-all focus:w-40"
              />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white text-[18px] pointer-events-none">
                search
              </span>
            </div>
          )}

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

          {isVisible({ scope: 'featureAction', target: 'favorite.button' }) && (
            <button
              onClick={toggleFavorite}
              disabled={isGuest}
              title={isGuest ? 'Доступно после входа' : isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/35 dark:bg-white/15 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg shadow-black/20 transition-all ${isGuest ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/45 dark:hover:bg-white/20 hover:shadow-black/30 active:scale-95 cursor-pointer'
                } ${isFavorite ? 'text-primary' : 'text-white'}`}
            >
              <span className={`material-symbols-outlined ${isFavorite ? 'fill-1' : ''}`}>favorite</span>
            </button>
          )}
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
          <MenuImagePlaceholder menuName="Вино" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

        {/* Кнопка Путеводитель по вину поверх фото */}
        {wineComparison && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsWineGuideOpen(true);
            }}
            className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-600/40 backdrop-blur-md border border-white/30 text-white text-[12px] font-bold shadow-lg active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">wine_bar</span>
            {language === 'EN' ? 'Wine Guide' : 'Путеводитель по вину'}
          </button>
        )}

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

        {/* Баннер для гостей */}
        {guestBlocked && (
          <div className="mb-4">
            <GuestBlocker lines={0} message={language === 'EN' ? 'Details available after login' : 'Детали доступны после авторизации'} />
          </div>
        )}

        <div className={isArchived ? 'opacity-60' : ''}>
          <h1
            ref={(el) => {
              if (el) searchRefs.current['title'] = el;
            }}
            className="text-[28px] font-bold leading-tight text-gray-900 dark:text-white mb-3"
          >
            {guestBlocked
              ? <div className="h-7 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              : (searchQuery ? highlightText(getFieldValue('title') || 'Без названия', searchQuery) : getFieldValue('title') || 'Без названия')}
          </h1>

          {getFieldValue('section') && !guestBlocked && (
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-3 py-1">
                <span className="text-primary text-xs font-semibold uppercase tracking-wide">{getFieldValue('section')}</span>
              </div>
            </div>
          )}
          {guestBlocked && (
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="h-5 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          )}

          {guestBlocked ? (
            <div className="mb-8 space-y-2">
              <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-3 w-4/6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ) : getFieldValue('description') && isVisible({ scope: 'pageBlock', target: 'wineDetail.description' }) && (
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

          {!guestBlocked && wine.features && isVisible({ scope: 'pageBlock', target: 'wineDetail.features' }) && (
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
          {!guestBlocked && (isNonEmpty(country) || isNonEmpty(region) || isNonEmpty(origin) || isNonEmpty(producer) || isNonEmpty(grapeVarietiesText) || isNonEmpty(sweetness) || isNonEmpty(alcoholContent)) &&
            isVisible({ scope: 'pageBlock', target: 'wineDetail.characteristics' }) && (
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
          {!guestBlocked && (pairingsDishes.length > 0 || pairingsNotes.length > 0) &&
            isVisible({ scope: 'pageBlock', target: 'wineDetail.pairings' }) && (
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
          {!guestBlocked && comments.length > 0 && (
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
          {!guestBlocked && getFieldValue('reference_info') && String(getFieldValue('reference_info')).trim() && (
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
          {!guestBlocked && getTagsForLanguage().length > 0 && (
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

      {/* Модальное окно сравнения вин */}
      {isWineGuideOpen && wineComparison && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300"
          onClick={() => setIsWineGuideOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-surface-dark rounded-t-3xl shadow-2xl p-4 relative animate-in slide-in-from-bottom duration-500 overflow-hidden flex flex-col max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 shrink-0" />

            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
                  <span className="material-symbols-outlined text-lg block">wine_bar</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{wineComparison.group}</h3>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Сравнение вин в категории</p>
                </div>
              </div>
              <button
                onClick={() => setIsWineGuideOpen(false)}
                className="size-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 text-gray-400"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
              {/* Компактный гибридный список вин */}
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {wineComparison.wines.map((w) => {
                  const isCurrent = String(w.id) === String(wine.id);
                  const wObj = isCurrent ? wine : (wineImages[String(w.id)] || null);

                  const isArchived = wObj?.status === 'в архиве';
                  if (isArchived && !isVisible({ scope: 'contentItem', target: 'status.archived' })) {
                    return null;
                  }

                  // Вычисляем теги из pairing_profile
                  const pairingLabels = w.pairing_profile?.labels
                    ? Object.values(w.pairing_profile.labels).filter(v => v !== null)
                    : [];

                  // Название: из локализации или JSON. Производитель из базы:
                  const fullTitle = isCurrent
                    ? (language === 'EN' ? wine.i18n?.en?.['title-en'] || wine.title : wine.title)
                    : w.title;
                  const commaIdx = fullTitle.indexOf(',');
                  const parsedName = commaIdx > 0 ? fullTitle.slice(0, commaIdx).trim() : fullTitle;
                  const parsedProducer = commaIdx > 0 ? fullTitle.slice(commaIdx + 1).trim() : '';

                  const wineName = parsedName;
                  const wineProducer = wObj?.producer || parsedProducer || '';

                  // Разделяем описание: основное тело (Характеристики) и Подвал (Кому предложить)
                  let mainContent = w.comment || '';
                  let footerContent = '';
                  // Захватываем всё до конца строки, так как это обычно последний абзац
                  const footerRegex = /(<p>\s*)?<strong>Кому (предлагать|предложить):?<\/strong>[\s\S]*/i;
                  const match = mainContent.match(footerRegex);
                  if (match) {
                    footerContent = match[0];
                    mainContent = mainContent.replace(footerRegex, '');
                  }

                  return (
                    <div
                      key={w.id}
                      className="relative flex flex-col gap-3 py-4 px-2 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
                      style={isCurrent ? { background: 'rgba(147,112,219,0.06)' } : {}}
                    >
                      {/* Вертикальная линия — маркер текущего вина */}
                      {isCurrent && (
                        <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                      )}

                      {/* Шапка (Header): 3 колонки */}
                      <div className="flex items-start gap-4">
                        {/* Колонка 1: миниатюра (60px) */}
                        <div className="shrink-0 w-[60px] h-[80px] flex items-center justify-center rounded-xl overflow-hidden bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 shadow-sm">
                          {(() => {
                            const imgUrl = getDishImageUrl(wObj);
                            return imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={wineName}
                                className="h-full w-full object-contain p-1 mix-blend-multiply dark:mix-blend-normal"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-purple-300 dark:text-purple-500/50 text-[32px]">wine_bar</span>
                            );
                          })()}
                        </div>

                        {/* Колонка 2: Название и производитель */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className={`text-[15px] font-black leading-tight tracking-tight mb-1 ${isCurrent ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                            {wineName}
                            {isCurrent && <span className="ml-1.5 inline-block text-[10px] align-middle px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 opacity-80">выбрано</span>}
                          </div>
                          {wineProducer && (
                            <div className="text-[12px] font-medium text-gray-500 dark:text-gray-400 leading-tight block truncate pr-2">{wineProducer}</div>
                          )}
                          {/* Мобильная версия 3-й колонки: под названием, только на мобильных */}
                          <div className="sm:hidden flex flex-col items-start gap-1 mt-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold leading-tight bg-purple-100/80 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-200/50 dark:border-purple-800/50">
                              {w.style}
                            </span>
                            <div className="flex flex-col items-start gap-1">
                              {pairingLabels.map((lbl, idx) => {
                                const text = String(lbl);
                                const isPositive = text.includes('✅');
                                const isNegative = text.includes('❌');
                                const textClean = text.replace(/[\u2705\u274c\u26a0\ufe0f]/gu, '').trim();
                                return (
                                  <span key={idx} className="flex items-center gap-1 text-[10px] font-medium leading-tight">
                                    {isPositive ? (
                                      <>
                                        <span className="material-symbols-outlined text-[12px] text-emerald-600 dark:text-emerald-500 fill-1">check_circle</span>
                                        <span className="text-emerald-600 dark:text-emerald-500">{textClean}</span>
                                      </>
                                    ) : isNegative ? (
                                      <>
                                        <span className="material-symbols-outlined text-[12px] text-gray-400 dark:text-gray-500">cancel</span>
                                        <span className="text-gray-400 dark:text-gray-500">{textClean}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="material-symbols-outlined text-[12px] text-amber-500">help</span>
                                        <span className="text-amber-600 dark:text-amber-500">{textClean}</span>
                                      </>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Колонка 3: Бейджи стиля и совместимости (скрыта на мобильных) */}
                        <div className="hidden sm:flex shrink-0 flex-col items-end gap-2 pt-0.5" style={{ minWidth: 80 }}>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-center leading-tight bg-purple-100/80 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-200/50 dark:border-purple-800/50">
                            {w.style}
                          </span>

                          {/* Теги совместимости из pairing_profile */}
                          <div className="flex flex-col items-end gap-1 mt-1">
                            {pairingLabels.map((lbl, idx) => {
                              const text = String(lbl);
                              const isPositive = text.includes('✅');
                              const isNegative = text.includes('❌');
                              const textClean = text.replace(/[\u2705\u274c\u26a0\ufe0f]/gu, '').trim();

                              return (
                                <span key={idx} className="flex items-center gap-1 text-[10px] font-medium leading-tight text-right w-full justify-end">
                                  {isPositive ? (
                                    <>
                                      <span className="text-emerald-600 dark:text-emerald-500">{textClean}</span>
                                      <span className="material-symbols-outlined text-[12px] text-emerald-600 dark:text-emerald-500 fill-1">check_circle</span>
                                    </>
                                  ) : isNegative ? (
                                    <>
                                      <span className="text-gray-400 dark:text-gray-500">{textClean}</span>
                                      <span className="material-symbols-outlined text-[12px] text-gray-400 dark:text-gray-500">cancel</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-amber-600 dark:text-amber-500">{textClean}</span>
                                      <span className="material-symbols-outlined text-[12px] text-amber-500">help</span>
                                    </>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Блок характеристик + технология виноделия */}
                      {(w.pairing_profile?.acidity_level > 0 || w.pairing_profile?.body_level > 0 || w.pairing_profile?.tannins_level > 0 || w.pairing_profile?.barrel || w.pairing_profile?.lees || w.pairing_profile?.biodynamic || w.pairing_profile?.organic) && (
                        <div className="mt-1 mb-1 px-3 py-2 bg-gray-50/80 dark:bg-white/[0.03] rounded-lg border border-gray-100 dark:border-white/5 w-full flex items-center gap-3">
                          {/* Шкалы */}
                          {(w.pairing_profile?.acidity_level > 0 || w.pairing_profile?.body_level > 0 || w.pairing_profile?.tannins_level > 0) && (
                            <div className="flex-1 flex flex-col gap-1">
                              <CharacteristicScale label="Кислотность" value={w.pairing_profile?.acidity_level} />
                              <CharacteristicScale label="Тело" value={w.pairing_profile?.body_level} />
                              <CharacteristicScale label="Танины" value={w.pairing_profile?.tannins_level} />
                            </div>
                          )}
                          {/* Правая колонка: технологические бейджи */}
                          {(w.pairing_profile?.barrel || w.pairing_profile?.lees || w.pairing_profile?.biodynamic || w.pairing_profile?.organic) && (
                            <div className={`shrink-0 flex flex-col items-center gap-1.5 ${(w.pairing_profile?.acidity_level > 0 || w.pairing_profile?.body_level > 0 || w.pairing_profile?.tannins_level > 0) ? 'border-l border-gray-200/80 dark:border-white/10 pl-3' : ''}`}>
                              {/* Бочка */}
                              {w.pairing_profile?.barrel && (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[17px] leading-none">🪵</span>
                                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 text-center leading-tight uppercase tracking-wide max-w-[72px]">
                                    {w.pairing_profile.barrel.type}
                                  </span>
                                  <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/25 px-1.5 py-0.5 rounded-full border border-amber-200/70 dark:border-amber-700/40 leading-tight whitespace-nowrap">
                                    {w.pairing_profile.barrel.duration}
                                  </span>
                                </div>
                              )}
                              {/* Разделитель */}
                              {w.pairing_profile?.barrel && w.pairing_profile?.lees && (
                                <div className="w-full border-t border-gray-200/60 dark:border-white/5" />
                              )}
                              {/* Sur lie / Осадок */}
                              {w.pairing_profile?.lees && (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[17px] leading-none">🫧</span>
                                  <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 text-center leading-tight uppercase tracking-wide">
                                    На осадке
                                  </span>
                                  <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/25 px-1.5 py-0.5 rounded-full border border-sky-200/70 dark:border-sky-700/40 leading-tight whitespace-nowrap">
                                    {w.pairing_profile.lees.duration}
                                  </span>
                                </div>
                              )}
                              {/* Разделитель перед био/органика */}
                              {(w.pairing_profile?.barrel || w.pairing_profile?.lees) && (w.pairing_profile?.biodynamic || w.pairing_profile?.organic) && (
                                <div className="w-full border-t border-gray-200/60 dark:border-white/5" />
                              )}
                              {/* Биодинамика */}
                              {w.pairing_profile?.biodynamic && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[12px]">🌿</span>
                                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide leading-tight">Биодинамика</span>
                                </div>
                              )}
                              {/* Органика */}
                              {w.pairing_profile?.organic && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[12px]">♻️</span>
                                  <span className="text-[9px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide leading-tight">Органика</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Body: Основные характеристики */}
                      {mainContent && (
                        <div
                          className="text-[12px] text-gray-700 dark:text-gray-300 leading-snug contains-list w-full space-y-1 mt-1 [&>p>strong]:font-semibold [&>p>strong]:text-gray-900 [&>p>strong]:dark:text-white"
                          dangerouslySetInnerHTML={{ __html: mainContent }}
                        />
                      )}

                      {/* Footer: Кому предложить */}
                      {footerContent && (
                        <div
                          className="mt-1 bg-purple-50/80 dark:bg-purple-900/20 rounded-lg p-3 text-[12px] leading-relaxed text-purple-900 dark:text-purple-100 contains-list border border-purple-100 dark:border-purple-800/30 w-full shadow-sm"
                          dangerouslySetInnerHTML={{ __html: footerContent }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 mb-2 border-t border-gray-100 dark:border-white/5">
                <p className="text-[10px] text-gray-400 italic text-center leading-relaxed">
                  * Нажмите на вино в основном меню для просмотра подробных характеристик и пэринга.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Нижняя навигация (та же логика, что и на DishDetailPage) */}
      <nav className="fixed bottom-0 z-50 w-full sabor-fixed bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
        <div
          className={`grid ${(() => {
            const showFooterMenu = isVisible({ scope: 'menuItem', target: 'footer.menu' });
            const showFooterFavorites = isVisible({ scope: 'menuItem', target: 'footer.favorites' });
            const showFooterSearch = isVisible({ scope: 'menuItem', target: 'footer.search' });
            const itemCount =
              (showFooterMenu ? 1 : 0) +
              (showFooterFavorites ? 1 : 0) +
              (showFooterSearch ? 1 : 0);
            return itemCount >= 3 ? 'grid-cols-3' : 'grid-cols-2';
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
            <Link
              to={isGuest ? '/' : '/favorites'}
              title={isGuest ? 'Доступно после входа' : language === 'EN' ? 'Favorites' : 'Избранное'}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${isGuest ? 'opacity-50 cursor-not-allowed text-gray-400' : isFavorite ? 'text-primary' : 'text-gray-400 hover:text-[#181311] dark:hover:text-white'
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
          )}
          {isVisible({ scope: 'menuItem', target: 'footer.search' }) && (
            <button
              onClick={() => navigate('/search')}
              className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">search</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Search' : 'Поиск'}</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

export default WineDetailPage;

