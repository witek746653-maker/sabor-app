import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Download,
  Headphones,
  Heart,
  Play,
  Pause,
  Rewind,
  Share2,
  Star,
  Video,
  X,
  MoreVertical,
  ChevronDown,
  FastForward
} from 'lucide-react';
import mediaItems from '../data/mediaItems';
import { getJSON, setJSON } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { getMediaLikes, toggleMediaLike } from '../services/api';
import { useFavorites } from '../contexts/FavoritesContext';
import { useToast } from '../contexts/ToastContext';

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5];

const STORAGE_KEYS = {
  history: 'media.history',
  durations: 'media.durations',
  progress: 'media.progress',
  playerState: 'media.playerState'
};

const MediaPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [likeCounts, setLikeCounts] = useState({});
  const [likedByMe, setLikedByMe] = useState({});
  const { mediaIds, toggleMediaFavorite } = useFavorites();
  const toast = useToast();
  const [history, setHistory] = useState(() => getJSON(STORAGE_KEYS.history, []));
  const [durations, setDurations] = useState(() => getJSON(STORAGE_KEYS.durations, {}));
  const savedPlayerState = getJSON(STORAGE_KEYS.playerState, {});
  const [currentId, setCurrentId] = useState(savedPlayerState.currentId || null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(
    savedPlayerState.isMiniPlayerVisible ?? true
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(savedPlayerState.playbackRate || 1);
  const [progressById, setProgressById] = useState(() => getJSON(STORAGE_KEYS.progress, {}));
  const [isSpeedMenuOpenMini, setIsSpeedMenuOpenMini] = useState(false);
  const [isSpeedMenuOpenFull, setIsSpeedMenuOpenFull] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [activeProgressElement, setActiveProgressElement] = useState(null);
  const [swipeStartY, setSwipeStartY] = useState(null);
  const [swipeCurrentY, setSwipeCurrentY] = useState(null);

  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const fullProgressRef = useRef(null);
  const fullPlayerRef = useRef(null);

  const { isAuthenticated, isGuest, canWrite } = useAuth();
  // В гостевом режиме скрываем маркер "в избранном", даже если он есть в хранилище.
  const effectiveFavorites = isGuest ? [] : mediaIds;

  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(mediaItems);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setJSON(STORAGE_KEYS.history, history);
  }, [history]);

  useEffect(() => {
    setJSON(STORAGE_KEYS.durations, durations);
  }, [durations]);

  useEffect(() => {
    setJSON(STORAGE_KEYS.progress, progressById);
  }, [progressById]);

  useEffect(() => {
    setJSON(STORAGE_KEYS.playerState, {
      currentId,
      isMiniPlayerVisible,
      playbackRate
    });
  }, [currentId, isMiniPlayerVisible, playbackRate]);

  useEffect(() => {
    const loadLikes = async () => {
      if (!isAuthenticated) {
        setLikeCounts({});
        setLikedByMe({});
        return;
      }
      const ids = (items || []).map((it) => it?.id).filter(Boolean);
      if (!ids.length) return;
      try {
        const data = await getMediaLikes(ids);
        setLikeCounts(data?.counts || {});
        setLikedByMe(data?.likedByMe || {});
      } catch (error) {
        console.warn('Не удалось загрузить лайки медиа:', error);
      }
    };
    loadLikes();
  }, [isAuthenticated, items]);

  useEffect(() => {
    if (!currentId && history.length > 0) {
      setCurrentId(history[0]);
    }
  }, [history, currentId]);

  useEffect(() => {
    const player = audioRef.current;
    if (!player) return;

    // ВАЖНО: Мы НЕ вызываем player.pause() здесь при каждом обновлении прогресса.
    // Теперь этот эффект срабатывает только при смене самого подкаста (currentId).
    if (currentId) {
      player.pause();
      setIsPlaying(false);

      // Применяем выбранную скорость при смене трека.
      player.playbackRate = playbackRate;

      const savedProgress = progressById[currentId];
      // Безопасно вычисляем время начала
      const safeProgress = Math.min(Math.max(savedProgress || 0, 0), player.duration || 0);

      // Если метаданные уже загружены, можем установить время сразу.
      // Но основной сброс времени будет происходить в handleDurationLoaded.
      if (Number.isFinite(player.duration) && player.duration > 0) {
        player.currentTime = safeProgress;
      }
      setCurrentTime(safeProgress);
    }
  }, [currentId]);

  const handleBack = () => {
    if (sessionStorage.getItem('fromSearch') === 'true') {
      sessionStorage.removeItem('fromSearch');
      navigate('/search');
    } else {
      navigate('/info', { replace: true });
    }
  };

  useEffect(() => {
    const player = audioRef.current;
    if (!player) return;
    // Держим скорость плеера в синхроне с выбором.
    player.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    // Блокируем прокрутку страницы, пока открыт полноэкранный плеер.
    if (isPlayerOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isPlayerOpen]);

  // Обработка глобальных событий для перетаскивания прогресс-бара
  useEffect(() => {
    if (!isDraggingProgress) return undefined;

    const handleGlobalMove = (event) => {
      handleProgressMove(event);
    };

    const handleGlobalEnd = () => {
      handleProgressEnd();
    };

    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchmove', handleGlobalMove);
    document.addEventListener('touchend', handleGlobalEnd);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDraggingProgress]);

  const currentItem = useMemo(() => {
    if (!items.length) return null;
    return items.find((item) => item.id === currentId) || items[0];
  }, [items, currentId]);

  const handleOpen = (item) => {
    setCurrentId(item.id);
    setHistory((prev) => {
      const next = [item.id, ...prev.filter((id) => id !== item.id)];
      return next.slice(0, 20);
    });
    setIsPlayerOpen(true);
    setIsMiniPlayerVisible(true);
    setIsPlaying(false);
    setIsSpeedMenuOpenMini(false);
    setIsSpeedMenuOpenFull(false);
  };

  const handleToggleLike = async (itemId) => {
    if (!canWrite) {
      toast.info('Лайки доступны только после входа (не гость).');
      return;
    }
    const prevLiked = Boolean(likedByMe[itemId]);
    const prevCount = Number(likeCounts[itemId] || 0);
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    // Optimistic UI: обновляем сразу
    setLikedByMe((prev) => ({ ...prev, [itemId]: nextLiked }));
    setLikeCounts((prev) => ({ ...prev, [itemId]: nextCount }));

    try {
      const result = await toggleMediaLike(itemId);
      setLikedByMe((prev) => ({ ...prev, [itemId]: Boolean(result?.likedByMe) }));
      setLikeCounts((prev) => ({ ...prev, [itemId]: Number(result?.count || 0) }));
    } catch (error) {
      // Откат при ошибке
      setLikedByMe((prev) => ({ ...prev, [itemId]: prevLiked }));
      setLikeCounts((prev) => ({ ...prev, [itemId]: prevCount }));
      toast.error('Не удалось обновить лайк. Попробуйте ещё раз.');
    }
  };

  const handleToggleFavorite = (itemId) => {
    if (isGuest) {
      // Гостю нельзя добавлять в избранное.
      toast.info('Избранное доступно только после входа.');
      return;
    }
    toggleMediaFavorite(itemId);
  };

  const handleDownload = (item) => {
    if (!item) return;
    if (!isAuthenticated || isGuest) {
      toast.info('Действие доступно только после входа');
      return;
    }
    const fileUrl = item.audioUrl || item.videoUrl;
    if (!fileUrl) {
      toast.error('Файл для скачивания не найден.');
      return;
    }
    // Создаём скрытую ссылку и запускаем скачивание.
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = '';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleShare = async (item) => {
    if (isGuest) {
      toast.info('Действие доступно только после входа');
      return;
    }
    const shareUrl = window.location.href;
    const shareData = {
      title: item.title,
      text: item.description,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // Пользователь отменил или браузер не поддержал.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Ссылка скопирована в буфер обмена.');
    } catch (err) {
      toast.error('Не удалось скопировать ссылку.');
    }
  };

  const clampProgress = (progress, duration) => {
    if (!Number.isFinite(progress) || progress < 0) return 0;
    if (!Number.isFinite(duration) || duration <= 0) return progress;
    const maxTime = Math.max(duration - 0.5, 0);
    return progress > maxTime ? 0 : Math.min(progress, maxTime);
  };

  const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remaining = totalSeconds % 60;
    const padded = remaining < 10 ? `0${remaining}` : `${remaining}`;
    return `${minutes}:${padded}`;
  };

  const handleDurationLoaded = (itemId, event) => {
    const rawDuration = event.currentTarget.duration;
    if (!Number.isFinite(rawDuration) || rawDuration <= 0) return;
    const savedProgress = progressById[itemId];
    const safeProgress = clampProgress(savedProgress, rawDuration);
    event.currentTarget.currentTime = safeProgress;
    setCurrentTime(safeProgress);
    setDurations((prev) => ({
      ...prev,
      [itemId]: Math.round(rawDuration)
    }));
    if (safeProgress !== (Number.isFinite(savedProgress) ? savedProgress : 0)) {
      // Подстраховка: сохраняем скорректированную позицию.
      setProgressById((prev) => ({ ...prev, [itemId]: safeProgress }));
    }
  };

  const handleTimeUpdate = (event) => {
    const nextTime = event.currentTarget.currentTime || 0;
    setCurrentTime(nextTime);
    if (currentId) {
      // Сохраняем прогресс, чтобы продолжить с того же места после перезагрузки.
      setProgressById((prev) => ({ ...prev, [currentId]: nextTime }));
    }
  };

  const handlePlayPause = () => {
    const player = audioRef.current;
    if (!player) return;
    if (player.paused) {
      // Запускаем воспроизведение; состояние обновится через события плеера.
      const playPromise = player.play();
      if (playPromise?.catch) {
        playPromise.catch(() => setIsPlaying(false));
      }
    } else {
      player.pause();
    }
  };

  const handleSetPlaybackRate = (rate) => {
    setPlaybackRate(rate);
    const player = audioRef.current;
    if (player) {
      // Применяем новую скорость к аудио.
      player.playbackRate = rate;
    }
    setIsSpeedMenuOpenMini(false);
    setIsSpeedMenuOpenFull(false);
  };

  const handleCloseMiniPlayer = () => {
    const player = audioRef.current;
    if (!player) return;
    // Останавливаем звук и прячем мини‑плеер.
    player.pause();
    setIsPlaying(false);
    setIsMiniPlayerVisible(false);
  };

  const handleSeek = (event, targetElement) => {
    const player = audioRef.current;
    if (!player) return;

    // Используем переданный элемент или ищем через ref
    const element = targetElement || event.currentTarget || progressRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0]?.clientX);
    if (!clientX) return;
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const duration = player.duration || durations[currentItem?.id] || 0;
    if (!duration) return;
    const nextTime = duration * ratio;
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  // Обработка перетаскивания прогресс-бара (scrubbing)
  const handleProgressMouseDown = (event) => {
    const element = event.currentTarget;
    setActiveProgressElement(element);
    setIsDraggingProgress(true);
    handleSeek(event, element);
  };

  const handleProgressTouchStart = (event) => {
    const element = event.currentTarget;
    setActiveProgressElement(element);
    setIsDraggingProgress(true);
    handleSeek(event, element);
  };

  const handleProgressMove = (event) => {
    if (!isDraggingProgress || !activeProgressElement) return;
    // Используем сохранённый активный элемент
    handleSeek(event, activeProgressElement);
  };

  const handleProgressEnd = () => {
    setIsDraggingProgress(false);
    setActiveProgressElement(null);
  };

  // Обработка swipe-жеста для сворачивания полноэкранного плеера
  const handleSwipeStart = (event) => {
    const clientY = event.clientY || event.touches?.[0]?.clientY;
    if (clientY) {
      setSwipeStartY(clientY);
      setSwipeCurrentY(clientY);
    }
  };

  const handleSwipeMove = (event) => {
    if (swipeStartY === null) return;
    const clientY = event.clientY || event.touches?.[0]?.clientY;
    if (clientY) {
      setSwipeCurrentY(clientY);
    }
  };

  const handleSwipeEnd = () => {
    if (swipeStartY === null || swipeCurrentY === null) {
      setSwipeStartY(null);
      setSwipeCurrentY(null);
      return;
    }

    const deltaY = swipeCurrentY - swipeStartY;
    // Если свайп вниз больше 100px, сворачиваем плеер
    if (deltaY > 100) {
      setIsPlayerOpen(false);
    }

    setSwipeStartY(null);
    setSwipeCurrentY(null);
  };

  const shiftTime = (seconds) => {
    const player = audioRef.current;
    if (!player) return;
    const duration = player.duration || durations[currentItem?.id] || 0;
    const nextTime = Math.min(Math.max((player.currentTime || 0) + seconds, 0), duration || 0);
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const getTypeIcon = (type) => {
    if (type === 'video') return Video;
    if (type === 'podcast') return Headphones;
    return Play;
  };

  const isEmpty = !loading && items.length === 0;
  const totalDuration = audioRef.current?.duration || durations[currentItem?.id] || 0;
  const progressPercent = totalDuration
    ? Math.min(100, (currentTime / totalDuration) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#181311] text-[#181311] dark:text-white font-display">
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#181311]/95 backdrop-blur-sm border-b border-orange-100/60 dark:border-gray-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={handleBack}

            className="flex items-center justify-center size-10 rounded-full hover:bg-orange-50 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Медиа-обучение</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Видео, подкасты и гайды</p>
          </div>
        </div>
      </header>

      <main className="px-4 pb-28 pt-4 space-y-6">
        <section className="rounded-2xl border border-orange-100/60 dark:border-gray-800 bg-orange-50/60 dark:bg-[#1b1412] p-5">
          <div className="flex flex-col gap-4">
            <div className="w-full overflow-hidden rounded-2xl border border-orange-100/60">
              <img
                src="/images/media-head.jpg"
                alt="Медиа-обучение"
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-orange-600 bg-white/70 dark:bg-white/10 px-3 py-1 rounded-full w-fit">
              <Play className="h-4 w-4" />
              Учимся быстро и просто
            </div>
            <h2 className="text-2xl font-bold leading-tight">
              Медиабиблиотека для обучения
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Здесь собраны видео и аудио‑заметки.
            </p>
          </div>
        </section>

        {loading && (
          <section className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-orange-100/60 dark:border-gray-800 bg-white dark:bg-[#1b1412] p-4"
              >
                <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </section>
        )}

        {isEmpty && (
          <section className="rounded-2xl border border-dashed border-orange-200 dark:border-gray-700 p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Пока нет материалов. Добавьте новые медиа или вернитесь позже.
            </p>
          </section>
        )}

        {!loading && !isEmpty && (
          <section className="space-y-3">
            {items.map((item) => {
              const Icon = getTypeIcon(item.type);
              const isLiked = Boolean(likedByMe[item.id]);
              const likeCount = Number(likeCounts[item.id] || 0);
              const isFavorite = effectiveFavorites.includes(item.id);
              const durationLabel =
                formatDuration(durations[item.id]) ||
                item.duration ||
                'Без длительности';
              const coverUrl = item.coverUrl || '/media/cover-placeholder.svg';

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-orange-100/60 dark:border-gray-800 bg-white dark:bg-[#1b1412] p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 rounded-2xl overflow-hidden border border-orange-100/70 bg-orange-50 flex items-center justify-center">
                      <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className="text-left text-base font-semibold transition-all duration-200 hover:text-orange-600 hover:underline active:text-orange-700 active:scale-[0.98]"
                      >
                        {item.title}
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {durationLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                          {item.level}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(item.id)}
                      disabled={!canWrite}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isLiked
                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <Heart className="h-4 w-4" />
                      {isLiked ? 'Лайк' : 'Лайкнуть'}
                      {isAuthenticated && (
                        <span className="text-[11px] text-gray-500">· {likeCount}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(item.id)}
                      disabled={isGuest}
                      title={isGuest ? 'Доступно после входа' : undefined}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isFavorite
                        ? 'border-yellow-200 bg-yellow-50 text-yellow-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <Star className="h-4 w-4" />
                      {isFavorite ? 'В избранном' : 'В избранное'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Скачать
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(item)}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Share2 className="h-4 w-4" />
                      Поделиться
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {isMiniPlayerVisible && currentItem && !isPlayerOpen && (
        <div className="fixed bottom-0 left-0 right-0 pb-3 px-4 z-40 animate-fadeInUp">
          <div className="rounded-2xl bg-black/80 text-white backdrop-blur-md border border-white/20 shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
            {/* Кликабельная область для разворачивания плеера */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (currentItem) {
                  setIsPlayerOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (currentItem) {
                    setIsPlayerOpen(true);
                  }
                }
              }}
              className="w-full px-4 pt-3 pb-2 text-left hover:bg-white/5 transition-all duration-200 rounded-t-2xl active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-white/60 mb-1">
                    Сейчас играет
                  </p>
                  <p className="text-sm font-semibold text-white truncate">
                    {currentItem.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-12 w-12 rounded-full border border-white/20 text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPause();
                    }}
                    disabled={!currentItem}
                    aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-12 w-12 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseMiniPlayer();
                    }}
                    aria-label="Закрыть мини-плеер"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Полоса воспроизведения с поддержкой перетаскивания */}
            <div
              ref={progressRef}
              className="relative w-full h-2 bg-white/15 cursor-pointer touch-none"
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
            >
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_12px_rgba(249,115,22,0.6)] transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Ползунок для лучшей видимости */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all duration-75"
                style={{ left: `calc(${progressPercent}% - 6px)` }}
              />
            </div>

            {/* Время воспроизведения */}
            <div className="px-4 pb-2 pt-2 flex items-center justify-between text-[11px] text-white/60">
              <span>{formatDuration(currentTime) || '0:00'}</span>
              <span>{formatDuration(totalDuration) || '0:00'}</span>
            </div>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        src={currentItem?.audioUrl || ''}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(event) => handleDurationLoaded(currentItem?.id, event)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onError={() => toast.error('Не удалось загрузить аудио. Проверьте файл.')}
        className="hidden"
      />

      {isPlayerOpen && currentItem && (
        <div
          className="fixed inset-0 z-50 bg-[#0b0b0b] text-white animate-slideUp"
          ref={fullPlayerRef}
          onMouseDown={handleSwipeStart}
          onMouseMove={handleSwipeMove}
          onMouseUp={handleSwipeEnd}
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={handleSwipeEnd}
          style={{
            transform: swipeStartY !== null && swipeCurrentY !== null && swipeCurrentY > swipeStartY
              ? `translateY(${Math.min(swipeCurrentY - swipeStartY, 300)}px)`
              : 'translateY(0)',
            transition: swipeStartY === null ? 'transform 0.3s ease-out' : 'none'
          }}
        >
          <div className="flex flex-col h-full">
            {/* Шапка с кнопкой свернуть */}
            <div className="flex items-center justify-between px-4 py-4">
              <button
                type="button"
                onClick={() => setIsPlayerOpen(false)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/20 text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                aria-label="Свернуть плеер"
              >
                <ChevronDown className="h-6 w-6" />
              </button>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Воспроизведение
              </p>
              <div className="w-10" />
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="max-w-xl mx-auto flex flex-col items-center text-center gap-6">
                {/* Обложка */}
                <div className="w-full aspect-square max-w-sm rounded-3xl overflow-hidden bg-white/10 shadow-2xl">
                  <img
                    src={currentItem.coverUrl || '/media/cover-placeholder.svg'}
                    alt={currentItem.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Информация о треке */}
                <div className="w-full px-4">
                  <h2 className="text-2xl font-bold mb-2">{currentItem.title}</h2>
                  <p className="text-sm text-white/70">{currentItem.description}</p>
                </div>

                {/* Метаданные */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(durations[currentItem.id]) || currentItem.duration || 'Без длительности'}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-white/10">
                    {currentItem.level}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-white/10">
                    {currentItem.category}
                  </span>
                </div>

                {currentItem.audioUrl && (
                  <div className="w-full space-y-6 mt-4">
                    {/* Полоса воспроизведения */}
                    <div className="w-full px-2">
                      <div className="flex items-center justify-between text-xs text-white/60 mb-3">
                        <span>{formatDuration(currentTime) || '0:00'}</span>
                        <span>{formatDuration(totalDuration) || '0:00'}</span>
                      </div>
                      <div
                        ref={fullProgressRef}
                        className="relative w-full h-1.5 rounded-full bg-white/20 cursor-pointer touch-none"
                        onMouseDown={handleProgressMouseDown}
                        onTouchStart={handleProgressTouchStart}
                      >
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_12px_rgba(249,115,22,0.6)] transition-all duration-75"
                          style={{ width: `${progressPercent}%` }}
                        />
                        {/* Ползунок */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-75"
                          style={{ left: `calc(${progressPercent}% - 8px)` }}
                        />
                      </div>
                    </div>

                    {/* Панель управления */}
                    <div className="flex items-center justify-center gap-3">
                      {/* Кнопка Избранное */}
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(currentItem.id)}
                        disabled={isGuest}
                        title={isGuest ? 'Доступно после входа' : undefined}
                        className={`inline-flex items-center justify-center h-14 w-14 rounded-full border transition-all active:scale-95 touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed ${effectiveFavorites.includes(currentItem.id)
                          ? 'border-yellow-400 bg-yellow-500/20 text-yellow-400'
                          : 'border-white/20 text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        aria-label="Добавить в избранное"
                      >
                        <Heart className={`h-5 w-5 ${effectiveFavorites.includes(currentItem.id) ? 'fill-current' : ''}`} />
                      </button>

                      {/* Кнопка Перемотка назад */}
                      <button
                        type="button"
                        onClick={() => shiftTime(-10)}
                        className="inline-flex items-center justify-center h-14 w-14 rounded-full border border-white/20 text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                        aria-label="Назад на 10 секунд"
                      >
                        <Rewind className="h-6 w-6" />
                      </button>

                      {/* Кнопка Play/Pause */}
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-orange-500 text-white shadow-[0_0_24px_rgba(249,115,22,0.5)] hover:bg-orange-400 active:scale-95 transition-all touch-manipulation"
                        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                      >
                        {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                      </button>

                      {/* Кнопка Перемотка вперёд */}
                      <button
                        type="button"
                        onClick={() => shiftTime(10)}
                        className="inline-flex items-center justify-center h-14 w-14 rounded-full border border-white/20 text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                        aria-label="Вперёд на 10 секунд"
                      >
                        <FastForward className="h-6 w-6" />
                      </button>

                      {/* Кнопка Три точки (Скорость) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsSpeedMenuOpenFull((prev) => !prev)}
                          className="inline-flex items-center justify-center h-14 w-14 rounded-full border border-white/20 text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                          aria-label="Скорость воспроизведения"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {isSpeedMenuOpenFull && (
                          <div className="absolute right-0 bottom-16 z-50 w-44 rounded-xl border border-white/20 bg-[#0b0b0b]/95 backdrop-blur-sm p-2 text-sm text-white shadow-2xl animate-menuFadeIn">
                            <p className="px-3 py-2 text-[10px] uppercase tracking-wide text-white/60">
                              Скорость воспроизведения
                            </p>
                            {PLAYBACK_RATES.map((rate) => {
                              const label = rate === 1 ? 'Нормальная' : `${rate}x`;
                              const isActive = rate === playbackRate;
                              return (
                                <button
                                  key={rate}
                                  type="button"
                                  onClick={() => handleSetPlaybackRate(rate)}
                                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-all active:scale-95 ${isActive
                                    ? 'bg-orange-500/20 text-orange-400 font-semibold'
                                    : 'hover:bg-white/10 text-white/80'
                                    }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Дополнительные действия */}
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(currentItem.id)}
                    disabled={!canWrite}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition-all active:scale-95 touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed ${likedByMe[currentItem.id]
                      ? 'border-rose-400 bg-rose-500/20 text-rose-400'
                      : 'border-white/20 text-white/80 hover:bg-white/10'
                      }`}
                  >
                    <Heart className={`h-4 w-4 ${likedByMe[currentItem.id] ? 'fill-current' : ''}`} />
                    Лайк
                    {isAuthenticated && (
                      <span className="text-[11px] text-white/70">
                        · {Number(likeCounts[currentItem.id] || 0)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(currentItem)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                  >
                    <Download className="h-4 w-4" />
                    Скачать
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare(currentItem)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
                  >
                    <Share2 className="h-4 w-4" />
                    Поделиться
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPage;
