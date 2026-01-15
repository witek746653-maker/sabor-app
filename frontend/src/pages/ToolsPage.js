import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ComingSoonWrapper from '../components/ComingSoonWrapper';
import { isComingSoon } from '../utils/featureStatus';

function ToolsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [showPdfModal, setShowPdfModal] = useState(false);
  const pdfPath = '/menus/kompleks_dlya_novyh_sotrudnikov_01_12_2025.pdf.pdf';
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('menuLanguage') || 'RU';
  });
  
  // Определяем базовый URL для файлов
  // HTML файлы находятся в public/ и обслуживаются через React dev server (разработка) или веб-сервер (продакшен)
  // React dev server автоматически обслуживает файлы из папки public/, поэтому используем window.location.origin
  const getBaseUrl = () => {
    // Всегда используем текущий origin - это будет работать и в режиме разработки, и в продакшене
    // В режиме разработки React dev server (обычно порт 3000) автоматически обслуживает файлы из public/
    // В продакшене файлы из public/ обслуживаются веб-сервером
    return window.location.origin;
  };

  // Функция для получения иконки по названию инструмента
  const getToolIcon = (toolName) => {
    const toolLower = toolName.toLowerCase();
    if (toolLower.includes('база данных') || toolLower.includes('официант')) return 'database';
    if (toolLower.includes('справочник')) return 'menu_book';
    if (toolLower.includes('искусство')) return 'palette';
    if (toolLower.includes('тренажер')) return 'fitness_center';
    if (toolLower.includes('сигар') || toolLower.includes('энциклопед')) return 'smoking_rooms';
    if (toolLower.includes('комплекс') || toolLower.includes('сотрудник')) return 'business_center';
    return 'build';
  };

  // Функция для получения описания инструмента
  const getToolDescription = (toolName) => {
    const toolLower = toolName.toLowerCase();
    if (toolLower.includes('база данных')) return 'Полная информация о блюдах';
    if (toolLower.includes('справочник')) return 'Справочные материалы';
    if (toolLower.includes('искусство')) return 'Художественные работы';
    if (toolLower.includes('тренажер')) return 'Обучение и практика';
    if (toolLower.includes('сигар')) return 'Энциклопедия сигар';
    if (toolLower.includes('комплекс')) return 'Внутренние ресурсы';
    return '';
  };

  // Функция для получения изображения инструмента (если есть)
  const getToolImage = (toolName) => {
    const toolLower = toolName.toLowerCase();
    if (toolLower.includes('справочник')) {
      return '/images/waiter-guide-head.webp';
    }
    if (toolLower.includes('искусство')) {
      return '/images/art-head.webp';
    }
    if (toolLower.includes('сигар')) {
      return '/images/cigars-head.webp';
    }
    return null;
  };

  // Функция для обработки клика по инструменту
  const handleToolClick = (e, tool) => {
    // Если инструмент в разработке, перехватываем клик
    if (tool.comingSoon) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Предотвращаем перехват React Router
    e.preventDefault();
    e.stopPropagation();
    
    if (tool.type === 'pdf') {
      // Показываем модальное окно для PDF
      setShowPdfModal(true);
    } else if (tool.type === 'html') {
      // Открываем HTML файл напрямую, обходя React Router
      const baseUrl = getBaseUrl();
      const fullUrl = baseUrl + tool.path;
      
      // Создаем временную ссылку и программно кликаем по ней
      // Это гарантированно обходит React Router
      const link = document.createElement('a');
      link.href = fullUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Функции для работы с PDF
  const handlePdfOpen = () => {
    // Используем полный URL для обхода React Router
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl + pdfPath;
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
    setShowPdfModal(false);
  };

  const handlePdfDownload = () => {
    // Создаем ссылку для скачивания с полным URL
    const baseUrl = getBaseUrl();
    const link = document.createElement('a');
    link.href = baseUrl + pdfPath;
    link.download = 'Комплекс для новых сотрудников от 01.12.2025.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowPdfModal(false);
  };

  const handlePdfShare = async () => {
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl + pdfPath;
    
    if (navigator.share) {
      try {
        // Для Web Share API нужно сначала получить файл
        const response = await fetch(fullUrl);
        const blob = await response.blob();
        const file = new File([blob], 'Комплекс для новых сотрудников от 01.12.2025.pdf', { type: 'application/pdf' });
        
        await navigator.share({
          title: 'Комплекс для новых сотрудников',
          text: 'Комплекс для новых сотрудников от 01.12.2025',
          files: [file]
        });
      } catch (err) {
        // Если не поддерживается или пользователь отменил
        console.log('Ошибка отправки:', err);
        // Fallback: копируем ссылку
        try {
          await navigator.clipboard.writeText(fullUrl);
          alert('Ссылка скопирована в буфер обмена!');
        } catch (clipboardErr) {
          console.log('Ошибка копирования:', clipboardErr);
        }
      }
    } else {
      // Fallback: копируем ссылку
      try {
        await navigator.clipboard.writeText(fullUrl);
        alert('Ссылка скопирована в буфер обмена!');
      } catch (err) {
        console.log('Ошибка копирования:', err);
      }
    }
    setShowPdfModal(false);
  };

  // Список инструментов
  const tools = [
    {
      name: 'База данных официанта',
      path: '/menus/waiter-database.html',
      type: 'html',
      description: 'Полная информация о блюдах',
      comingSoon: false
    },
    {
      name: 'Справочник официанта',
      path: '/menus/waiter-guide.html',
      type: 'html',
      description: 'Справочные материалы',
      comingSoon: false
    },
    {
      name: 'Искусство в Sabor de la Vida',
      path: '/menus/art-menu.html',
      type: 'html',
      description: 'Художественные работы',
      comingSoon: false
    },
    {
      name: 'Тренажер официанта',
      path: '/trainer/menu-trainer.html',
      type: 'html',
      description: 'Обучение и практика',
      comingSoon: false
    },
    {
      name: 'Сигарная энциклопедия',
      path: '/cigar-encyclopedia',
      type: 'html',
      description: 'Энциклопедия сигар',
      comingSoon: isComingSoon('cigarEncyclopedia')
    },
    {
      name: 'Комплекс для сотрудников',
      path: pdfPath,
      type: 'pdf',
      description: 'Внутренние ресурсы',
      comingSoon: false
    }
  ];

  if (tools.length === 0) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-[#181311] dark:text-white font-display antialiased min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-primary text-xl font-bold">Инструменты пока нет</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden pb-20 bg-background-light dark:bg-background-dark text-[#181311] dark:text-white font-display antialiased" style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center bg-white/95 dark:bg-[#181311]/95 backdrop-blur-sm p-4 pb-2 justify-between border-b border-orange-100/50 dark:border-gray-800 shadow-sm transition-all">
        <button 
          onClick={() => navigate(-1)}
          className="text-[#181311] dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-orange-50 dark:hover:bg-white/5 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-[#181311] dark:text-white text-lg font-bold">Инструменты</h1>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[#181311] dark:text-white tracking-tight text-xl font-bold leading-tight">
              Полезные ресурсы
            </h2>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {tools.map((tool) => {
            const imageUrl = getToolImage(tool.name);
            const icon = getToolIcon(tool.name);
            const description = getToolDescription(tool.name) || tool.description;

            return (
              <ComingSoonWrapper 
                key={tool.name}
                isComingSoon={tool.comingSoon}
                language={language}
                badgePosition="top-right"
              >
                <button
                  onClick={(e) => handleToolClick(e, tool)}
                  className="group relative overflow-hidden rounded-xl aspect-[4/3] shadow-md shadow-orange-900/5 active:scale-[0.98] transition-all duration-300 text-left"
                >
                {imageUrl ? (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url("${imageUrl}")` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-orange-100 dark:bg-gray-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary/40 dark:text-white/10 text-6xl">
                      {icon}
                    </span>
                  </div>
                )}
                {!imageUrl && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end h-full">
                  <span className="material-symbols-outlined text-white mb-0.5 text-xl opacity-90">
                    {icon}
                  </span>
                  <p className="text-white text-base font-bold leading-tight">{tool.name}</p>
                  {description && (
                    <p className="text-white/70 text-[10px] mt-0.5 font-medium uppercase tracking-wide">
                      {description}
                    </p>
                  )}
                </div>
              </button>
              </ComingSoonWrapper>
            );
          })}
        </div>
      </main>

      {/* Модальное окно для PDF */}
      {showPdfModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowPdfModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#181311] rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#181311] dark:text-white mb-4">
              Что вы хотите сделать с файлом?
            </h3>
            <div className="space-y-3">
              <button
                onClick={handlePdfOpen}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-primary text-2xl">open_in_new</span>
                <div>
                  <p className="font-semibold text-[#181311] dark:text-white">Открыть</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Открыть файл в новой вкладке</p>
                </div>
              </button>
              <button
                onClick={handlePdfDownload}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-primary text-2xl">download</span>
                <div>
                  <p className="font-semibold text-[#181311] dark:text-white">Скачать</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Скачать файл на устройство</p>
                </div>
              </button>
              <button
                onClick={handlePdfShare}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-primary text-2xl">ios_share</span>
                <div>
                  <p className="font-semibold text-[#181311] dark:text-white">Отправить</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Отправить файл через мессенджеры</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowPdfModal(false)}
              className="mt-4 w-full py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-[#181311] dark:text-white font-medium"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 bg-white dark:bg-[#181311] border-t border-orange-100 dark:border-gray-800 pb-safe z-40 w-full sabor-fixed">
        <div className={`grid ${isAuthenticated && currentUser?.role === 'администратор' ? 'grid-cols-5' : 'grid-cols-4'} h-16`}>
          <Link
            to="/"
            className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
            <span className="text-[10px] font-medium">Меню</span>
          </Link>
          <button className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-2xl">favorite</span>
            <span className="text-[10px] font-medium">База данных</span>
          </button>
          <button 
            onClick={() => {
              // Можно добавить глобальный поиск
              navigate('/');
            }}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">search</span>
            <span className="text-[10px] font-medium">Поиск</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-primary">
            <span className="material-symbols-outlined text-2xl">new_releases</span>
            <span className="text-[10px] font-medium">Инструменты</span>
          </button>
          {isAuthenticated && currentUser?.role === 'администратор' && (
            <Link
              to="/admin"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">person</span>
              <span className="text-[10px] font-medium">Админ-панель</span>
            </Link>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)] bg-white dark:bg-[#181311]" />
      </footer>
    </div>
  );
}

export default ToolsPage;
