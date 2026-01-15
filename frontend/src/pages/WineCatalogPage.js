import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWines, getWinesByCategory } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDishImageUrl } from '../utils/imageUtils';

// Функция для получения эмодзи флага по названию страны или коду страны
const getCountryFlag = (country) => {
  if (!country) return '';
  
  // Убираем лишние пробелы и приводим к нижнему регистру
  const countryLower = country.toLowerCase().trim();
  
  // Карта соответствий: название страны (на русском и английском) и коды стран -> эмодзи флаг
  // Используем Unicode коды для эмодзи флагов, чтобы избежать проблем с кодировкой
  const flagMap = {
    // Русские названия
    'италия': '\u{1F1EE}\u{1F1F9}', // 🇮🇹
    'франция': '\u{1F1EB}\u{1F1F7}', // 🇫🇷
    'испания': '\u{1F1EA}\u{1F1F8}', // 🇪🇸
    'сша': '\u{1F1FA}\u{1F1F8}', // 🇺🇸
    'соединенные штаты': '\u{1F1FA}\u{1F1F8}',
    'соединённые штаты': '\u{1F1FA}\u{1F1F8}',
    'аргентина': '\u{1F1E6}\u{1F1F7}', // 🇦🇷
    'чили': '\u{1F1E8}\u{1F1F1}', // 🇨🇱
    'португалия': '\u{1F1F5}\u{1F1F9}', // 🇵🇹
    'германия': '\u{1F1E9}\u{1F1EA}', // 🇩🇪
    'австрия': '\u{1F1E6}\u{1F1F9}', // 🇦🇹
    'южная африка': '\u{1F1FF}\u{1F1E6}', // 🇿🇦
    'новая зеландия': '\u{1F1F3}\u{1F1FF}', // 🇳🇿
    'австралия': '\u{1F1E6}\u{1F1FA}', // 🇦🇺
    'грузия': '\u{1F1EC}\u{1F1EA}', // 🇬🇪
    // Английские названия
    'italy': '\u{1F1EE}\u{1F1F9}',
    'france': '\u{1F1EB}\u{1F1F7}',
    'spain': '\u{1F1EA}\u{1F1F8}',
    'usa': '\u{1F1FA}\u{1F1F8}',
    'united states': '\u{1F1FA}\u{1F1F8}',
    'argentina': '\u{1F1E6}\u{1F1F7}',
    'chile': '\u{1F1E8}\u{1F1F1}',
    'portugal': '\u{1F1F5}\u{1F1F9}',
    'germany': '\u{1F1E9}\u{1F1EA}',
    'austria': '\u{1F1E6}\u{1F1F9}',
    'south africa': '\u{1F1FF}\u{1F1E6}',
    'new zealand': '\u{1F1F3}\u{1F1FF}',
    'australia': '\u{1F1E6}\u{1F1FA}',
    'georgia': '\u{1F1EC}\u{1F1EA}',
    // Коды стран (ISO 3166-1 alpha-2)
    'it': '\u{1F1EE}\u{1F1F9}',
    'fr': '\u{1F1EB}\u{1F1F7}',
    'es': '\u{1F1EA}\u{1F1F8}',
    'us': '\u{1F1FA}\u{1F1F8}',
    'ar': '\u{1F1E6}\u{1F1F7}',
    'cl': '\u{1F1E8}\u{1F1F1}',
    'pt': '\u{1F1F5}\u{1F1F9}',
    'de': '\u{1F1E9}\u{1F1EA}',
    'at': '\u{1F1E6}\u{1F1F9}',
    'za': '\u{1F1FF}\u{1F1E6}',
    'nz': '\u{1F1F3}\u{1F1FF}',
    'au': '\u{1F1E6}\u{1F1FA}',
    'ge': '\u{1F1EC}\u{1F1EA}',
  };
  
  // Сначала проверяем точное совпадение (самый надежный способ)
  if (flagMap[countryLower]) {
    return flagMap[countryLower];
  }
  
  // Проверяем, начинается ли строка с кода страны (2 буквы + пробел)
  // Это случай: "IT Италия", "US США" и т.д.
  const codeMatch = countryLower.match(/^([a-z]{2})\s/);
  if (codeMatch && flagMap[codeMatch[1]]) {
    return flagMap[codeMatch[1]];
  }
  
  // Проверяем код страны в начале с разделителем (запятая или двоеточие)
  const codeWithSeparator = countryLower.match(/^([a-z]{2})[,:]/);
  if (codeWithSeparator && flagMap[codeWithSeparator[1]]) {
    return flagMap[codeWithSeparator[1]];
  }
  
  // Пытаемся найти название страны в строке (если код не найден)
  // Ищем по ключевым словам в строке (только для названий, не кодов)
  for (const [key, flag] of Object.entries(flagMap)) {
    if (key.length > 2 && countryLower.includes(key)) {
      return flag;
    }
  }
  
  // Если не найдено, возвращаем флаг по умолчанию
  return '\u{1F30D}'; // 🌍
};

// Функция для парсинга origin (страна, регион)
// Обрабатывает различные форматы: "Италия, Вéнето", "IT, Италия, Вéнето", "IT Италия, Вéнето" и т.д.
const parseOrigin = (originStr, wineData) => {
  if (!originStr && !wineData?.region) return { country: null, region: null };
  
  const cleaned = originStr ? originStr.replace(/\.$/, '').trim() : '';
  const parts = cleaned.split(',').map(p => p.trim()).filter(p => p); // Убираем пустые части
  
  if (parts.length === 0) return { country: null, region: wineData?.region || null };
  
  let country = null;
  let countryIndex = 0;
  
  // Проверяем первую часть
  const firstPart = parts[0];
  
  // Если первая часть - это только код страны (2 буквы), пропускаем её
  if (parts.length > 1 && /^[A-Z]{2}$/i.test(firstPart)) {
    // Первая часть - код страны, пропускаем и берём следующую
    countryIndex = 1;
    country = parts[countryIndex] || null;
  } 
  // Если первая часть содержит код страны и название (например, "IT Италия")
  else if (/^[A-Z]{2}\s+/i.test(firstPart)) {
    // Извлекаем название страны, убирая код в начале
    country = firstPart.replace(/^[A-Z]{2}\s+/i, '').trim();
    if (!country) {
      // Если после удаления кода ничего не осталось, берём следующую часть
      country = parts.length > 1 ? parts[1] : null;
      countryIndex = 1;
    }
  } 
  // Иначе первая часть - это название страны
  else {
    country = firstPart;
  }
  
  // Регион берём из wineData.region или из оставшихся частей
  const region = wineData?.region || parts.slice(countryIndex + 1).join(', ') || null;
  
  return {
    country: country,
    region: region,
  };
};

// Функция для определения легкости вина (из tags) - возвращает значение от 0 до 100
const getLightness = (wine) => {
  const tags = wine.tags || [];
  const tagsLower = tags.map(t => t.toLowerCase()).join(' ');
  if (tagsLower.includes('легкое') || tagsLower.includes('light')) return 20; // легкое = зеленый
  if (tagsLower.includes('средне') || tagsLower.includes('medium') || 
      tagsLower.includes('средне-полнотелое') || tagsLower.includes('medium-bodied')) return 50; // среднее = желтый
  if (tagsLower.includes('полнотелое') || tagsLower.includes('full-bodied')) return 90; // полнотелое = красный
  return 50; // по умолчанию среднее
};

// Функция для определения кислотности (из tags и description) - возвращает значение от 0 до 100
const getAcidity = (wine) => {
  const tags = wine.tags || [];
  const description = (wine.description || '').toLowerCase();
  const tagsLower = tags.map(t => t.toLowerCase()).join(' ');
  const allText = tagsLower + ' ' + description;
  
  if (allText.includes('яркая кислотность') || allText.includes('bright acidity') || 
      allText.includes('высокая кислотность') || allText.includes('high acidity') ||
      allText.includes('высокая кислотность')) return 90; // высокая = красный
  if (allText.includes('хорошая кислотность') || allText.includes('good acidity') ||
      allText.includes('гармоничная кислотность') || allText.includes('harmonious acidity') ||
      allText.includes('сбалансированная кислотность')) return 50; // средняя = желтый
  if (allText.includes('низкая кислотность') || allText.includes('low acidity') ||
      allText.includes('мягкая кислотность') || allText.includes('soft acidity')) return 20; // низкая = зеленый
  return 50; // по умолчанию средняя
};

// Функция для определения танинности (из tags и description) - возвращает значение от 0 до 100
const getTannin = (wine) => {
  const tags = wine.tags || [];
  const description = (wine.description || '').toLowerCase();
  const tagsLower = tags.map(t => t.toLowerCase()).join(' ');
  const allText = tagsLower + ' ' + description;
  
  if (allText.includes('танинное') || allText.includes('tannic') ||
      allText.includes('плотные танины') || allText.includes('dense tannins') ||
      allText.includes('сильные танины') || allText.includes('strong tannins')) return 90; // высокая = красный
  if (allText.includes('мягкие танины') || allText.includes('soft tannins') ||
      allText.includes('шелковистые танины') || allText.includes('silky tannins') ||
      allText.includes('зрелые танины') || allText.includes('mature tannins') ||
      allText.includes('сбалансированные танины')) return 50; // средняя = желтый
  if (allText.includes('легкие танины') || allText.includes('light tannins') ||
      allText.includes('нежные танины') || allText.includes('delicate tannins') ||
      allText.includes('слабо выраженные танины')) return 20; // низкая = зеленый
  return 50; // по умолчанию средняя
};

// Функция для получения цвета градиента на основе значения (0-100)
// От зеленого (0) через желтый (50) к красному (100)
const getGradientColor = (value) => {
  // Ограничиваем значение от 0 до 100
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Создаем градиент от зеленого к красному через желтый
  let r, g, b;
  
  if (clampedValue <= 50) {
    // От зеленого (0, 200, 0) к желтому (255, 255, 0)
    const ratio = clampedValue / 50;
    r = Math.round(0 + (255 - 0) * ratio);
    g = Math.round(200 + (255 - 200) * ratio);
    b = Math.round(0);
  } else {
    // От желтого (255, 255, 0) к красному (255, 0, 0)
    const ratio = (clampedValue - 50) / 50;
    r = 255;
    g = Math.round(255 - (255 - 0) * ratio);
    b = 0;
  }
  
  return `rgb(${r}, ${g}, ${b})`;
};

// Функция для определения типа вина (для выбора шкалы)
const getWineType = (wine) => {
  const tags = wine.tags || [];
  const tagsLower = tags.map(t => t.toLowerCase()).join(' ');
  const section = (wine.section || '').toLowerCase();
  const allText = tagsLower + ' ' + section;
  
  if (allText.includes('белое') || allText.includes('white') ||
      allText.includes('игристое') || allText.includes('sparkling') ||
      allText.includes('розовое') || allText.includes('rosé') || allText.includes('rose')) {
    return 'white'; // для белых, игристых и розовых - шкала легкость-кислотность
  }
  if (allText.includes('красное') || allText.includes('red')) {
    return 'red'; // для красных - шкала легкость-танинность
  }
  return 'white'; // по умолчанию
};

function WineCatalogPage() {
  const { category } = useParams(); // category опционален
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [wines, setWines] = useState([]);
  const [allWines, setAllWines] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGrapeVarieties, setSelectedGrapeVarieties] = useState([]);
  const [selectedPairings, setSelectedPairings] = useState([]);
  const [showSectionFilter, setShowSectionFilter] = useState(false);
  const [showGrapeFilter, setShowGrapeFilter] = useState(false);
  const [showPairingFilter, setShowPairingFilter] = useState(false);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('menuLanguage') || 'RU';
  });

  useEffect(() => {
    const loadWines = async () => {
      try {
        // Если есть category, загружаем вина по категории, иначе все вина
        const data = category ? await getWinesByCategory(category) : await getWines();
        
        // Показываем ВСЕ вина (включая "в архиве") — архивные затемняем в UI
        // Термин **архив**: позиция неактивна, но мы её не прячем.
        setWines(data);
        setAllWines(data);

        // Для группировки разделов всегда используем ВСЕ вина (не только из текущей категории)
        // чтобы показать все доступные разделы
        let allWinesForSections = data;
        if (category) {
          // Если выбрана категория, загружаем все вина для определения всех разделов
          const allWinesData = await getWines();
          allWinesForSections = allWinesData;
        }

        // Собираем все уникальные разделы (section) из всех вин
        // Это покажет все подкатегории, например: "Бокальные позиции — Игристые вина", "Бокальные позиции — Красные вина" и т.д.
        const uniqueSections = new Set();
        allWinesForSections.forEach(wine => {
          if (wine.section) {
            uniqueSections.add(wine.section);
          }
        });

        // Преобразуем в массив и сортируем
        // Сначала базовые категории, затем подкатегории внутри каждой категории
        const sectionsArray = Array.from(uniqueSections).sort((a, b) => {
          // Определяем базовую категорию для каждого раздела
          const getBaseCategory = (section) => {
            const sectionLower = section.toLowerCase();
            if (sectionLower.includes('бокальные позиции') || sectionLower.includes('wines by the glass') || 
                sectionLower.includes('glass selections')) {
              return 'Бокальные позиции';
            } else if (sectionLower.includes('coravin')) {
              return 'Coravin';
            } else if (sectionLower.includes('полубутылки') || sectionLower.includes('half bottles') ||
                       sectionLower.includes('375 мл')) {
              return 'Полубутылки';
            }
            return section; // Если не подходит ни под одну категорию, возвращаем сам раздел
          };

          const categoryA = getBaseCategory(a);
          const categoryB = getBaseCategory(b);
          
          // Порядок базовых категорий
          const order = { 'Бокальные позиции': 1, 'Coravin': 2, 'Полубутылки': 3 };
          const orderA = order[categoryA] || 99;
          const orderB = order[categoryB] || 99;
          
          // Сначала сортируем по базовой категории
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // Если базовая категория одинаковая, сортируем по алфавиту
          return a.localeCompare(b, 'ru');
        });

        console.log('Найдено разделов:', sectionsArray.length);
        console.log('Всего вин (загружено):', data.length);
        console.log('Всего вин (для разделов):', allWinesForSections.length);
        console.log('Все разделы:', sectionsArray);
        console.log('Текущий category из URL:', category);

        setSections(sectionsArray);
      } catch (error) {
        console.error('Ошибка загрузки вин:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWines();
  }, [category]);

  // Закрытие выпадающих меню при клике вне их области
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSectionFilter(false);
      setShowGrapeFilter(false);
      setShowPairingFilter(false);
    };
    
    if (showSectionFilter || showGrapeFilter || showPairingFilter) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSectionFilter, showGrapeFilter, showPairingFilter]);

  // Получаем все уникальные сорта винограда и перинги
  const allGrapeVarieties = [...new Set(wines.flatMap(w => w.grapeVarieties || []))].filter(Boolean);
  
  // Получаем все уникальные перинги
  const allPairings = [
    'жирная рыба',
    'жирное мясо и стейки',
    'выдержанные сыры',
    'свежие морепродукты'
  ];

  // Фильтруем вина
  const filteredWines = wines.filter((wine) => {
    // Фильтр по разделу
    // Теперь selectedSection может быть как базовой категорией, так и полным названием раздела
    let matchesSection = true;
    if (selectedSection !== 'all') {
      // Проверяем точное совпадение section
      if (wine.section === selectedSection) {
        matchesSection = true;
      } else {
        // Если точного совпадения нет, проверяем базовые категории для обратной совместимости
        const categoryLower = wine.category?.toLowerCase() || '';
        const sectionLower = wine.section?.toLowerCase() || '';
        
        if (selectedSection === 'Бокальные позиции') {
          matchesSection = categoryLower === 'by-glass' || categoryLower === 'by_glass' ||
                          sectionLower.includes('бокальные позиции') || 
                          sectionLower.includes('wines by the glass') ||
                          sectionLower.includes('glass selections');
        } else if (selectedSection === 'Coravin') {
          matchesSection = categoryLower === 'coravin' ||
                          sectionLower.includes('coravin');
        } else if (selectedSection === 'Полубутылки') {
          matchesSection = categoryLower === 'half-bottles' || categoryLower === 'half_bottles' ||
                          sectionLower.includes('полубутылки') || 
                          sectionLower.includes('half bottles') ||
                          sectionLower.includes('375 мл');
        } else {
          // Для всех остальных случаев проверяем точное совпадение
          matchesSection = wine.section === selectedSection;
        }
      }
    }
    
    // Фильтр по поисковому запросу
    const queryLower = searchQuery.toLowerCase();
    const wineTitle = wine.title || '';
    const wineDescription = wine.description || '';
    const wineOrigin = wine.origin || '';
    const wineProducer = wine.producer || '';
    const wineGrapeVarieties = (wine.grapeVarieties || []).join(' ');
    
    const matchesSearch =
      !searchQuery ||
      wineTitle.toLowerCase().includes(queryLower) ||
      wineDescription.toLowerCase().includes(queryLower) ||
      wineOrigin.toLowerCase().includes(queryLower) ||
      wineProducer.toLowerCase().includes(queryLower) ||
      wineGrapeVarieties.toLowerCase().includes(queryLower);
    
    // Фильтр по сортам винограда
    const matchesGrapeVarieties =
      selectedGrapeVarieties.length === 0 ||
      selectedGrapeVarieties.some(selected => 
        (wine.grapeVarieties || []).some(g => 
          g.toLowerCase().includes(selected.toLowerCase()) ||
          selected.toLowerCase().includes(g.toLowerCase())
        )
      );
    
    // Фильтр по перингу
    const matchesPairings =
      selectedPairings.length === 0 ||
      selectedPairings.some(selected => {
        const pairings = wine.pairings?.dishes || [];
        return pairings.some(p => 
          p.toLowerCase().includes(selected.toLowerCase()) ||
          selected.toLowerCase().includes(p.toLowerCase())
        );
      });
    
    return matchesSection && matchesSearch && matchesGrapeVarieties && matchesPairings;
  });

  // Функция для сокращения названия вина
  const shortenTitle = (title, maxLength = 30) => {
    if (!title) return '';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#181311] dark:text-[#f4f2f0] min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden border-x border-gray-100 dark:border-gray-800">
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
            {language === 'EN' ? 'Wine Catalog' : 'Каталог вин'}
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
            <span className="text-primary font-semibold">{language === 'EN' ? 'Wine' : 'Вино'}</span>
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
              placeholder={language === 'EN' ? 'Search wines...' : 'Поиск вина...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {/* Filters */}
        <div className="relative">
          <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar items-center pb-3 border-t border-gray-100/50 dark:border-gray-800/50 mt-1">
            {sections.length > 0 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSectionFilter(!showSectionFilter);
                  setShowGrapeFilter(false);
                  setShowPairingFilter(false);
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
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowGrapeFilter(!showGrapeFilter);
                setShowSectionFilter(false);
                setShowPairingFilter(false);
              }}
              className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 transition-transform active:scale-95 shadow-sm ${
                selectedGrapeVarieties.length > 0 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className={`text-xs font-medium ${selectedGrapeVarieties.length > 0 ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>
                {language === 'EN' ? 'Grape' : 'Сорт'}
              </p>
              <span className={`material-symbols-outlined text-[16px] ${selectedGrapeVarieties.length > 0 ? 'text-white' : 'text-gray-500'} ${showGrapeFilter ? 'rotate-180' : ''} transition-transform`}>
                expand_more
              </span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowPairingFilter(!showPairingFilter);
                setShowSectionFilter(false);
                setShowGrapeFilter(false);
              }}
              className={`flex h-8 shrink-0 items-center justify-center gap-x-1 rounded-full border px-3 shadow-sm transition-transform active:scale-95 ${
                selectedPairings.length > 0 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className={`text-xs font-semibold ${selectedPairings.length > 0 ? 'text-white' : 'text-[#181311] dark:text-gray-200'}`}>
                {language === 'EN' ? 'Pairing' : 'Перинг'}
              </p>
              <span className={`material-symbols-outlined text-[16px] ${selectedPairings.length > 0 ? 'text-white' : 'text-gray-500'} ${showPairingFilter ? 'rotate-180' : ''} transition-transform`}>
                expand_more
              </span>
            </button>
          </div>
          
          {/* Выпадающее меню для категорий */}
          {showSectionFilter && sections.length > 0 && (
            <div 
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setSelectedSection('all');
                  setShowSectionFilter(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  selectedSection === 'all' ? 'bg-primary/10 text-primary font-semibold' : ''
                }`}
              >
                {language === 'EN' ? 'All Categories' : 'Все категории'}
              </button>
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => {
                    setSelectedSection(section);
                    setShowSectionFilter(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                    selectedSection === section ? 'bg-primary/10 text-primary font-semibold' : ''
                  }`}
                >
                  {section}
                </button>
              ))}
            </div>
          )}
          
          {/* Выпадающее меню для сортов винограда */}
          {showGrapeFilter && (
            <div 
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-1">
                {allGrapeVarieties.map((grape) => {
                  const isSelected = selectedGrapeVarieties.includes(grape);
                  return (
                    <button
                      key={grape}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedGrapeVarieties(selectedGrapeVarieties.filter(g => g !== grape));
                        } else {
                          setSelectedGrapeVarieties([...selectedGrapeVarieties, grape]);
                        }
                      }}
                      className={`text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 rounded-lg ${
                        isSelected ? 'bg-primary/10 text-primary font-semibold' : ''
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[14px] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="truncate text-xs">{grape}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Выпадающее меню для перинга */}
          {showPairingFilter && (
            <div 
              className="absolute top-full left-4 right-4 mt-1 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-1 gap-1">
                {allPairings.map((pairing) => {
                  const isSelected = selectedPairings.includes(pairing);
                  return (
                    <button
                      key={pairing}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPairings(selectedPairings.filter(p => p !== pairing));
                        } else {
                          setSelectedPairings([...selectedPairings, pairing]);
                        }
                      }}
                      className={`text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 rounded-lg ${
                        isSelected ? 'bg-primary/10 text-primary font-semibold' : ''
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[14px] flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="truncate text-xs">{pairing}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wines Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-bold text-base dark:text-white">
            {language === 'EN' ? 'All Wines' : 'Все вина'}
          </h3>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700">
            {filteredWines.length} {language === 'EN' ? 'wines' : 'вин'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filteredWines.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-[#896f61] dark:text-gray-400">
              {language === 'EN' ? 'No wines found' : 'Вина не найдены'}
            </div>
          ) : (
            filteredWines.map((wine) => {
              const imageUrl = getDishImageUrl(wine);
              const { country, region } = parseOrigin(wine.origin, wine);
              const countryFlag = getCountryFlag(country);
              const wineType = getWineType(wine);
              const lightness = getLightness(wine);
              const acidity = getAcidity(wine);
              const tannin = getTannin(wine);
              const isArchived = wine.status === 'в архиве';
              
              // Отладка: проверяем, что флаг определяется правильно (только если не найден)
              if (country && (!countryFlag || countryFlag === '\u{1F30D}' || /^[A-Z]{2}$/i.test(countryFlag))) {
                console.warn('⚠️ Флаг не найден для страны:', country, 'origin:', wine.origin);
              }

              return (
                <Link
                  key={wine.id}
                  to={`/wine/${wine.id}`}
                  className="group relative rounded-lg overflow-hidden bg-white dark:bg-surface-dark shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-800 hover:border-primary/30 transition-all"
                >
                  {/* Затемняем ТОЛЬКО контент карточки, чтобы бейдж "В АРХИВЕ" был читабельным */}
                  <div className={`flex flex-col h-full ${isArchived ? 'opacity-50 grayscale' : ''}`}>
                    <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={wine.title || 'Wine'}
                          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-400 text-4xl">wine_bar</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-grow">
                      <h3 className="font-bold text-sm leading-[1.2] dark:text-white line-clamp-2 mb-2 group-hover:text-primary transition-colors duration-200">
                        {shortenTitle(wine.title || (language === 'EN' ? 'No title' : 'Без названия'))}
                      </h3>
                      
                      {/* Страна и регион с флагом */}
                      {country && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {countryFlag && countryFlag !== '🌍' && (
                            <span 
                              className="text-base leading-none inline-block" 
                              style={{ 
                                fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
                                minWidth: '20px',
                                fontSize: '16px',
                                lineHeight: '1',
                                display: 'inline-block'
                              }}
                              role="img"
                              aria-label={`Флаг ${country}`}
                            >
                              {countryFlag}
                            </span>
                          )}
                          <p className="text-[10px] text-[#896f61] dark:text-gray-400 line-clamp-1 leading-tight">
                            {country}{region ? `, ${region}` : ''}
                          </p>
                        </div>
                      )}
                      
                      {/* Производитель */}
                      {wine.producer && (
                        <p className="text-[9px] text-[#896f61] dark:text-gray-400 line-clamp-1 mb-2 leading-tight opacity-75">
                          {wine.producer.replace(/\.$/, '')}
                        </p>
                      )}
                      
                      {/* Шкала легкость-кислотность (для белых, игристых, розовых) или легкость-танинность (для красных) */}
                      {wineType === 'white' ? (
                        <div className="mt-auto pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[8px] text-gray-400 uppercase font-semibold">Легкость</span>
                            <span className="text-[8px] text-gray-400 uppercase font-semibold">Кислотность</span>
                          </div>
                          <div className="flex gap-2">
                            {/* Шкала легкости - сплошная градиентная */}
                            <div className="flex-1 relative">
                              <div 
                                className="w-full h-2.5 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700"
                                style={{
                                  background: `linear-gradient(to right, 
                                    rgb(0, 200, 0) 0%, 
                                    rgb(255, 255, 0) 50%, 
                                    rgb(255, 0, 0) 100%)`
                                }}
                              />
                              {/* Индикатор текущего значения */}
                              <div 
                                className="absolute top-0 h-2.5 rounded-full bg-white dark:bg-gray-800 border-2"
                                style={{
                                  left: `${lightness}%`,
                                  width: '3px',
                                  marginLeft: '-1.5px',
                                  borderColor: getGradientColor(lightness),
                                  boxShadow: `0 0 4px ${getGradientColor(lightness)}`
                                }}
                              />
                            </div>
                            {/* Шкала кислотности - сплошная градиентная */}
                            <div className="flex-1 relative">
                              <div 
                                className="w-full h-2.5 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700"
                                style={{
                                  background: `linear-gradient(to right, 
                                    rgb(0, 200, 0) 0%, 
                                    rgb(255, 255, 0) 50%, 
                                    rgb(255, 0, 0) 100%)`
                                }}
                              />
                              {/* Индикатор текущего значения */}
                              <div 
                                className="absolute top-0 h-2.5 rounded-full bg-white dark:bg-gray-800 border-2"
                                style={{
                                  left: `${acidity}%`,
                                  width: '3px',
                                  marginLeft: '-1.5px',
                                  borderColor: getGradientColor(acidity),
                                  boxShadow: `0 0 4px ${getGradientColor(acidity)}`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[8px] text-gray-400 uppercase font-semibold">Легкость</span>
                            <span className="text-[8px] text-gray-400 uppercase font-semibold">Танинность</span>
                          </div>
                          <div className="flex gap-2">
                            {/* Шкала легкости - сплошная градиентная */}
                            <div className="flex-1 relative">
                              <div 
                                className="w-full h-2.5 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700"
                                style={{
                                  background: `linear-gradient(to right, 
                                    rgb(0, 200, 0) 0%, 
                                    rgb(255, 255, 0) 50%, 
                                    rgb(255, 0, 0) 100%)`
                                }}
                              />
                              {/* Индикатор текущего значения */}
                              <div 
                                className="absolute top-0 h-2.5 rounded-full bg-white dark:bg-gray-800 border-2"
                                style={{
                                  left: `${lightness}%`,
                                  width: '3px',
                                  marginLeft: '-1.5px',
                                  borderColor: getGradientColor(lightness),
                                  boxShadow: `0 0 4px ${getGradientColor(lightness)}`
                                }}
                              />
                            </div>
                            {/* Шкала танинности - сплошная градиентная */}
                            <div className="flex-1 relative">
                              <div 
                                className="w-full h-2.5 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700"
                                style={{
                                  background: `linear-gradient(to right, 
                                    rgb(0, 200, 0) 0%, 
                                    rgb(255, 255, 0) 50%, 
                                    rgb(255, 0, 0) 100%)`
                                }}
                              />
                              {/* Индикатор текущего значения */}
                              <div 
                                className="absolute top-0 h-2.5 rounded-full bg-white dark:bg-gray-800 border-2"
                                style={{
                                  left: `${tannin}%`,
                                  width: '3px',
                                  marginLeft: '-1.5px',
                                  borderColor: getGradientColor(tannin),
                                  boxShadow: `0 0 4px ${getGradientColor(tannin)}`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Индикатор архива поверх карточки */}
                  {isArchived && (
                    <div className="absolute top-2 right-2 bg-gray-700/90 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                      В АРХИВЕ
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 z-50 w-full sabor-fixed bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe">
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

export default WineCatalogPage;
