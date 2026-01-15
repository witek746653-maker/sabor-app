import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function WineMenuPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();

  const categories = [
    {
      id: 'by-glass',
      title: 'Вина по бокалам',
      description: 'Бокальные позиции',
      icon: 'wine_bar',
      color: 'bg-wine-red',
      image: null, // Можно добавить изображение позже
    },
    {
      id: 'coravin',
      title: 'Coravin',
      description: 'Премиальные вина',
      icon: 'local_bar',
      color: 'bg-custom-burgundy',
      image: null,
    },
    {
      id: 'half-bottles',
      title: 'Полубутылки',
      description: '375 мл',
      icon: 'inventory_2',
      color: 'bg-wine-red-light',
      image: null,
    },
  ];

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden pb-20 bg-background-light dark:bg-background-dark text-[#181311] dark:text-white font-display antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center bg-white/95 dark:bg-[#181311]/95 backdrop-blur-sm p-4 pb-2 justify-between border-b border-orange-100/50 dark:border-gray-800 shadow-sm transition-all">
        <button
          onClick={() => navigate(-1)}
          className="text-[#181311] dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-orange-50 dark:hover:bg-white/5 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-primary dark:text-primary text-xl font-black leading-tight tracking-tight flex-1 text-center uppercase">
          Вино
        </h2>
        <button className="text-[#181311] dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-orange-50 dark:hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[#181311] dark:text-white tracking-tight text-xl font-bold leading-tight">
              Выберите категорию
            </h2>
          </div>
          <p className="text-[#896f61] dark:text-gray-400 text-xs mt-1">
            Изучите нашу коллекцию вин
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 gap-4 px-4 pb-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/wine-catalog/${category.id}`}
              className="group relative overflow-hidden rounded-xl aspect-[16/6] shadow-lg active:scale-[0.98] transition-all duration-300"
            >
              {category.image ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url("${category.image}")` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                </>
              ) : (
                <div className={`absolute inset-0 ${category.color} flex items-center justify-center`}>
                  <span className="material-symbols-outlined text-white/20 text-8xl">
                    {category.icon}
                  </span>
                </div>
              )}
              {!category.image && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              )}
              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col justify-end h-full">
                <span className="material-symbols-outlined text-white mb-2 text-3xl opacity-90">
                  {category.icon}
                </span>
                <p className="text-white text-2xl font-bold leading-tight">{category.title}</p>
                {category.description && (
                  <p className="text-white/80 text-sm mt-1 font-medium uppercase tracking-wide">
                    {category.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 bg-white dark:bg-[#181311] border-t border-orange-100 dark:border-gray-800 pb-safe z-40 w-full sabor-fixed">
        <div className={`grid ${isAuthenticated && currentUser?.role === 'администратор' ? 'grid-cols-4' : 'grid-cols-3'} h-16`}>
          <Link
            to="/"
            className="flex flex-col items-center justify-center gap-1 text-primary"
          >
            <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
            <span className="text-[10px] font-medium">Меню</span>
          </Link>
          <button className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-2xl">favorite</span>
            <span className="text-[10px] font-medium">Избранное</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-2xl">new_releases</span>
            <span className="text-[10px] font-medium">Новинки</span>
          </button>
          {isAuthenticated && currentUser?.role === 'администратор' && (
            <Link
              to="/admin"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">person</span>
              <span className="text-[10px] font-medium">Профиль</span>
            </Link>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)] bg-white dark:bg-[#181311]" />
      </footer>
    </div>
  );
}

export default WineMenuPage;
