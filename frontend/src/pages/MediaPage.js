import React, { useEffect, useMemo, useState } from 'react';
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
  X
} from 'lucide-react';
import mediaItems from '../data/mediaItems';
import { getJSON, setJSON, toggleInArray } from '../utils/storage';

const STORAGE_KEYS = {
  likes: 'media.likes',
  favorites: 'media.favorites',
  history: 'media.history',
  durations: 'media.durations'
};

const MediaPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [likes, setLikes] = useState(() => getJSON(STORAGE_KEYS.likes, []));
  const [favorites, setFavorites] = useState(() => getJSON(STORAGE_KEYS.favorites, []));
  const [history, setHistory] = useState(() => getJSON(STORAGE_KEYS.history, []));
  const [durations, setDurations] = useState(() => getJSON(STORAGE_KEYS.durations, {}));
  const [currentId, setCurrentId] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(true);
  const [notice, setNotice] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = React.useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(mediaItems);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setJSON(STORAGE_KEYS.likes, likes);
  }, [likes]);

  useEffect(() => {
    setJSON(STORAGE_KEYS.favorites, favorites);
  }, [favorites]);

  useEffect(() => {
    setJSON(STORAGE_KEYS.history, history);
  }, [history]);

  useEffect(() => {
    setJSON(STORAGE_KEYS.durations, durations);
  }, [durations]);

  useEffect(() => {
    if (!currentId && history.length > 0) {
      setCurrentId(history[0]);
    }
  }, [history, currentId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const player = audioRef.current;
    if (!player) return;
    player.pause();
    setIsPlaying(false);
    setCurrentTime(0);
  }, [currentId]);

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
    setCurrentTime(0);
  };

  const handleToggleLike = (itemId) => {
    setLikes((prev) => toggleInArray(prev, itemId));
  };

  const handleToggleFavorite = (itemId) => {
    setFavorites((prev) => toggleInArray(prev, itemId));
  };

  const handleDownload = () => {
    setNotice('Скачивание будет доступно позже.');
  };

  const handleShare = async (item) => {
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
      setNotice('Ссылка скопирована в буфер обмена.');
    } catch (err) {
      setNotice('Не удалось скопировать ссылку.');
    }
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
    setCurrentTime(event.currentTarget.currentTime || 0);
    setDurations((prev) => ({
      ...prev,
      [itemId]: Math.round(rawDuration)
    }));
  };

  const handleTimeUpdate = (event) => {
    setCurrentTime(event.currentTarget.currentTime || 0);
  };

  const handlePlayPause = () => {
    const player = audioRef.current;
    if (!player) return;
    if (player.paused) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (event) => {
    const player = audioRef.current;
    if (!player) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const ratio = clickX / rect.width;
    const duration = player.duration || durations[currentItem?.id] || 0;
    if (!duration) return;
    const nextTime = Math.min(Math.max(duration * ratio, 0), duration);
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
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
            onClick={() => navigate('/info')}
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

        {notice && (
          <div className="rounded-xl border border-orange-200/60 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            {notice}
          </div>
        )}

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
              const isLiked = likes.includes(item.id);
              const isFavorite = favorites.includes(item.id);
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
                      onClick={() => handleOpen(item)}
                      className="inline-flex items-center gap-2 rounded-full bg-orange-600 text-white text-xs font-semibold px-4 py-2 hover:bg-orange-500 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      Открыть
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleLike(item.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                        isLiked
                          ? 'border-rose-200 bg-rose-50 text-rose-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Heart className="h-4 w-4" />
                      {isLiked ? 'Лайк' : 'Лайкнуть'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(item.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                        isFavorite
                          ? 'border-yellow-200 bg-yellow-50 text-yellow-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Star className="h-4 w-4" />
                      {isFavorite ? 'В избранном' : 'В избранное'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
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

      {isMiniPlayerVisible && (
        <div className="sticky bottom-0 pb-3">
          <div className="mx-4 rounded-2xl bg-black/70 text-white backdrop-blur-sm border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/60">Мини‑плеер</p>
              <p className="text-sm font-semibold text-white">
                {currentItem ? currentItem.title : 'Выберите материал'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/15 text-white hover:bg-white/10 transition-colors"
                onClick={handlePlayPause}
                disabled={!currentItem}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/15 text-white hover:bg-white/10 transition-colors shadow-[0_0_16px_rgba(249,115,22,0.35)]"
                onClick={() => {
                  if (currentItem) handleOpen(currentItem);
                }}
              >
                <Play className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/15 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                onClick={() => setIsMiniPlayerVisible(false)}
                aria-label="Закрыть мини-плеер"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSeek}
            className="relative w-full h-1.5 bg-white/15"
          >
            <span
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
              style={{ width: `${progressPercent}%` }}
            />
          </button>
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
        onLoadedMetadata={(event) => handleDurationLoaded(currentItem?.id, event)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {isPlayerOpen && currentItem && (
        <div className="fixed inset-0 z-50 bg-[#0b0b0b] text-white">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setIsPlayerOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
                Свернуть
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="max-w-xl mx-auto flex flex-col items-center text-center gap-4">
                <div className="w-full aspect-square max-w-sm rounded-3xl overflow-hidden bg-white/10">
                  <img
                    src={currentItem.coverUrl || '/media/cover-placeholder.svg'}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>

                <div>
                  <h2 className="text-xl font-bold">{currentItem.title}</h2>
                  <p className="text-sm text-white/70 mt-2">{currentItem.description}</p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(durations[currentItem.id]) || currentItem.duration || 'Без длительности'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10">
                    {currentItem.level}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10">
                    {currentItem.category}
                  </span>
                </div>

                {currentItem.audioUrl && (
                  <div className="w-full space-y-4">
                    <div className="w-full">
                      <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                        <span>{formatDuration(currentTime) || '0:00'}</span>
                        <span>
                          {formatDuration(totalDuration) || '0:00'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSeek}
                        className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden"
                      >
                        <span
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                          style={{
                            width: `${Math.min(
                              100,
                              (currentTime /
                                (audioRef.current?.duration || durations[currentItem.id] || 1)) *
                                100
                            )}%`
                          }}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => shiftTime(-10)}
                        className="inline-flex items-center justify-center h-12 w-12 rounded-full border border-white/15 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Rewind className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-orange-500 text-white shadow-[0_0_24px_rgba(249,115,22,0.5)] hover:bg-orange-400 transition-colors"
                      >
                        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftTime(10)}
                        className="inline-flex items-center justify-center h-12 w-12 rounded-full border border-white/15 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Rewind className="h-5 w-5 rotate-180" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(currentItem.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      likes.includes(currentItem.id)
                        ? 'border-rose-200 bg-rose-500/20 text-rose-200'
                        : 'border-white/20 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Heart className="h-4 w-4" />
                    Лайк
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(currentItem.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      favorites.includes(currentItem.id)
                        ? 'border-yellow-200 bg-yellow-500/20 text-yellow-100'
                        : 'border-white/20 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Star className="h-4 w-4" />
                    Избранное
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Скачать
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare(currentItem)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition-colors"
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
