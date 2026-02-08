/**
 * Утилита для загрузки и обработки данных меню для тренажера
 */

const MENU_PATHS = {
  'kitchen': '/data/menu-kitchen.json',
  'breakfast': '/data/menu-kitchen.json',
  'kids': '/data/menu-kitchen.json',
  'fest': '/data/menu-kitchen.json',
  'season': '/data/menu-kitchen.json',
  'bar': '/data/menu-bar.json',
  'wine': '/data/menu-wine.json',
  'tea': '/data/menu-tea.json',
  'english': '/data/menu-database.json'
};

const MENU_FILTERS = {
  'kitchen': ['Основное меню'],
  'breakfast': ['Авторские завтраки'],
  'kids': ['Детское меню', 'Летние каникулы'],
  'fest': ['Специальное меню'],
  'season': ['Зимнее меню', 'Постное меню'],
  'bar': ['Барное меню'],
  'wine': ['Вино'],
  'tea': ['Чай']
};

const MENU_NAMES = {
  'all': 'Все меню',
  'kitchen': 'Основное',
  'breakfast': 'Авторские завтраки',
  'kids': 'Детское',
  'fest': 'Фестивальное',
  'season': 'Сезонное',
  'wine': 'Винная карта',
  'bar': 'Коктейли',
  'tea': 'Чай',
  'english': 'English'
};

/**
 * Загружает данные меню из JSON
 */
export const loadMenuData = async (menuType) => {
  try {
    const path = MENU_PATHS[menuType];
    if (!path) {
      throw new Error(`Unknown menu type: ${menuType}`);
    }

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load menu: ${response.statusText}`);
    }

    let data = await response.json();
    if (!Array.isArray(data)) return [];

    // Фильтрация по конкретному меню, если нужно
    if (MENU_FILTERS[menuType]) {
      const allowedLabels = MENU_FILTERS[menuType];
      data = data.filter(item => allowedLabels.includes(item.menu));
    }

    // Специальная обработка для English: оставляем только те, где есть перевод
    if (menuType === 'english') {
      const excludedMenus = ['Вино', 'Чай', 'Барное меню'];
      data = data.filter(item =>
        item.i18n?.en?.['title-en'] &&
        !excludedMenus.includes(item.menu)
      );
    }

    return data;
  } catch (error) {
    console.error('Error loading menu data:', error);
    return [];
  }
};

/**
 * Фильтрует блюда по категории/секции (принимает строку или массив)
 */
export const filterByCategory = (dishes, category) => {
  if (!category || category === 'Все' || (Array.isArray(category) && category.includes('Все'))) {
    return dishes;
  }

  const categories = Array.isArray(category) ? category : [category];
  return dishes.filter(dish => categories.includes(dish.section));
};

/**
 * Получает уникальные категории из списка блюд
 */
export const getCategories = (dishes) => {
  const categories = new Set();
  dishes.forEach(dish => {
    if (dish.section) {
      categories.add(dish.section);
    }
  });
  return ['Все', ...Array.from(categories)];
};

/**
 * Маппит данные блюда в формат для тренажера
 */
export const mapToTrainingFormat = (dish) => {
  return {
    id: dish.id,
    title: dish.title,
    description: dish.description,
    image: dish.image?.src || '/images/zaglushka.webp',
    ingredients: dish.ingredients || [],
    allergens: dish.allergens || [],
    tags: dish.tags || [],
    contains: dish.contains || '',
    features: dish.features || '',
    section: dish.section || '',
    menu: dish.menu || '',
    // Английские данные
    titleEn: dish.i18n?.en?.['title-en'] || dish.title || '',
    descriptionEn: dish.i18n?.en?.['description-en'] || dish.description || '',
    sectionEn: dish.i18n?.en?.['section-en'] || dish.section || '',
    ingredientsEn: dish.i18n?.en?.['ingredients-en'] || dish.ingredients || [],
    allergensEn: dish.i18n?.en?.['allergens-en'] || dish.allergens || [],
    containsEn: dish.i18n?.en?.['contains-en'] || dish.contains || '',
    audioUrl: dish.i18n?.en?.['audio-en'] ?
      `/audio/${dish.menu === 'Вино' ? 'wine' : 'en'}/${dish.id}.mp3` : null
  };
};

/**
 * Генерирует вопрос в зависимости от режима
 */
export const generateQuestion = (dish, mode, lang = 'RU') => {
  if (lang === 'EN') {
    switch (mode) {
      case 'description':
        return 'Describe the dish to the guest beautifully';
      case 'allergens':
        return 'Which features would you point out to the guest?';
      case 'composition':
        return 'Describe the full composition and cooking features';
      case 'english':
        return 'How would you say the name of this dish in English?';
      default:
        return 'Tell about the dish';
    }
  }

  switch (mode) {
    case 'description':
      return 'Красиво опишите блюдо гостю';
    case 'allergens':
      return 'На какие особенности вы бы обратили внимание гостя?';
    case 'composition':
      return 'Опишите полный состав блюда и особенности его приготовления?';
    case 'english':
      return 'Как произносится название этого блюда на английском?';
    default:
      return 'Расскажите о блюде';
  }
};

/**
 * Загружает все данные для выбранных меню
 */
export const loadSelectedMenus = async (selectedMenus) => {
  const allDishes = [];

  for (const menuType of selectedMenus) {
    const dishes = await loadMenuData(menuType);
    allDishes.push(...dishes.map(mapToTrainingFormat));
  }

  return allDishes;
};

export { MENU_NAMES };

