import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useFavorites } from '../contexts/FavoritesContext';

/**
 * ArtDetailPage - детальная страница просмотра картины
 * 
 * Функционал:
 * - Отображение полной информации о картине
 * - Кнопка "Назад" для возврата в галерею
 * - Кнопка "Избранное" (сердечко) для добавления/удаления из избранного
 * - Кнопка "Поделиться" для отправки информации о картине через Web Share API
 */
function ArtDetailPage() {
  const { id } = useParams(); // id картины из URL
  const navigate = useNavigate();
  const toast = useToast();
  const { isGuest } = useAuth();
  const { catalogIds, toggleCatalogFavorite } = useFavorites();

  // State для данных картины
  const [artwork, setArtwork] = useState(null);
  const [loading, setLoading] = useState(true);

  const isLiked = catalogIds.includes(id);

  // Функция для конвертации путей из JSON в правильные URL для React
  const fixImagePath = (path) => {
    if (!path) return '/images/placeholder.webp';
    return path.replace(/^\.\//, '/');
  };

  // Загружаем данные о картине
  useEffect(() => {
    const loadArtwork = async () => {
      try {
        // Загружаем JSON с данными картин
        const response = await fetch('/data/artworks.json');
        const data = await response.json();

        // Находим нужную картину по id
        const artItem = data.find(item => item.id === id);

        if (!artItem) {
          console.log('Картина не найдена, id:', id);
          toast.error('Картина не найдена');
          navigate('/art-gallery');
          return;
        }

        console.log('Загружена картина:', artItem);

        setArtwork(artItem);
        setLoading(false);

        // Статус избранного берём из контекста (сервер + локальный кэш)
      } catch (error) {
        console.error('Ошибка загрузки данных о картине:', error);
        toast.error('Не удалось загрузить информацию о картине');
        setLoading(false);
      }
    };

    loadArtwork();
  }, [id, navigate, toast]);

  // Функция добавления/удаления из избранного
  // localStorage - это хранилище данных в браузере, которое сохраняется даже после закрытия вкладки
  const handleToggleFavorite = () => {
    if (isGuest) {
      // Гостю нельзя добавлять в избранное.
      toast.error('Избранное доступно только после входа');
      return;
    }
    toggleCatalogFavorite(id);
    toast.success(isLiked ? 'Картина удалена из избранного' : 'Картина добавлена в избранное');
  };

  // Функция отправки информации о картине через Web Share API
  // Web Share API - это браузерный API, который позволяет делиться контентом через установленные приложения
  const handleShare = async () => {
    if (!artwork) return;
    if (isGuest) {
      toast.info('Действие доступно только после входа');
      return;
    }

    // Формируем текст для отправки
    const shareText = `${artwork.title}\n${artwork.author} (${artwork.year || 'год неизвестен'})\n\n${artwork.description}`;
    const shareUrl = window.location.href;

    // Проверяем, поддерживает ли браузер Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: artwork.title,
          text: shareText,
          url: shareUrl
        });
        // Важно: Web Share API НЕ сообщает, отправил ли пользователь реально.
        // Promise часто завершается успешно сразу после открытия окна "Поделиться",
        // поэтому не показываем "успех", чтобы не вводить в заблуждение.
      } catch (error) {
        // Ошибка может возникнуть, если пользователь отменил отправку
        if (error.name !== 'AbortError') {
          console.error('Ошибка при отправке:', error);
          // Fallback: копируем ссылку в буфер обмена
          handleCopyLink();
        }
      }
    } else {
      // Если Web Share API не поддерживается - копируем ссылку
      handleCopyLink();
    }
  };

  // Fallback-функция для копирования ссылки в буфер обмена
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Ссылка скопирована в буфер обмена');
    } catch (error) {
      console.error('Ошибка копирования ссылки:', error);
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleBack = () => {
    if (sessionStorage.getItem('fromSearch') === 'true') {
      sessionStorage.removeItem('fromSearch');
      navigate('/search');
    } else {
      navigate('/art-gallery');
    }
  };



  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  if (!artwork) {
    return null;
  }

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto overflow-hidden bg-black/10 backdrop-blur-sm">
      {/* Размытый фон для создания эффекта глубины */}
      <div className="fixed inset-0 z-0 bg-blur-underlay opacity-40">
        <div className="grid grid-cols-2 gap-4 p-4">
          <div className="h-64 bg-primary/20 rounded-xl"></div>
          <div className="h-64 bg-primary/10 rounded-xl"></div>
          <div className="h-64 bg-primary/30 rounded-xl"></div>
          <div className="h-64 bg-primary/20 rounded-xl"></div>
        </div>
      </div>

      {/* Верхняя панель с кнопками */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-6">
        {/* Кнопка "Назад" - возврат в галерею */}
        <button
          onClick={handleBack}
          className="flex size-10 items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>


        {/* Кнопка "Поделиться" */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex size-10 items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors"
          >
            <span className="material-symbols-outlined">share</span>
          </button>
        </div>
      </div>

      {/* Секция с изображением картины */}
      <div className="relative w-full h-[55%] flex items-center justify-center overflow-hidden">
        <div
          className="w-full h-full bg-center bg-cover"
          style={{ backgroundImage: `url("${fixImagePath(artwork.image?.src)}")` }}
        />

        {/* Кнопка "Избранное" (сердечко) */}
        <button
          onClick={handleToggleFavorite}
          disabled={isGuest}
          title={isGuest ? 'Доступно после входа' : undefined}
          className="absolute bottom-10 right-6 flex size-14 items-center justify-center bg-primary rounded-full shadow-lg shadow-primary/40 text-white transform hover:scale-105 transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontVariationSettings: `'FILL' ${isLiked ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`
            }}
          >
            {isLiked ? 'heart_check' : 'favorite'}
          </span>
        </button>
      </div>

      {/* Панель с детальной информацией */}
      <div className="bg-white/40 dark:bg-[#181311]/40 backdrop-blur-xl flex-1 flex flex-col rounded-t-[2.5rem] mt-[-2rem] relative z-20 overflow-hidden border border-white/30">
        {/* Индикатор для drag-down жеста (визуальный элемент) */}
        <div className="flex w-full items-center justify-center py-4">
          <div className="h-1.5 w-12 rounded-full bg-[#3E2723]/20"></div>
        </div>

        {/* Скроллируемый контент */}
        <div className="flex-1 overflow-y-auto px-6 pb-12 pt-2 no-scrollbar">
          {/* Заголовок - название картины */}
          <div className="mb-2">
            <h1 className="text-[#3E2723] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">
              {artwork.title}
            </h1>

            {/* Информация об авторе, стране и годе */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-primary font-bold text-lg">{artwork.author}</span>
              <span className="h-1 w-1 rounded-full bg-[#3E2723]/30"></span>
              <span className="text-[#5D4037] dark:text-gray-400 font-medium text-sm">
                {artwork.origin} {artwork.year && `· ${artwork.year}`}
              </span>
            </div>
          </div>

          {/* Теги (художественное движение, расположение в ресторане) */}
          <div className="flex flex-wrap gap-2 my-6">
            {artwork.artMovement && (
              <div className="px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  {artwork.artMovement}
                </span>
              </div>
            )}
            {artwork.location && (
              <div className="px-3 py-1.5 bg-[#3E2723]/5 rounded-full border border-[#3E2723]/10">
                <span className="text-xs font-bold text-[#5D4037] dark:text-gray-300 uppercase tracking-wider">
                  {artwork.location}
                </span>
              </div>
            )}
          </div>

          {/* Описание картины */}
          {artwork.description && (
            <>
              <h2 className="text-[#3E2723] dark:text-white text-sm font-extrabold uppercase tracking-widest mb-3 opacity-60">
                О картине
              </h2>
              <p className="text-[#5D4037] dark:text-gray-300 leading-relaxed text-[15px] mb-6">
                {artwork.description}
              </p>
            </>
          )}

          {/* Комментарии */}
          {artwork.comments && String(artwork.comments).trim() && (
            <p className="text-[#5D4037] dark:text-gray-300 leading-relaxed text-[15px] mb-6 italic">
              {artwork.comments}
            </p>
          )}

          {/* Особенности */}
          {artwork.features && (
            <>
              <h2 className="text-[#3E2723] dark:text-white text-sm font-extrabold uppercase tracking-widest mb-3 opacity-60">
                Особенности
              </h2>
              <p className="text-[#5D4037] dark:text-gray-300 leading-relaxed text-[15px] mb-6">
                {artwork.features}
              </p>
            </>
          )}

          {/* Связь с брендом ресторана */}
          {artwork.brandRelevance && (
            <>
              <h2 className="text-[#3E2723] dark:text-white text-sm font-extrabold uppercase tracking-widest mb-3 opacity-60">
                Почему эта картина в Sabor de la Vida
              </h2>
              <p className="text-[#5D4037] dark:text-gray-300 leading-relaxed text-[15px] mb-8">
                {artwork.brandRelevance}
              </p>
            </>
          )}
        </div>

        {/* Отступ для безопасной зоны iOS (home indicator) */}
        <div className="h-8 bg-white/40 dark:bg-[#181311]/40 backdrop-blur-xl border-t-0 shrink-0"></div>
      </div>

    </div>
  );
}

export default ArtDetailPage;
