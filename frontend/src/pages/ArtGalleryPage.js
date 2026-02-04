import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

/**
 * ArtGalleryPage - страница галереи картин в ресторане
 * 
 * Основные возможности:
 * - Masonry-сетка для отображения картин (адаптивная сетка)
 * - Фильтрация по залам ресторана (основной, банкетный, каминный и т.д.)
 * - Поиск по названию и автору картины
 * - Переход на детальную страницу при клике на картину
 */
function ArtGalleryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  
  // State для данных картин
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State для фильтров
  const [selectedLocation, setSelectedLocation] = useState('Все залы');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Функция для конвертации путей из JSON в правильные URL для React
  // JSON содержит пути типа "./images/arts/..." которые нужно преобразовать в "/images/arts/..."
  const fixImagePath = (path) => {
    if (!path) return '/images/placeholder.webp';
    // Убираем "./" в начале пути
    return path.replace(/^\.\//, '/');
  };

  // Загружаем данные о картинах из artworks.json
  useEffect(() => {
    const loadArtworks = async () => {
      try {
        const response = await fetch('/data/artworks.json');
        const data = await response.json();
        const artItems = Array.isArray(data) ? data : [];
        
        console.log('Найдено картин:', artItems.length);
        console.log('Первая картина:', artItems[0]);
        
        setArtworks(artItems);
        setLoading(false);
      } catch (error) {
        console.error('Ошибка загрузки данных о картинах:', error);
        toast.error('Не удалось загрузить галерею');
        setLoading(false);
      }
    };

    loadArtworks();
  }, [toast]);

  // Получаем уникальные залы из данных
  const locations = ['Все залы', ...new Set(artworks.map(art => art.location).filter(Boolean))];

  // Фильтрация картин по залу и поисковому запросу
  const filteredArtworks = artworks.filter(art => {
    // Фильтр по залу
    const locationMatch = selectedLocation === 'Все залы' || art.location === selectedLocation;
    
    // Фильтр по поисковому запросу (ищем в названии и авторе)
    const searchLower = searchQuery.toLowerCase();
    const searchMatch = !searchQuery || 
      art.title?.toLowerCase().includes(searchLower) ||
      art.author?.toLowerCase().includes(searchLower);
    
    return locationMatch && searchMatch;
  });

  // Функция для определения класса masonry-элемента
  // Распределяем картины по разным размерам для красивой сетки
  const getMasonryClass = (index) => {
    const patterns = ['masonry-item-tall', 'masonry-item-square', 'masonry-item-square', 'masonry-item-wide'];
    return patterns[index % patterns.length];
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка галереи...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background-light dark:bg-background-dark min-h-screen">
      {/* Фиксированный заголовок с кнопками */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#181311]/95 backdrop-blur-sm border-b border-orange-100/50 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Кнопка "Назад" - возвращает на страницу информации */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/info')}
              className="flex items-center justify-center size-10 rounded-full bg-white/20 dark:bg-black/20 hover:bg-orange-50 dark:hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[#181411] dark:text-white">arrow_back_ios_new</span>
            </button>
            <h1 className="text-lg font-extrabold tracking-tight text-[#181411] dark:text-white">
              Искусство в Sabor de la Vida
            </h1>
          </div>
          
          {/* Кнопка поиска */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center justify-center size-10 hover:bg-orange-50 dark:hover:bg-white/5 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-primary">
                {showSearch ? 'close' : 'search'}
              </span>
            </button>
          </div>
        </div>

        {/* Поисковая строка (показывается при нажатии на кнопку поиска) */}
        {showSearch && (
          <div className="px-4 pb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или автору..."
              className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-[#181411] dark:text-white border-none focus:ring-2 focus:ring-primary outline-none"
              autoFocus
            />
          </div>
        )}

        {/* Горизонтальный скролл с фильтрами по залам */}
        <div className="flex overflow-x-auto gap-6 px-6 pb-3 no-scrollbar">
          {locations.map((location) => (
            <button
              key={location}
              onClick={() => setSelectedLocation(location)}
              className="flex flex-col items-center gap-1 shrink-0 group"
            >
              <span 
                className={`text-sm font-bold transition-colors ${
                  selectedLocation === location 
                    ? 'text-primary' 
                    : 'text-[#8a7560] hover:text-primary'
                }`}
              >
                {location}
              </span>
              <div 
                className={`h-1 w-1 rounded-full ${
                  selectedLocation === location ? 'bg-primary' : 'bg-transparent'
                }`}
              />
            </button>
          ))}
        </div>
      </header>

      {/* Основной контент с masonry-сеткой */}
      <main className="pt-32 pb-24 px-4">
        {filteredArtworks.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
            <p className="text-lg">Картины не найдены</p>
            <p className="text-sm mt-2">Попробуйте изменить фильтры или поисковый запрос</p>
          </div>
        ) : (
          <div className="masonry-grid">
            {filteredArtworks.map((artwork, index) => {
              const imagePath = fixImagePath(artwork.image?.src);
              console.log(`Картина ${artwork.id}: ${imagePath}`);
              
              return (
                <div
                  key={artwork.id}
                  onClick={() => navigate(`/art/${artwork.id}`)}
                  className={`${getMasonryClass(index)} relative overflow-hidden rounded-xl shadow-lg group cursor-pointer`}
                >
                  {/* Изображение картины */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                    style={{ 
                      backgroundImage: `url("${imagePath}")`,
                      backgroundColor: '#f0f0f0' // Фон на случай, если изображение не загрузится
                    }}
                  />
                  
                  {/* Градиент для лучшей читаемости текста */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Информация о картине (название и автор) */}
                  <div className="absolute bottom-3 left-3 right-3 bg-white/70 dark:bg-black/70 backdrop-blur-md p-3 rounded-lg border-none">
                    <p className="text-xs font-bold text-[#181411] dark:text-white truncate">
                      {artwork.title}
                    </p>
                    <p className="text-[10px] text-[#8a7560] dark:text-gray-400">
                      {artwork.author}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}

export default ArtGalleryPage;
