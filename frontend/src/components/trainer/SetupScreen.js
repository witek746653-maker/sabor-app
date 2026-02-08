import React, { useState, useEffect } from 'react';
import { loadMenuData, getCategories } from '../../utils/menuDataLoader';
import trainerBg from '../../assets/trainer-bg.webp';


const MENU_CONFIG = [
  { id: 'kitchen', icon: 'restaurant_menu', label: 'Основное' },
  { id: 'breakfast', icon: 'bakery_dining', label: 'Завтраки' },
  { id: 'kids', icon: 'child_care', label: 'Детское' },
  { id: 'fest', icon: 'celebration', label: 'Фестиваль' },
  { id: 'season', icon: 'eco', label: 'Сезонное' },
  { id: 'wine', icon: 'wine_bar', label: 'Винная карта' },
  { id: 'bar', icon: 'local_bar', label: 'Коктейли' },
  { id: 'tea', icon: 'emoji_food_beverage', label: 'Чай' },
  { id: 'english', icon: 'translate', label: 'English' }
];

const TRAINING_MODES = [
  { id: 'description', icon: 'auto_awesome', color: '#19e66b', label: 'Красочное описание', subtitle: 'Описать блюдо гостю' },
  { id: 'allergens', icon: 'warning', color: '#19e66b', label: 'Особенности', subtitle: 'Аллергены и подача' },
  { id: 'composition', icon: 'inventory_2', color: '#19e66b', label: 'Состав', subtitle: 'Запомнить ингредиенты' },
  { id: 'mix', icon: 'shuffle', color: '#19e66b', label: 'Микс режим', subtitle: 'Случайные вопросы' },
  { id: 'english', icon: 'translate', color: '#19e66b', label: 'English', subtitle: 'Перевод названий' }
];

const CARD_COUNTS = [10, 20, 30, 50];

function SetupScreen({ onStart, onBack, initialConfig }) {
  const [selectedMenus, setSelectedMenus] = useState(initialConfig?.menus || []);
  const [selectedCategories, setSelectedCategories] = useState(initialConfig?.category || []);
  const [selectedMode, setSelectedMode] = useState(initialConfig?.mode || 'description');
  const [selectedCount, setSelectedCount] = useState(initialConfig?.count || 20);
  const [categories, setCategories] = useState(['Все']);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      const allDishes = [];
      const menusToLoad = selectedMenus;
      if (menusToLoad.length === 0) {
        setCategories(['Все']);
        return;
      }
      for (const menuId of menusToLoad) {
        try {
          const dishes = await loadMenuData(menuId);
          allDishes.push(...dishes);
        } catch (e) { console.error(e); }
      }
      const uniqueCats = getCategories(allDishes);
      setCategories(uniqueCats);

      setSelectedCategories(prev => {
        return prev.filter(c => uniqueCats.includes(c));
      });
    };
    loadCategories();
  }, [selectedMenus]);

  const toggleMenu = (menuId) => {
    setSelectedMenus(prev => prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]);
  };

  const handleAllMenusAction = () => {
    if (selectedMenus.length === MENU_CONFIG.length) {
      setSelectedMenus([]);
    } else {
      setSelectedMenus(MENU_CONFIG.map(m => m.id));
    }
  };

  const handleAllCategoriesAction = () => {
    const available = categories.filter(c => c !== 'Все');
    const isAllSelected = selectedCategories.includes('Все') ||
      (available.length > 0 && available.every(c => selectedCategories.includes(c)));

    if (isAllSelected) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(['Все']);
    }
  };

  const toggleCategory = (cat) => {
    if (cat === 'Все') {
      setSelectedCategories(['Все']);
      return;
    }

    setSelectedCategories(prev => {
      const filtered = prev.filter(c => c !== 'Все');
      if (filtered.includes(cat)) {
        return filtered.filter(c => c !== cat);
      } else {
        const next = [...filtered, cat];
        const available = categories.filter(c => c !== 'Все');
        if (available.length > 0 && available.every(c => next.includes(c))) {
          return ['Все'];
        }
        return next;
      }
    });
  };

  const handleStart = () => {
    if (selectedMenus.length === 0 || selectedCategories.length === 0) return;
    setLoading(true);
    onStart({
      menus: selectedMenus,
      category: selectedCategories,
      mode: selectedMode,
      count: selectedCount
    });
  };

  const isAllMenusSelected = selectedMenus.length === MENU_CONFIG.length && MENU_CONFIG.length > 0;
  const availableCats = categories.filter(c => c !== 'Все');
  const isAllCategoriesSelected = availableCats.length > 0 &&
    (selectedCategories.includes('Все') || availableCats.every(c => selectedCategories.includes(c)));

  return (
    <div
      className="min-h-screen text-white font-display max-w-md mx-auto shadow-2xl border-x border-white/5 pb-20 bg-[#0a140f]"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 20, 15, 0.4), rgba(10, 20, 15, 0.6)), url("${trainerBg}")`,
        backgroundSize: 'cover',

        backgroundPosition: 'center'
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a140f] flex items-center p-4 h-16">
        <button onClick={onBack} className="flex size-10 items-center justify-center rounded-full active:bg-white/10 transition-colors -ml-2">
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h2 className="flex-1 text-center text-lg font-bold">Выбор тренировки</h2>
      </header>

      <main className="p-4 flex flex-col gap-8">
        {/* 1. Блок Меню */}
        <section>
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-xl font-bold tracking-tight">Меню</h3>
            <button
              onClick={handleAllMenusAction}
              className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isAllMenusSelected ? 'text-[#ff453a]' : 'text-[#19e66b]/60 hover:text-[#19e66b]'
                }`}
            >
              {isAllMenusSelected ? 'Очистить все' : 'Выбрать все'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MENU_CONFIG.map(menu => {
              const isSelected = selectedMenus.includes(menu.id);
              return (
                <div key={menu.id} onClick={() => toggleMenu(menu.id)} className={`relative p-3 pt-4 rounded-2xl transition-all duration-300 border-2 cursor-pointer flex flex-col items-center text-center ${isSelected ? 'bg-[#16221c] border-[#19e66b] shadow-[0_0_15px_rgba(25,230,107,0.15)]' : 'bg-[#16221c] border-transparent opacity-60'
                  }`}>
                  <div className="absolute top-2 right-2">
                    {isSelected ?
                      <span className="material-symbols-outlined text-[#19e66b] text-[16px] fill-current">check_circle</span> :
                      <div className="size-3.5 rounded-full border border-white/10" />
                    }
                  </div>
                  <div className={`size-8 rounded-xl flex items-center justify-center mb-2 ${isSelected ? 'bg-[#19e66b]/20 text-[#19e66b]' : 'bg-white/5 text-white/40'}`}>
                    <span className="material-symbols-outlined text-[18px]">{menu.icon}</span>
                  </div>
                  <p className="text-[10px] font-bold leading-tight uppercase tracking-tighter line-clamp-2">{menu.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Блок Разделы */}
        <section>
          <div className="flex justify-between items-center mb-4 px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">Разделы</h3>
              <span className="px-2 py-0.5 rounded-full bg-[#19e66b]/10 text-[#19e66b] text-[10px] font-bold">
                {selectedCategories.includes('Все') ? availableCats.length : selectedCategories.length}
              </span>
            </div>
            <button
              onClick={handleAllCategoriesAction}
              className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isAllCategoriesSelected ? 'text-[#ff453a]' : 'text-[#19e66b]/60 hover:text-[#19e66b]'
                }`}
            >
              {isAllCategoriesSelected ? 'Очистить все' : 'Выбрать все'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              if (cat === 'Все' && categories.length > 1) return null;
              const isSelected = selectedCategories.includes(cat) || selectedCategories.includes('Все');

              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-4 py-2 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all border-2 flex items-center gap-2 ${isSelected
                    ? 'bg-[#16221c] text-[#19e66b] border-[#19e66b] shadow-[0_0_15px_rgba(25,230,107,0.1)]'
                    : 'bg-[#16221c]/40 border-transparent text-white/40 hover:text-white hover:border-[#1a3329]'
                    }`}
                >
                  {isSelected && <span className="material-symbols-outlined text-[14px] fill-current">check_circle</span>}
                  {cat === 'Все' ? 'Все разделы' : cat}
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Блок Режим */}
        <section className="pb-32">
          <h3 className="text-xl font-bold mb-4 px-1">Режим</h3>
          <div className="flex flex-col gap-2">
            {TRAINING_MODES.map(mode => {
              const isSelected = selectedMode === mode.id;
              return (
                <div key={mode.id} onClick={() => setSelectedMode(mode.id)} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'bg-[#16221c] border-[#19e66b]' : 'bg-[#16221c] border-transparent opacity-60'
                  }`}>
                  <div className={`size-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-[#19e66b]/10 text-[#19e66b]' : 'bg-white/5 text-white/20'}`}>
                    <span className="material-symbols-outlined text-[22px]">{mode.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm tracking-tight">{mode.label}</p>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{mode.subtitle}</p>
                  </div>
                  {isSelected && <span className="material-symbols-outlined text-[#19e66b] fill-current text-[22px]">check_circle</span>}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-[#0a140f] border-t border-white/5 z-50 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          {/* Компактный выбор количества */}
          <div className="flex bg-[#16221c] p-1 rounded-2xl border border-white/5 h-16 items-center px-1.5 gap-1">
            {CARD_COUNTS.map(count => (
              <button
                key={count}
                onClick={() => setSelectedCount(count)}
                className={`size-9 rounded-xl text-[11px] font-black transition-all border-2 ${selectedCount === count
                  ? 'bg-[#16221c] text-[#19e66b] border-[#19e66b]'
                  : 'bg-transparent border-transparent text-white/40 hover:text-white'
                  }`}
              >
                {count}
              </button>
            ))}
            <button
              onClick={() => setSelectedCount('all')}
              className={`px-2.5 h-9 rounded-xl text-[10px] font-black transition-all border-2 ${selectedCount === 'all'
                ? 'bg-[#16221c] text-[#19e66b] border-[#19e66b]'
                : 'bg-transparent border-transparent text-white/40 hover:text-white'
                }`}
            >
              ВСЕ
            </button>
          </div>

          <button
            onClick={handleStart}
            disabled={loading || selectedMenus.length === 0 || selectedCategories.length === 0}
            className={`flex-1 font-extrabold text-base h-16 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all border-2 ${selectedMenus.length === 0 || selectedCategories.length === 0
              ? 'bg-white/5 text-white/20 border-transparent cursor-not-allowed shadow-none'
              : 'bg-[#16221c] text-[#19e66b] border-[#19e66b] shadow-[0_0_20px_rgba(25,230,107,0.2)] hover:shadow-[0_0_30px_rgba(25,230,107,0.3)]'
              }`}
          >
            {loading ? 'ГОТОВИМ...' : (
              <>

                СТАРТУЕМ
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default SetupScreen;
