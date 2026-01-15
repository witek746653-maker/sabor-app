import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWine } from '../services/api';
import { getDishImageUrl, getImageUrl } from '../utils/imageUtils';
import './WineItemPage.css';

/**
 * Компонент страницы отдельного вина
 * Загружает данные из menu-database.json через API и отображает карточку вина
 * Для каждого вина генерируется карточка со своей информацией:
 * - Название, секция, описание
 * - Изображение бутылки
 * - Страна, регион, сорт винограда, производитель
 * - Комментарии и интересные факты
 * - Пэринг с блюдами
 */
function WineItemPage() {
  const { id } = useParams(); // ID вина из URL
  const navigate = useNavigate();
  const [wine, setWine] = useState(null); // Данные вина из menu-database.json
  const [loading, setLoading] = useState(true);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audio] = useState(new Audio());

  useEffect(() => {
    const loadWine = async () => {
      try {
        setLoading(true);
        // Загружаем данные вина из menu-database.json через API
        const data = await getWine(id);
        if (data && data.id) {
          setWine(data);
        } else {
          console.error('Вина не найдено или данные некорректны:', data);
        }
      } catch (error) {
        console.error('Ошибка загрузки вина из menu-database.json:', error);
        // Показываем ошибку пользователю
        setWine(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadWine();
    }
  }, [id]);

  // Парсинг origin для получения страны и региона
  // Если есть отдельное поле region, используем его, иначе парсим origin
  const parseOrigin = (originStr, wineData) => {
    if (!originStr && !wineData?.region) return { country: null, region: null };
    
    // Если есть отдельное поле region, используем его
    if (wineData?.region) {
      const cleaned = originStr ? originStr.replace(/\.$/, '').trim() : '';
      const parts = cleaned.split(',').map(p => p.trim());
      return {
        country: parts[0] || null,
        region: wineData.region || parts.slice(1).join(', ') || null,
      };
    }
    
    // Иначе парсим origin
    const cleaned = originStr.replace(/\.$/, '').trim();
    const parts = cleaned.split(',').map(p => p.trim());
    return {
      country: parts[0] || null,
      region: parts.slice(1).join(', ') || null,
    };
  };

  // Воспроизведение аудио
  const handleAudioPlay = () => {
    const audioPath = wine?.i18n?.en?.['audio-en'];
    if (!audioPath) return;

    if (audioPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setAudioPlaying(false);
    } else {
      // Преобразуем путь к аудио в правильный URL через API
      // По умолчанию используем "тот же домен", чтобы работало на Beget и при открытии по IP.
      const API_URL = process.env.REACT_APP_API_URL || '';
      let audioUrl;
      
      if (audioPath.startsWith('../audio/')) {
        // Убираем префикс ../audio/ и добавляем к API URL
        const filename = audioPath.replace('../audio/', '');
        audioUrl = `${API_URL}/audio/${filename}`;
      } else if (audioPath.startsWith('/audio/')) {
        // Убираем префикс /audio/ и добавляем к API URL
        const filename = audioPath.replace('/audio/', '');
        audioUrl = `${API_URL}/audio/${filename}`;
      } else if (audioPath.startsWith('audio/')) {
        // Убираем префикс audio/ и добавляем к API URL
        const filename = audioPath.replace('audio/', '');
        audioUrl = `${API_URL}/audio/${filename}`;
      } else {
        // Для остальных случаев используем как есть
        audioUrl = audioPath.startsWith('http') ? audioPath : `/${audioPath}`;
      }
      
      // Добавляем обработчики событий для диагностики
      const handleError = (e) => {
        console.error('Ошибка загрузки аудио:', {
          error: e,
          src: audio.src,
          audioPath: audioPath,
          audioUrl: audioUrl
        });
        setAudioPlaying(false);
      };
      
      const handleCanPlay = () => {
        console.log('Аудио готово к воспроизведению:', audioUrl);
      };
      
      // Удаляем старые обработчики перед добавлением новых
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      
      audio.addEventListener('error', handleError);
      audio.addEventListener('canplay', handleCanPlay);
      
      audio.src = audioUrl;
      audio.load(); // Явно загружаем аудио
      
      audio.play().catch(err => {
        console.error('Ошибка воспроизведения аудио:', {
          error: err,
          src: audio.src,
          audioPath: audioPath,
          audioUrl: audioUrl
        });
        setAudioPlaying(false);
      });
      
      setAudioPlaying(true);
    }
  };

  useEffect(() => {
    const handleEnded = () => setAudioPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio]);

  if (loading) {
    return (
      <div className="wine-item-page bg-background-light dark:bg-background-dark font-sans antialiased text-text-dark dark:text-white min-h-screen flex items-center justify-center">
        <div className="text-wine-red text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  if (!wine) {
    return (
      <div className="wine-item-page bg-background-light dark:bg-background-dark font-sans antialiased text-text-dark dark:text-white min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-red-500 text-lg font-bold mb-4">Вина не найдено</div>
          <Link to="/wine-menu" className="text-wine-red hover:underline">Вернуться к меню вин</Link>
        </div>
      </div>
    );
  }

  const imageUrl = getDishImageUrl(wine);
  const isArchived = wine.status === 'в архиве';
  // Парсим origin с учетом отдельного поля region из базы данных
  const { country, region } = parseOrigin(wine.origin || '', wine);
  
  // Обработка сортов винограда
  const grapeVarieties = wine.grapeVarieties 
    ? (Array.isArray(wine.grapeVarieties) 
        ? wine.grapeVarieties.map(g => g.replace(/\.$/, '').trim()).filter(g => g).join(', ')
        : wine.grapeVarieties.replace(/\.$/, '').trim())
    : null;
  
  // Обработка производителя
  const producer = wine.producer ? wine.producer.replace(/\.$/, '').trim() : null;
  
  // Обработка комментариев - берем первый из массива или сам комментарий
  const comment = wine.comments && Array.isArray(wine.comments) && wine.comments.length > 0
    ? wine.comments[0]
    : (wine.comments || null);

  // Разделение описания на две колонки
  const description = wine.description || '';
  const features = wine.features || '';
  const descriptionText = `${description} ${features}`.trim();
  const midPoint = Math.ceil(descriptionText.length / 2);
  const spaceIndex = descriptionText.lastIndexOf(' ', midPoint);
  const firstColumn = descriptionText.substring(0, spaceIndex > 0 ? spaceIndex : midPoint);
  const secondColumn = descriptionText.substring(spaceIndex > 0 ? spaceIndex + 1 : midPoint);

  // Получаем URL для изображения кольца
  // getImageUrl уже вернёт корректный абсолютный путь вида "/images/..." при пустом REACT_APP_API_URL
  const stainImageUrl = getImageUrl('/images/wine-red-stain.webp') || '/images/wine-red-stain.webp';

  return (
    <div className="wine-item-page bg-[#1a1a1a] w-full" style={{ minHeight: '100vh', overflowY: 'auto' }}>
      <div className="flex justify-center py-5 px-2 sm:px-4 w-full max-w-full">
        <main className="wine-card relative w-full max-w-[800px] bg-cream flex flex-col" style={{ overflow: 'visible' }}>
        {/* Плашка архива + лёгкое затемнение контента */}
        {isArchived && (
          <>
            <div className="absolute top-4 right-4 z-[60] bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-md backdrop-blur">
              В АРХИВЕ
            </div>
            <div className="absolute inset-0 bg-black/10 pointer-events-none z-[50]" />
          </>
        )}
        {/* Decorative Stain: Top Left - левый верхний угол */}
        <img
          alt=""
          aria-hidden="true"
          className="absolute top-0 left-0 w-64 md:w-96 pointer-events-none z-0 mix-blend-multiply opacity-60"
          src={getImageUrl('/images/wine/e4d2fef76d58dc7b4eb6854e51ce5382.png')}
          style={{
            mixBlendMode: 'multiply',
            transform: 'scale(2) rotate(-25deg)',
            maskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
            WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
          }}
        />

        {/* Header */}
        <header className="relative z-10 px-4 sm:px-6 md:px-8 py-6 flex justify-between items-center border-b border-gray-300/30">
        
          <div className="flex space-x-4 text-text-dark opacity-70">
            <button
              onClick={() => navigate(-1)}
              aria-label="Назад"
              className="hover:opacity-100 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative px-4 sm:px-6 md:px-8 pt-12 z-10 grid grid-cols-1 md:grid-cols-2 gap-8 pb-16" style={{ overflow: 'visible' }}>
          {/* Left Content: Title & Description */}
          <div className="md:pr-4">
            <h1 className="text-5xl md:text-7xl text-wine-red mb-2 leading-[0.9] tracking-tight font-serif">
              {wine.title?.toUpperCase() || 'ВИНО'}
            </h1>
            {wine.section && (
              <h2 className="text-sm uppercase tracking-[0.2em] mb-10 font-sans text-[#8E866D]">
                {wine.section}
              </h2>
            )}
            {/* Description Text Columns */}
            {descriptionText && (
              <div className="grid grid-cols-2 gap-6 text-lg text-text-dark leading-loose font-light mt-16">
                <p>{firstColumn}</p>
                <p>{secondColumn}</p>
              </div>
            )}
          </div>
          {/* Right Content: Bottle Image & Audio Button */}
          <div className="relative w-full" style={{ minHeight: '900px', maxWidth: '100%', overflow: 'visible', position: 'relative', paddingTop: '4rem', paddingBottom: '4rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* Фоновое изображение около бутылки - на заднем плане */}
            <img
              alt=""
              aria-hidden="true"
              className="absolute pointer-events-none z-0 mix-blend-multiply opacity-50"
              src={getImageUrl('/images/wine/b8ac55a15379f6b2a50cce3d5dccdcf8.png')}
              style={{
                position: 'absolute',
                top: '40%',
                left: '45%',
                transform: 'translate(-50%, -50%) scale(1.5)',
                zIndex: 0,
                width: '400px',
                maxWidth: '80%',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
            {/* Stain Ring (Behind Bottle) - кольцо на заднем плане */}
            <img
              alt=""
              className="absolute pointer-events-none"
              src={stainImageUrl}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                opacity: 0.85,
                width: '550px',
                maxWidth: '90%',
                height: 'auto',
                objectFit: 'contain',
              }}
              onError={(e) => {
                if (e.target.src !== stainImageUrl) {
                  e.target.src = '/images/wine-red-stain.webp';
                }
              }}
            />
            {/* Main Bottle Image - бутылка на переднем плане */}
            {imageUrl ? (
              <img
                alt={wine.image?.alt || wine.title}
                className="relative drop-shadow-2xl"
                src={imageUrl}
                style={{
                  position: 'relative',
                  zIndex: 10,
                  maxHeight: '850px',
                  height: 'auto',
                  maxWidth: '75%',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 min-h-[300px] flex items-center justify-center" style={{ zIndex: 10 }}>
                <span className="material-symbols-outlined text-wine-red/30 text-8xl">wine_bar</span>
              </div>
            )}
          </div>
        </section>

        {/* Audio Button Section - кнопка аудио между бутылкой и следующим элементом */}
        {wine.i18n?.en?.['audio-en'] && (
          <section className="audio-button-section relative px-4 sm:px-6 md:px-8 z-20">
            <div className="flex justify-center md:justify-end">
              <button
                onClick={handleAudioPlay}
                className="audio-button rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all hover:shadow-xl
                  md:mr-8 lg:mr-12"
                style={{
                  backgroundColor: 'white',
                  border: '2px solid #D4AF37',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                aria-label="Воспроизвести произношение"
              >
                <svg 
                  className="w-7 h-7" 
                  fill="none" 
                  stroke="#D4AF37" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  {audioPlaying ? (
                    <>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M15.54 8.46a5 5 0 010 7.07" />
                      <path d="M19.07 4.93a10 10 0 010 14.14" />
                    </>
                  ) : (
                    <>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M15.54 8.46a5 5 0 010 7.07" />
                      <path d="M19.07 4.93a10 10 0 010 14.14" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* Details Row */}
        <section className="relative px-4 sm:px-6 md:px-8 py-8 z-10">
          <div className="relative">
            {/* Фоновое изображение с брызгами - за карточками */}
            <img
              alt=""
              aria-hidden="true"
              className="absolute pointer-events-none z-0 mix-blend-multiply opacity-60"
              src={getImageUrl('/images/wine/e2726b30ad2835db5adbae968ee6cb2b.png')}
              style={{
                mixBlendMode: 'multiply',
                maskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
                WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
                top: '-10%',
                left: '50%',
                transform: 'translate(-50%, 0) scale(2) rotate(-25deg)',
                width: '600px',
                height: 'auto',
                zIndex: 0,
              }}
            />
            {/* The visual horizontal line connecting the cards */}
            <div className="absolute top-[18px] left-[20px] right-[20px] h-[1px] bg-card-border z-1 hidden md:block" />
            {/* Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative w-full" style={{ zIndex: 30 }}>
              {/* Card 1: Country */}
              {country && (
                <article className="bg-cream border p-4 rounded-lg flex flex-col items-start min-h-[140px] border-card-border relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                  <div className="bg-cream rounded-full p-1 mb-3 border-2 border-cream -mt-2 relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                    <svg className="w-8 h-8 opacity-80" fill="none" stroke="#5e2129" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-xs text-gray-500 mb-1 relative" style={{ zIndex: 30 }}>Страна:</h3>
                  <p className="font-serif text-lg text-text-dark leading-tight relative" style={{ zIndex: 30 }}>{country}</p>
                </article>
              )}

              {/* Card 2: Region */}
              {region && (
                <article className="bg-cream border p-4 rounded-lg flex flex-col items-start min-h-[140px] border-card-border relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                  <div className="bg-cream rounded-full p-1 mb-3 border-2 border-cream -mt-2 relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                    <svg className="w-8 h-8 opacity-80" fill="none" stroke="#5e2129" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-xs text-gray-500 mb-1 relative" style={{ zIndex: 30 }}>Регион:</h3>
                  <p className="font-serif text-lg text-text-dark leading-tight relative" style={{ zIndex: 30 }}>{region}</p>
                </article>
              )}

              {/* Card 3: Grapes */}
              {grapeVarieties && (
                <article className="bg-cream border p-4 rounded-lg flex flex-col items-start min-h-[140px] border-card-border relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                  <div className="bg-cream rounded-full p-1 mb-3 border-2 border-cream -mt-2 relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                    <svg fill="none" height="32px" viewBox="0 0 24 24" width="32px">
                      <path d="M12 5.5C12 4.67157 12.6716 4 13.5 4C14.3284 4 15 4.67157 15 5.5C15 6.32843 14.3284 7 13.5 7C12.6716 7 12 6.32843 12 5.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15.5 8.5C15.5 7.67157 16.1716 7 17 7C17.8284 7 18.5 7.67157 18.5 8.5C18.5 9.32843 17.8284 10 17 10C16.1716 10 15.5 9.32843 15.5 8.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15.5 14.5C15.5 13.6716 16.1716 13 17 13C17.8284 13 18.5 13.6716 18.5 14.5C18.5 15.3284 17.8284 16 17 16C16.1716 16 15.5 15.3284 15.5 14.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8.5 8.5C8.5 7.67157 9.17157 7 10 7C10.8284 7 11.5 7.67157 11.5 8.5C11.5 9.32843 10.8284 10 10 10C9.17157 10 8.5 9.32843 8.5 8.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 11.5C12 10.6716 12.6716 10 13.5 10C14.3284 10 15 10.6716 15 11.5C15 12.3284 14.3284 13 13.5 13C12.6716 13 12 12.3284 12 11.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 17.5C12 16.6716 12.6716 16 13.5 16C14.3284 16 15 16.6716 15 17.5C15 18.3284 14.3284 19 13.5 19C12.6716 19 12 18.3284 12 17.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8.5 14.5C8.5 13.6716 9.17157 13 10 13C10.8284 13 11.5 13.6716 11.5 14.5C11.5 15.3284 10.8284 16 10 16C9.17157 16 8.5 15.3284 8.5 14.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5 11.5C5 10.6716 5.67157 10 6.5 10C7.32843 10 8 10.6716 8 11.5C8 12.3284 7.32843 13 6.5 13C5.67157 13 5 12.3284 5 11.5Z" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13.5 4V2" stroke="#5e2129" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-xs text-gray-500 mb-1 relative" style={{ zIndex: 30 }}>Сорт винограда:</h3>
                  <p className="font-serif text-lg text-text-dark leading-tight relative" style={{ zIndex: 30 }}>{grapeVarieties}</p>
                </article>
              )}

              {/* Card 4: Producer */}
              {producer && (
                <article className="bg-cream border p-4 rounded-lg flex flex-col items-start min-h-[140px] border-card-border relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                  <div className="bg-cream rounded-full p-1 mb-3 border-2 border-cream -mt-2 relative" style={{ backgroundColor: '#EFEDE6', zIndex: 30 }}>
                    <svg className="w-8 h-8 opacity-80" fill="none" stroke="#5e2129" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-xs text-gray-500 mb-1 relative" style={{ zIndex: 50 }}>Производитель:</h3>
                  <p className="font-serif text-lg text-text-dark leading-tight relative" style={{ zIndex: 50 }}>{producer}</p>
                </article>
              )}
            </div>
          </div>
        </section>

        {/* Quote Section */}
        {comment && (
          <section className="relative px-4 sm:px-6 md:px-8 pt-8 pb-16 z-10 flex justify-center">
            {/* Фоновое изображение внизу посередине экрана - на заднем плане */}
            <img
              alt=""
              aria-hidden="true"
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-96 pointer-events-none z-0 mix-blend-multiply opacity-50"
              src={getImageUrl('/images/wine/071307a9465f31e91f7c15efdb518f90.png')}
              style={{
                mixBlendMode: 'multiply',
                transform: 'translate(0%, 0) scale(2)',
                maskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
                WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
              }}
            />
            {/* Decorative Stains for Quote Area - за текстовым блоком */}
            <img
              alt=""
              className="absolute bottom-10 left-0 w-48 pointer-events-none mix-blend-multiply opacity-60"
              src={getImageUrl('/images/wine/e2726b30ad2835db5adbae968ee6cb2b.png')}
              style={{
                mixBlendMode: 'multiply',
                transform: 'scale(4)',
                maskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
                WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
                zIndex: 0,
              }}
            />
            <img
              alt=""
              className="absolute bottom-0 right-0 w-64 pointer-events-none mix-blend-multiply opacity-60"
              src=""
              style={{
                mixBlendMode: 'multiply',
                transform: 'scale(2) rotate(45deg)',
                maskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
                WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 95%)',
                zIndex: 0,
              }}
            />
            {/* Quote Box */}
            <div className="relative p-8 rounded-sm max-w-lg mx-auto w-full" style={{ backgroundColor: 'rgba(239, 237, 230, 0.85)', zIndex: 30 }}>
               <div className="text-8xl font-serif text-wine-red absolute -top-10 left-4 leading-none select-none pointer-events-none">"</div>
              <div className="pt-4">
                <h3 className="font-serif text-lg text-text-dark mb-2" style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' }}>Интересный факт:</h3>
                <p className="text-gray-700 font-light leading-relaxed" style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' }}>{comment}</p>
              </div>
            </div>
          </section>
        )}

        {/* Pairings Section (опционально) */}
        {wine.pairings && (wine.pairings.dishes?.length > 0 || wine.pairings.notes?.length > 0) && (
          <section className="relative px-4 sm:px-6 md:px-8 pt-4 pb-8 z-10">
            <div className="p-6 rounded-lg relative" style={{ backgroundColor: 'rgba(239, 237, 230, 0.85)', zIndex: 30 }}>
              <h3 className="font-serif text-xl text-text-dark mb-4" style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' }}>Пэринг:</h3>
              {wine.pairings.dishes && wine.pairings.dishes.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-sans text-sm font-semibold text-text-dark mb-2" style={{ textShadow: '0 1px 2px rgba(239, 237, 230, 0.85)' }}>Блюда:</h4>
                  <ul className="list-disc list-inside text-gray-700 font-light space-y-1">
                    {wine.pairings.dishes.map((dish, idx) => (
                      <li key={idx} style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.85)' }}>{dish}</li>
                    ))}
                  </ul>
                </div>
              )}
              {wine.pairings.notes && wine.pairings.notes.length > 0 && (
                <div>
                  <h4 className="font-sans text-sm font-semibold text-text-dark mb-2" style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.85)' }}>Заметки:</h4>
                  <ul className="list-disc list-inside text-gray-700 font-light space-y-1">
                    {wine.pairings.notes.map((note, idx) => (
                      <li key={idx} style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.85)' }}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
        </main>
      </div>
    </div>
  );
}

export default WineItemPage;
