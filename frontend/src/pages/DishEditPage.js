import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDish, updateDish, addDish, getMenus, getSections } from '../services/api';
import { getImageUrl } from '../utils/imageUtils';
import { useToast } from '../contexts/ToastContext';

function DishEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const toast = useToast();
  
  const [dish, setDish] = useState({
    title: '',
    description: '',
    contains: '',
    menu: '',
    section: '',
    tags: [],
    allergens: [],
    image: { src: '', alt: '' },
    status: 'актуально', // Статус блюда: 'актуально' или 'в архиве'
    i18n: { en: {} }, // Английские переводы
  });
  
  const [menus, setMenus] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [language, setLanguage] = useState('RU'); // Текущий язык: 'RU' или 'EN'
  const fileInputRef = React.useRef(null); // Ссылка на скрытый input для выбора файла
 
  // Набор аллергенов для админки: ID совпадает с ключами, которые потом
  // показываются на карточке блюда (там берём по ним эмодзи и подпись).
  // Здесь сразу показываем «плашки» как в базе официанта: эмодзи + текст.
  const allergenOptions = [
    { id: 'egg', name: 'Яйца', emoji: '🥚' },
    { id: 'sesame', name: 'Кунжут', emoji: '⚪️' },
    { id: 'mustard', name: 'Горчица', emoji: '🌭' },
    { id: 'cilantro', name: 'Кинза', emoji: '🌿' },
    { id: 'onion', name: 'Лук', emoji: '🧅' },
    { id: 'herbs', name: 'Зелень', emoji: '🌿' },
    { id: 'gluten', name: 'Глютен', emoji: '🌾' },
    { id: 'lactose', name: 'Лактоза', emoji: '🥛' },
    { id: 'nuts', name: 'Орехи', emoji: '🥜' },
    { id: 'fish', name: 'Рыба', emoji: '🐟' },
    { id: 'citrus', name: 'Цитрусы', emoji: '🍋' },
    { id: 'garlic', name: 'Чеснок', emoji: '🧄' },
    { id: 'chili pepper', name: 'Перец чили', emoji: '🌶️' },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const menusData = await getMenus();
        setMenus(menusData);
        
        if (!isNew) {
          const dishData = await getDish(id);
          // Инициализируем i18n, если его нет
          if (!dishData.i18n) {
            dishData.i18n = { en: {} };
          }
          setDish(dishData);
          if (dishData.allergens) {
            setSelectedAllergens(dishData.allergens);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, isNew]);

  useEffect(() => {
    const loadSections = async () => {
      if (dish.menu) {
        try {
          const sectionsData = await getSections(dish.menu);
          setSections(sectionsData);
        } catch (error) {
          console.error('Ошибка загрузки разделов:', error);
        }
      }
    };

    loadSections();
  }, [dish.menu]);

  const handleInputChange = (field, value) => {
    setDish((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !dish.tags.includes(currentTag.trim())) {
      setDish((prev) => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()],
      }));
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setDish((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleToggleAllergen = (allergenId) => {
    setSelectedAllergens((prev) => {
      if (prev.includes(allergenId)) {
        return prev.filter((a) => a !== allergenId);
      } else {
        return [...prev, allergenId];
      }
    });
  };

  // Обработчик выбора файла изображения
  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Создаем локальный URL для предпросмотра
      const localUrl = URL.createObjectURL(file);
      // Обновляем изображение (в реальном приложении нужно загрузить файл на сервер)
      // Пока просто используем имя файла как путь
      const fileName = file.name;
      handleInputChange('image', { 
        src: `../images/${fileName}`, 
        alt: dish.title || fileName 
      });
      // Очищаем input, чтобы можно было выбрать тот же файл снова
      e.target.value = '';
    }
  };

  // Обработчик клика на область загрузки изображения
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Переключение статуса блюда
  const handleToggleStatus = () => {
    const newStatus = dish.status === 'актуально' ? 'в архиве' : 'актуально';
    handleInputChange('status', newStatus);
  };

  // Получение значения поля в зависимости от языка
  const getFieldValue = (fieldName) => {
    if (language === 'EN' && dish.i18n?.en) {
      const enField = `${fieldName}-en`;
      return dish.i18n.en[enField] || dish[fieldName] || '';
    }
    return dish[fieldName] || '';
  };

  // Обновление значения поля в зависимости от языка
  const updateFieldValue = (fieldName, value) => {
    if (language === 'EN') {
      // Обновляем английское поле
      setDish((prev) => ({
        ...prev,
        i18n: {
          ...prev.i18n,
          en: {
            ...prev.i18n?.en,
            [`${fieldName}-en`]: value,
          },
        },
      }));
    } else {
      // Обновляем русское поле
      handleInputChange(fieldName, value);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dishToSave = {
        ...dish,
        allergens: selectedAllergens,
        // Убеждаемся, что статус сохранен
        status: dish.status || 'актуально',
        // Убеждаемся, что i18n структура сохранена
        i18n: dish.i18n || { en: {} },
      };

      if (isNew) {
        // Генерируем ID для нового блюда
        dishToSave.id = `dish-${Date.now()}`;
        await addDish(dishToSave);
      } else {
        await updateDish(id, dishToSave);
      }

      navigate('/admin');
    } catch (error) {
      toast.error('Ошибка сохранения: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  const imageUrl = dish.image?.src ? getImageUrl(dish.image.src) : '';

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-[#2c2420] p-4 pb-3 shadow-sm dark:border-b dark:border-white/5">
        <button
          onClick={() => navigate(-1)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-800 dark:text-white transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
          {isNew ? 'Добавление блюда' : 'Редактирование блюда'}
        </h2>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-6 p-4 pb-32 overflow-y-auto">
        {/* Кнопка изменения статуса */}
        {!isNew && (
          <section className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-white text-sm font-bold">Статус блюда</label>
            <button
              onClick={handleToggleStatus}
              className={`w-full h-12 rounded-xl font-bold transition-all ${
                dish.status === 'актуально'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-400 hover:bg-gray-500 text-white'
              }`}
            >
              {dish.status === 'актуально' ? '✓ Активно' : '⊘ В архиве'}
            </button>
            <p className="text-slate-500 dark:text-slate-400 text-xs px-1">
              {dish.status === 'актуально' 
                ? 'Блюдо отображается в пользовательском меню' 
                : 'Блюдо скрыто из пользовательского меню, видно только в админке'}
            </p>
          </section>
        )}

        {/* Image Upload */}
        <section className="flex flex-col gap-3">
          <div 
            onClick={handleImageClick}
            className="group relative w-full aspect-video rounded-xl bg-slate-100 dark:bg-[#2c2420] border-2 border-dashed border-slate-300 dark:border-white/10 overflow-hidden cursor-pointer hover:border-primary transition-colors"
          >
            {imageUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-80 group-hover:opacity-60 transition-opacity"
                style={{ backgroundImage: `url('${imageUrl}')` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-gray-400 text-6xl">restaurant</span>
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm shadow-lg mb-2">
                <span className="material-symbols-outlined">photo_camera</span>
              </div>
              <span className="text-white font-medium drop-shadow-md text-sm">Изменить фото</span>
            </div>
          </div>
          {/* Скрытый input для выбора файла */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileSelect}
            className="hidden"
          />
          <p className="text-slate-500 dark:text-slate-400 text-sm px-1">
            Нажмите на фото, чтобы выбрать файл изображения с компьютера.
          </p>
          <input
            type="text"
            placeholder="Или введите URL изображения (например: ../images/filename.webp или полный URL)"
            value={dish.image?.src || ''}
            onChange={(e) => handleInputChange('image', { src: e.target.value, alt: dish.title })}
            className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:focus:border-primary h-12 px-4"
          />
        </section>

        {/* Language Selector */}
        <section>
          <div className="flex w-full p-1 bg-slate-200 dark:bg-[#3a302a] rounded-xl mb-4">
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="lang"
                value="RU"
                checked={language === 'RU'}
                onChange={() => setLanguage('RU')}
                className="peer sr-only"
              />
              <div className="flex items-center justify-center py-2 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 peer-checked:bg-white dark:peer-checked:bg-[#52453e] peer-checked:text-primary peer-checked:shadow-sm transition-all">
                RU
              </div>
            </label>
            <label className="flex-1 cursor-pointer">
              <input 
                type="radio" 
                name="lang" 
                value="EN" 
                checked={language === 'EN'}
                onChange={() => setLanguage('EN')}
                className="peer sr-only" 
              />
              <div className="flex items-center justify-center py-2 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 peer-checked:bg-white dark:peer-checked:bg-[#52453e] peer-checked:text-primary peer-checked:shadow-sm transition-all">
                EN
              </div>
            </label>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-sm font-bold">
                {language === 'EN' ? 'Название блюда (EN)' : 'Название блюда'}
              </label>
              <input
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:focus:border-primary h-12 px-4"
                placeholder={language === 'EN' ? 'Enter dish name (EN)' : 'Введите название'}
                type="text"
                value={getFieldValue('title')}
                onChange={(e) => updateFieldValue('title', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-sm font-bold">
                {language === 'EN' ? 'Полное описание (EN)' : 'Полное описание'}
              </label>
              <textarea
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:focus:border-primary p-4 min-h-[100px] resize-y"
                placeholder={language === 'EN' ? 'Describe the dish (EN)' : 'Опишите состав и вкус блюда'}
                value={getFieldValue('description')}
                onChange={(e) => updateFieldValue('description', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-sm font-bold">
                {language === 'EN' ? 'Список ингредиентов (EN)' : 'Список ингредиентов'}
              </label>
              <textarea
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:focus:border-primary p-4 min-h-[100px] resize-y"
                placeholder={language === 'EN' ? 'List ingredients (EN)' : 'Перечислите ингредиенты через запятую'}
                value={getFieldValue('contains')}
                onChange={(e) => updateFieldValue('contains', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-sm font-bold">
                {language === 'EN' ? 'Меню (EN)' : 'Меню'}
              </label>
              <select
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white focus:border-primary focus:ring-primary dark:focus:border-primary h-12 px-4"
                value={language === 'EN' ? (dish.i18n?.en?.['menu-en'] || dish.menu || '') : (dish.menu || '')}
                onChange={(e) => {
                  if (language === 'EN') {
                    updateFieldValue('menu', e.target.value);
                  } else {
                    handleInputChange('menu', e.target.value);
                  }
                }}
              >
                <option value="">{language === 'EN' ? 'Select menu' : 'Выберите меню'}</option>
                {menus.map((menu) => (
                  <option key={menu} value={menu}>
                    {menu}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-sm font-bold">
                {language === 'EN' ? 'Раздел (EN)' : 'Раздел'}
              </label>
              <select
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white focus:border-primary focus:ring-primary dark:focus:border-primary h-12 px-4"
                value={language === 'EN' ? (dish.i18n?.en?.['section-en'] || dish.section || '') : (dish.section || '')}
                onChange={(e) => {
                  if (language === 'EN') {
                    updateFieldValue('section', e.target.value);
                  } else {
                    handleInputChange('section', e.target.value);
                  }
                }}
                disabled={!dish.menu}
              >
                <option value="">{language === 'EN' ? 'Select section' : 'Выберите раздел'}</option>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <hr className="border-slate-200 dark:border-white/5 my-2" />

        {/* Tags */}
        <section className="space-y-6">
          <div className="flex flex-col gap-3">
            <label className="text-slate-900 dark:text-white text-sm font-bold">Теги</label>
            <div className="flex flex-wrap gap-2">
              {dish.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-primary-dark"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Добавить тег"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  className="px-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400 text-sm bg-transparent focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleAddTag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400 text-sm hover:border-primary hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Добавить
                </button>
              </div>
            </div>
          </div>

          {/* Allergens */}
          <div className="flex flex-col gap-3">
            <label className="text-slate-900 dark:text-white text-sm font-bold">Аллергены</label>
            <div className="flex flex-wrap gap-2">
              {allergenOptions.map((allergen) => {
                const isSelected = selectedAllergens.includes(allergen.id);
                return (
                  <button
                    key={allergen.id}
                    onClick={() => handleToggleAllergen(allergen.id)}
                    type="button"
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold tracking-wide uppercase transition-all ${
                      isSelected
                        ? 'bg-orange-100/90 dark:bg-orange-900/40 border-orange-300 dark:border-orange-500 text-amber-900 dark:text-amber-100 shadow-sm'
                        : 'bg-white/90 dark:bg-[#2c2420] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-orange-200 hover:bg-orange-50/80 dark:hover:bg-orange-900/20'
                    }`}
                  >
                    <span className="text-base leading-none">
                      {allergen.emoji}
                    </span>
                    <span className="leading-tight">
                      {allergen.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 p-4 bg-white dark:bg-[#2c2420] border-t border-slate-100 dark:border-white/5 z-20 safe-pb w-full sabor-fixed">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-white/20 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dish.title}
            className="flex-1 h-12 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default DishEditPage;

