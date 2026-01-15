import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDish, updateDish, addDish, getMenus, getSections } from '../../services/api';
import { getImageUrl } from '../../utils/imageUtils';
import HelpPopover from '../../components/HelpPopover';

/**
 * DishEditPage - Страница редактирования/создания блюда
 * Отображается в центральной области AdminLayout
 */
function DishEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id || id === 'new';
  
  const [dish, setDish] = useState({
    title: '',
    description: '',
    contains: '',
    menu: '',
    section: '',
    tags: [],
    allergens: [],
    image: { src: '', alt: '' },
    status: 'актуально',
    i18n: { en: {} },
  });
  
  const [menus, setMenus] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [language, setLanguage] = useState('RU');
  const fileInputRef = React.useRef(null);
 
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

  // Если мы создаём новую позицию, можем предзаполнить menu из query (?menu=Вино / Барное меню)
  useEffect(() => {
    if (!isNew) return;
    const params = new URLSearchParams(location.search);
    const prefillMenu = params.get('menu');
    if (prefillMenu && !dish.menu) {
      setDish((prev) => ({
        ...prev,
        menu: prefillMenu,
      }));
    }
  }, [isNew, location.search, dish.menu]);

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

  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      const fileName = file.name;
      handleInputChange('image', { 
        src: `../images/${fileName}`, 
        alt: dish.title || fileName 
      });
      e.target.value = '';
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleToggleStatus = () => {
    const newStatus = dish.status === 'актуально' ? 'в архиве' : 'актуально';
    handleInputChange('status', newStatus);
  };

  const getFieldValue = (fieldName) => {
    if (language === 'EN' && dish.i18n?.en) {
      const enField = `${fieldName}-en`;
      return dish.i18n.en[enField] || dish[fieldName] || '';
    }
    return dish[fieldName] || '';
  };

  const updateFieldValue = (fieldName, value) => {
    if (language === 'EN') {
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
      handleInputChange(fieldName, value);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dishToSave = {
        ...dish,
        allergens: selectedAllergens,
        status: dish.status || 'актуально',
        i18n: dish.i18n || { en: {} },
      };

      if (isNew) {
        dishToSave.id = `dish-${Date.now()}`;
        await addDish(dishToSave);
      } else {
        await updateDish(id, dishToSave);
      }

      navigate('/admin');
    } catch (error) {
      alert('Ошибка сохранения: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  const imageUrl = dish.image?.src ? getImageUrl(dish.image.src) : '';

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      {/* Заголовок */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
          {isNew ? 'Добавление блюда' : 'Редактирование блюда'}
        </h2>
      </div>

      {/* Контент формы */}
      <div className="flex-1 space-y-6">
        {/* Статус */}
        {!isNew && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
                Статус блюда
              </label>
              <HelpPopover title="Справка: статус (актуально / в архиве)" icon="help">
                <div style={{ opacity: 0.9 }}>
                  Термин <b>архив</b>: позиция скрыта для гостей, но остаётся в админке.
                  <details>
                    <summary>Когда ставить “в архиве”</summary>
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      - блюдо временно недоступно
                      <br />- вы хотите сохранить историю, но не показывать гостям
                    </div>
                  </details>
                </div>
              </HelpPopover>
            </div>
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
            <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs px-1">
              {dish.status === 'актуально' 
                ? 'Блюдо отображается в пользовательском меню' 
                : 'Блюдо скрыто из пользовательского меню, видно только в админке'}
            </p>
          </section>
        )}

        {/* Изображение */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
              Изображение
            </label>
            <HelpPopover title="Справка: изображение" icon="help">
              <div style={{ opacity: 0.9 }}>
                Можно выбрать файл с компьютера или указать путь в поле ниже.
                <details>
                  <summary>Важно про пути</summary>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    Если вы укажете <code>../images/имя.webp</code>, файл должен реально существовать в папке изображений проекта/сборки.
                    <br />
                    Термин <b>URL</b>: адрес до картинки.
                  </div>
                </details>
              </div>
            </HelpPopover>
          </div>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileSelect}
            className="hidden"
          />
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm px-1">
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

        {/* Переключатель языка */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
              Язык редактирования
            </div>
            <HelpPopover title="Справка: RU/EN" icon="help">
              <div style={{ opacity: 0.9 }}>
                Переключатель RU/EN меняет <b>какое поле вы редактируете</b>.
                <details>
                  <summary>Как это хранится</summary>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    Русский текст хранится в обычных полях (например <code>title</code>).
                    <br />
                    Английский — в <code>i18n.en</code> (например <code>title-en</code>).
                    <br />
                    Термин <b>i18n</b>: “интернационализация”, хранение переводов.
                  </div>
                </details>
              </div>
            </HelpPopover>
          </div>
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

          {/* Поля формы */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
                  {language === 'EN' ? 'Название блюда (EN)' : 'Название блюда'}
                </label>
                <HelpPopover title="Справка: название" icon="help">
                  <div style={{ opacity: 0.9 }}>
                    Короткое название, которое видно в карточках и поиске.
                  </div>
                </HelpPopover>
              </div>
              <input
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:focus:border-primary h-12 px-4"
                placeholder={language === 'EN' ? 'Enter dish name (EN)' : 'Введите название'}
                type="text"
                value={getFieldValue('title')}
                onChange={(e) => updateFieldValue('title', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
                  {language === 'EN' ? 'Полное описание (EN)' : 'Полное описание'}
                </label>
                <HelpPopover title="Справка: описание" icon="help" size="lg">
                  <div style={{ opacity: 0.9 }}>
                    Это описание показывается в карточке блюда.
                    <details>
                      <summary>Совет</summary>
                      <div style={{ marginTop: 6, opacity: 0.9 }}>
                        Пишите “как для гостя”: вкус, текстура, важные особенности.
                      </div>
                    </details>
                  </div>
                </HelpPopover>
              </div>
              <textarea
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:focus:border-primary p-4 min-h-[100px] resize-y"
                placeholder={language === 'EN' ? 'Describe the dish (EN)' : 'Опишите состав и вкус блюда'}
                value={getFieldValue('description')}
                onChange={(e) => updateFieldValue('description', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
                  {language === 'EN' ? 'Список ингредиентов (EN)' : 'Список ингредиентов'}
                </label>
                <HelpPopover title="Справка: ингредиенты" icon="help" size="lg">
                  <div style={{ opacity: 0.9 }}>
                    Это поле используется как “состав блюда” (видно гостям).
                    <details>
                      <summary>Формат</summary>
                      <div style={{ marginTop: 6, opacity: 0.9 }}>
                        Сейчас это обычный текст. Можно писать:
                        <br />- через запятую: “креветки, лимон, масло…”
                        <br />- или списком (если вставляете разметку)
                      </div>
                    </details>
                  </div>
                </HelpPopover>
              </div>
              <textarea
                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2420] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:focus:border-primary p-4 min-h-[100px] resize-y"
                placeholder={language === 'EN' ? 'List ingredients (EN)' : 'Перечислите ингредиенты через запятую'}
                value={getFieldValue('contains')}
                onChange={(e) => updateFieldValue('contains', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
                  {language === 'EN' ? 'Меню (EN)' : 'Меню'}
                </label>
                <HelpPopover title="Справка: меню" icon="help">
                  <div style={{ opacity: 0.9 }}>
                    “Меню” — это крупная группа (например “Вино”, “Барное меню”, “Основное меню…”).
                  </div>
                </HelpPopover>
              </div>
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
              <div className="flex items-center gap-2">
                <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">
                  {language === 'EN' ? 'Раздел (EN)' : 'Раздел'}
                </label>
                <HelpPopover title="Справка: раздел" icon="help">
                  <div style={{ opacity: 0.9 }}>
                    “Раздел” — это подгруппа внутри меню (например “Аквариум”, “Закуски”…).
                    <br />
                    Список разделов зависит от выбранного меню.
                  </div>
                </HelpPopover>
              </div>
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

        {/* Теги и аллергены */}
        <section className="space-y-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">Теги</label>
              <HelpPopover title="Справка: теги" icon="help" size="lg">
                <div style={{ opacity: 0.9 }}>
                  Теги — это “ярлыки” для блюда (например “без чеснока”, “к вину”, “на компанию”).
                  <details>
                    <summary>Как использовать</summary>
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      Добавляйте короткие и понятные слова. Они показываются гостям как чипсы.
                    </div>
                  </details>
                </div>
              </HelpPopover>
            </div>
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

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold">Аллергены</label>
              <HelpPopover title="Справка: аллергены" icon="help" size="lg">
                <div style={{ opacity: 0.9 }}>
                  Аллергены показываются гостям отдельным блоком.
                  <details>
                    <summary>Важно</summary>
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      Если сомневаетесь — лучше отметить аллерген. Это вопрос безопасности гостя.
                    </div>
                  </details>
                </div>
              </HelpPopover>
            </div>
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
      </div>

      {/* Нижняя панель с кнопками */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10 flex gap-3">
        <button
          onClick={() => navigate('/admin')}
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
    </div>
  );
}

export default DishEditPage;
