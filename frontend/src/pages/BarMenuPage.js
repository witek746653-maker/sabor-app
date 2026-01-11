import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getBarItems } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';

// Функция для определения, является ли ингредиент алкогольным
// Проверяет наличие алкогольных ключевых слов в названии ингредиента
const isAlcoholicIngredient = (ingredient) => {
  if (!ingredient) return false;
  
  const ingredientLower = ingredient.toLowerCase();
  
  // Список алкогольных ключевых слов
  const alcoholicKeywords = [
    'виски', 'whisky', 'whiskey',
    'водка', 'vodka',
    'джин', 'gin',
    'ром', 'rum',
    'текила', 'tequila',
    'вино', 'wine', 'вина',
    'портвейн', 'porto', 'port',
    'вермут', 'vermouth',
    'ликер', 'liqueur', 'ликёр',
    'бренди', 'brandy',
    'коньяк', 'cognac',
    'шампанское', 'champagne',
    'пиво', 'beer',
    'саке', 'sake',
    'абсент', 'absinthe',
    'шнапс', 'schnapps',
    'аперитив', 'aperitif',
    'дижестив', 'digestif',
    'херес', 'sherry',
    'мадера', 'madeira',
    'марсала', 'marsala',
    'просекко', 'prosecco',
    'сидр', 'cider',
    'медовуха', 'mead'
  ];
  
  return alcoholicKeywords.some(keyword => ingredientLower.includes(keyword));
};

// Функция для парсинга строки ингредиентов из cardIngredients
// Разделяет строку по "/" и возвращает массив ингредиентов
const parseCardIngredients = (cardIngredients) => {
  if (!cardIngredients || typeof cardIngredients !== 'string') {
    return [];
  }
  
  // Разделяем по "/" и очищаем от пробелов
  return cardIngredients
    .split('/')
    .map(ing => ing.trim())
    .filter(ing => ing.length > 0);
};

function BarMenuPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [barItems, setBarItems] = useState([]);
  const [allBarItems, setAllBarItems] = useState([]);
  const [selectedSection, setSelectedSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSectionFilter, setShowSectionFilter] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('menuLanguage') || 'RU';
  });

  // Определяем доступные разделы с иконками
  const sections = [
    { id: 'all', name: 'Все разделы', nameEn: 'All Sections', icon: '' },
    { id: 'alcoholic', name: 'Алкогольные коктейли', nameEn: 'Alcoholic Cocktails', sectionMatch: '🍸 Алкогольные коктейли', icon: '🍸' },
    { id: 'non-alcoholic', name: 'Безалкогольные коктейли', nameEn: 'Non-Alcoholic Cocktails', sectionMatch: '🍹 Безалкогольные коктейли', icon: '🍹' },
    { id: 'hot', name: 'Горячие напитки', nameEn: 'Hot Drinks', sectionMatch: '♨️ Горячие напитки', icon: '♨️' },
    { id: 'beer', name: 'Пиво', nameEn: 'Beer', sectionMatch: '🍺 Пиво', icon: '🍺' },
    { id: 'tea', name: 'Чай', nameEn: 'Tea', sectionMatch: '🍵 Чай', icon: '🍵' }
  ];

  useEffect(() => {
    const loadBarItems = async () => {
      try {
        setLoading(true);
        const data = await getBarItems();
        
        // Фильтруем только актуальные напитки
        const activeItems = data.filter(item => item.status !== 'в архиве');
        setBarItems(activeItems);
        setAllBarItems(activeItems);
      } catch (error) {
        console.error('Ошибка загрузки барных напитков:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBarItems();
  }, []);

  // Закрытие выпадающих меню при клике вне их области
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSectionFilter(false);
      setShowAllergenFilter(false);
      setShowTagFilter(false);
    };
    
    if (showSectionFilter || showAllergenFilter || showTagFilter) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSectionFilter, showAllergenFilter, showTagFilter]);

  // Функция для получения тегов в зависимости от языка
  const getTagsForLanguage = (item) => {
    if (language === 'EN' && item.i18n?.en?.['tags-en']) {
      const tagsEn = item.i18n.en['tags-en'];
      if (typeof tagsEn === 'string') {
        return tagsEn.split(',').map(t => t.trim()).filter(Boolean);
      }
      return Array.isArray(tagsEn) ? tagsEn : [];
    }
    return item.tags || [];
  };

  // Функция для получения аллергенов в зависимости от языка
  const getAllergensForLanguage = (item) => {
    if (language === 'EN' && item.i18n?.en?.['allergens-en']) {
      const allergensEn = item.i18n.en['allergens-en'];
      if (typeof allergensEn === 'string') {
        return allergensEn.split(',').map(a => a.trim()).filter(Boolean);
      }
      return Array.isArray(allergensEn) ? allergensEn : [];
    }
    // Если allergens - строка, преобразуем в массив
    if (typeof item.allergens === 'string' && item.allergens.trim()) {
      return item.allergens.split(',').map(a => a.trim()).filter(Boolean);
    }
    return Array.isArray(item.allergens) ? item.allergens : [];
  };

  // Получаем все уникальные аллергены и теги из напитков (мемоизируем для оптимизации)
  const allAllergens = useMemo(() => {
    return [...new Set(barItems.flatMap(item => getAllergensForLanguage(item)))].filter(Boolean);
  }, [barItems, language]);
  
  const allTags = useMemo(() => {
    return [...new Set(barItems.flatMap(item => getTagsForLanguage(item)))].filter(Boolean);
  }, [barItems, language]);

  // Фильтруем напитки
  const filteredItems = barItems.filter((item) => {
    // Фильтр по разделу
    let matchesSection = true;
    if (selectedSection !== 'all') {
      const sectionData = sections.find(s => s.id === selectedSection);
      if (sectionData && sectionData.sectionMatch) {
        // Нормализуем строки: убираем эмодзи и лишние пробелы для сравнения
        const normalizeSection = (section) => {
          return (section || '').replace(/[🍸🍹♨️🍺🍵]/g, '').trim().toLowerCase();
        };
        
        const itemSectionNormalized = normalizeSection(item.section);
        const matchSectionNormalized = normalizeSection(sectionData.sectionMatch);
        
        // Проверяем точное совпадение или частичное
        matchesSection = itemSectionNormalized === matchSectionNormalized ||
                        itemSectionNormalized.includes(matchSectionNormalized) ||
                        matchSectionNormalized.includes(itemSectionNormalized);
      }
    }
    
    // Фильтр по поисковому запросу
    const queryLower = searchQuery.toLowerCase();
    const itemTitle = item.title || '';
    const itemDescription = item.description || '';
    const itemIngredients = (item.ingredients || []).join(' ');
    
    const matchesSearch =
      !searchQuery ||
      itemTitle.toLowerCase().includes(queryLower) ||
      itemDescription.toLowerCase().includes(queryLower) ||
      itemIngredients.toLowerCase().includes(queryLower);
    
    // Фильтр по аллергенам (только если выбраны фильтры)
    const itemAllergens = getAllergensForLanguage(item);
    const matchesAllergens =
      selectedAllergens.length === 0 ||
      selectedAllergens.some(selected => 
        itemAllergens.some(a => 
          a.toLowerCase().includes(selected.toLowerCase()) ||
          selected.toLowerCase().includes(a.toLowerCase())
        )
      );
    
    // Фильтр по тегам (только если выбраны фильтры)
    const itemTags = getTagsForLanguage(item);
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some(selected => 
        itemTags.some(t => 
          t.toLowerCase().includes(selected.toLowerCase()) ||
          selected.toLowerCase().includes(t.toLowerCase())
        )
      );
    
    return matchesSection && matchesSearch && matchesAllergens && matchesTags;
  });

  // Получаем название текущего раздела для заголовка
  const getCurrentSectionTitle = () => {
    if (selectedSection === 'all') {
      return language === 'EN' ? 'All Drinks' : 'Все напитки';
    }
    const sectionData = sections.find(s => s.id === selectedSection);
    if (sectionData) {
      return language === 'EN' ? sectionData.nameEn : sectionData.name;
    }
    return language === 'EN' ? 'All Drinks' : 'Все напитки';
  };

  // Функция для проверки, является ли напиток авторским
  const isAuthorSignature = (item) => {
    const tags = getTagsForLanguage(item);
    return tags.some(tag => tag.toLowerCase().includes('авторский') || tag.toLowerCase().includes('signature'));
  };

  // Функция для проверки, является ли напиток безалкогольным
  const isNonAlcoholic = (item) => {
    // Проверяем раздел
    const section = (item.section || '').toLowerCase();
    if (section.includes('безалкогольные') || section.includes('non-alcoholic') || 
        section.includes('безалкогольный')) {
      return true;
    }
    
    // Проверяем теги
    const tags = getTagsForLanguage(item).map(t => t.toLowerCase());
    if (tags.some(tag => tag.includes('безалкогольный') || tag.includes('non-alcoholic'))) {
      return true;
    }
    
    // Проверяем ингредиенты - если нет алкогольных, то безалкогольный
    const ingredients = item.ingredients || [];
    if (ingredients.length === 0) {
      return false; // Если ингредиентов нет, не можем определить
    }
    
    const hasAlcoholic = ingredients.some(ing => isAlcoholicIngredient(ing));
    return !hasAlcoholic;
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden border-x border-gray-100 dark:border-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center px-4 pt-4 pb-2 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-[#181311] dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-[#181311] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            {language === 'EN' ? 'Bar Menu' : 'Барное меню'}
          </h2>
          <div className="flex w-12 items-center justify-end">
            <button 
              onClick={() => {
                const newLanguage = language === 'RU' ? 'EN' : 'RU';
                setLanguage(newLanguage);
                localStorage.setItem('menuLanguage', newLanguage);
              }}
              className={`text-xs font-bold leading-normal tracking-[0.015em] shrink-0 border rounded-lg px-2 py-1 transition-colors ${
                language === 'EN' 
                  ? 'bg-primary text-white border-primary' 
                  : 'text-primary border-primary/30 hover:bg-primary hover:text-white'
              }`}
            >
              {language === 'RU' ? 'EN' : 'RU'}
            </button>
          </div>
        </div>
        {/* Breadcrumb */}
        <div className="px-4 pb-2">
          <nav className="flex text-xs text-[#896f61] dark:text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis items-center">
            <Link to="/" className="hover:text-primary transition-colors cursor-pointer">Menu</Link>
            <span className="material-symbols-outlined text-[10px] mx-1 opacity-60">chevron_right</span>
            <span className="text-primary font-semibold">{language === 'EN' ? 'Bar' : 'Бар'}</span>
          </nav>
        </div>
        {/* Search */}
        <div className="px-4 py-2">
          <div className="flex w-full items-stretch rounded-xl h-10 bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-700/50 group focus-within:border-primary/50 transition-colors">
            <div className="text-[#896f61] dark:text-gray-400 flex items-center justify-center pl-3 pr-2 group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              className="flex w-full flex-1 bg-transparent border-none text-[#181311] dark:text-white placeholder:text-[#896f61] dark:placeholder:text-gray-500 focus:ring-0 text-sm font-normal h-full p-0 pr-3"
              placeholder={language === 'EN' ? 'Search drinks...' : 'Поиск напитков...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {/* Filters */}
        <div className="relative">
          <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar items-center pb-3 border-t border-gray-100/50 dark:border-gray-800/50 mt-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowSectionFilter(!showSectionFilter);
                setShowAllergenFilter(false);
                setShowTagFilter(false);
              }}
              className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 transition-transform active:scale-95 shadow-sm ${
                selectedSection !== 'all' 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className={`text-xs font-medium ${selectedSection !== 'all' ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>
                {language === 'EN' ? 'Category' : 'Раздел'}
              </p>
              <span className={`material-symbols-outlined text-[16px] ${selectedSection !== 'all' ? 'text-white' : 'text-gray-500'} ${showSectionFilter ? 'rotate-180' : ''} transition-transform`}>
                expand_more
              </span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowAllergenFilter(!showAllergenFilter);
                setShowSectionFilter(false);
                setShowTagFilter(false);
              }}
              className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 transition-transform active:scale-95 shadow-sm ${
                selectedAllergens.length > 0 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className={`text-xs font-medium ${selectedAllergens.length > 0 ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>
                {language === 'EN' ? 'Allergens' : 'Аллергены'}
              </p>
              <span className={`material-symbols-outlined text-[16px] ${selectedAllergens.length > 0 ? 'text-white' : 'text-gray-500'} ${showAllergenFilter ? 'rotate-180' : ''} transition-transform`}>
                expand_more
              </span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowTagFilter(!showTagFilter);
                setShowSectionFilter(false);
                setShowAllergenFilter(false);
              }}
              className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 shadow-sm transition-transform active:scale-95 ${
                selectedTags.length > 0 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className={`text-xs font-semibold ${selectedTags.length > 0 ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>
                {language === 'EN' ? 'Tags' : 'Теги'}
              </p>
              <span className={`material-symbols-outlined text-[16px] ${selectedTags.length > 0 ? 'text-white' : 'text-gray-500'} ${showTagFilter ? 'rotate-180' : ''} transition-transform`}>
                expand_more
              </span>
            </button>
          </div>
          
          {/* Выпадающее меню для разделов */}
          {showSectionFilter && (
            <div 
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setSelectedSection('all');
                  setShowSectionFilter(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 ${
                  selectedSection === 'all' ? 'bg-primary/10 text-primary font-semibold' : ''
                }`}
              >
                {language === 'EN' ? 'All Sections' : 'Все разделы'}
              </button>
              {sections.filter(s => s.id !== 'all').map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setSelectedSection(section.id);
                    setShowSectionFilter(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 ${
                    selectedSection === section.id ? 'bg-primary/10 text-primary font-semibold' : ''
                  }`}
                >
                  {section.icon && <span className="text-base">{section.icon}</span>}
                  <span>{language === 'EN' ? section.nameEn : section.name}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* Выпадающее меню для аллергенов */}
          {showAllergenFilter && (
            <div 
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-1">
                {allAllergens.map((allergen) => {
                  const isSelected = selectedAllergens.includes(allergen);
                  return (
                    <button
                      key={allergen}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAllergens(selectedAllergens.filter(a => a !== allergen));
                        } else {
                          setSelectedAllergens([...selectedAllergens, allergen]);
                        }
                      }}
                      className={`text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 rounded-lg ${
                        isSelected ? 'bg-primary/10 text-primary font-semibold' : ''
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[14px] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="truncate text-xs">{allergen}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Выпадающее меню для тегов */}
          {showTagFilter && (
            <div 
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-1">
                {allTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                      className={`text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 rounded-lg ${
                        isSelected ? 'bg-primary/10 text-primary font-semibold' : ''
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[14px] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="truncate text-xs">{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drinks Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-bold text-base dark:text-white">
            {getCurrentSectionTitle()}
          </h3>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700">
            {filteredItems.length} {language === 'EN' ? 'drinks' : 'напитков'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {filteredItems.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-[#896f61] dark:text-gray-400">
              {language === 'EN' ? 'No drinks found' : 'Напитки не найдены'}
            </div>
          ) : (
            filteredItems.map((item) => {
              const imageUrl = getDishImageUrl(item);
              // Используем новое поле cardIngredients, если оно есть, иначе fallback на ingredients
              const cardIngredients = item.cardIngredients || '';
              const mainIngredients = cardIngredients 
                ? parseCardIngredients(cardIngredients)
                : (item.ingredients || []);
              const isAuthor = isAuthorSignature(item);
              const isNonAlc = isNonAlcoholic(item);
              
              return (
                <Link
                  key={item.id}
                  to={`/dish/${item.id}`}
                  className="group flex flex-col rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-800 hover:border-primary/30 transition-all"
                >
                  <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.title || 'Drink'}
                        className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-gray-400 text-4xl">local_drink</span>
                      </div>
                    )}
                    {/* Значки для авторских и безалкогольных коктейлей */}
                    {(isAuthor || isNonAlc) && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        {isAuthor && (
                          <span 
                            className="material-symbols-outlined text-[18px] text-primary" 
                            title={language === 'EN' ? 'Author signature' : 'Авторский коктейль'}
                          >
                            star
                          </span>
                        )}
                        {isNonAlc && (
                          <span 
                            className="material-symbols-outlined text-[18px] text-green-500" 
                            title={language === 'EN' ? 'Non-alcoholic' : 'Безалкогольный'}
                          >
                            no_drinks
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-grow">
                    <h3 className="font-bold text-sm leading-[1.2] dark:text-white line-clamp-2 mb-2 group-hover:text-primary transition-colors duration-200">
                      {item.title || (language === 'EN' ? 'No title' : 'Без названия')}
                    </h3>
                    
                    {/* Ингредиенты */}
                    {mainIngredients.length > 0 && (
                      <div className="mt-auto pt-2 border-t border-dashed border-gray-100 dark:border-gray-700 min-h-[2.5rem]">
                        <div className="text-[10px] leading-[1.25] line-clamp-2">
                          {mainIngredients.map((ingredient, index) => {
                            const isAlc = isAlcoholicIngredient(ingredient);
                            return (
                              <React.Fragment key={index}>
                                <span 
                                  className={`font-medium ${
                                    isAlc 
                                      ? 'text-red-600 dark:text-red-400' 
                                      : 'text-green-600 dark:text-green-400'
                                  }`}
                                >
                                  {ingredient}
                                </span>
                                {index < mainIngredients.length - 1 && (
                                  <span className="text-gray-400 mx-0.5">/</span>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 z-50 w-full max-w-md bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
        <div className={`grid ${isAuthenticated && currentUser?.role === 'администратор' ? 'grid-cols-4' : 'grid-cols-3'} px-6 items-center h-[60px]`}>
          <Link to="/" className="flex flex-col items-center justify-center gap-1 text-primary">
            <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
            <span className="text-[10px] font-bold">{language === 'EN' ? 'Menu' : 'Меню'}</span>
          </Link>
          <button className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[24px]">favorite</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Favorites' : 'Избранное'}</span>
          </button>
          <button 
            onClick={() => {
              document.querySelector('input[placeholder*="Search"], input[placeholder*="Поиск"]')?.focus();
            }}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">search</span>
            <span className="text-[10px] font-medium">{language === 'EN' ? 'Search' : 'Поиск'}</span>
          </button>
          {isAuthenticated && currentUser?.role === 'администратор' && (
            <Link
              to="/admin"
              className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#181311] dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">person</span>
              <span className="text-[10px] font-medium">{language === 'EN' ? 'Admin' : 'Админ-панель'}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default BarMenuPage;
