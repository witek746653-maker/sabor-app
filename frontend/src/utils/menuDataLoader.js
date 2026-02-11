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
  'english': [
    '/data/menu-kitchen.json',
    '/data/menu-bar.json',
    '/data/menu-tea.json',
    '/data/menu-wine.json'
  ]
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

    const paths = Array.isArray(path) ? path : [path];
    const responses = await Promise.all(paths.map(p => fetch(p)));

    for (const res of responses) {
      if (!res.ok) throw new Error(`Failed to load menu: ${res.statusText}`);
    }

    const results = await Promise.all(responses.map(res => res.json()));
    let data = results.flat();

    if (!Array.isArray(data)) return [];

    // Фильтрация архивных позиций (только для тренажера)
    data = data.filter(item => item && item.status !== 'в архиве');

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
  // Утилита для обеспечения массива (некоторые поля в i18n могут быть строками)
  const toArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const audioPath = dish.i18n?.en?.['audio-en'];
  let audioUrl = null;
  if (audioPath) {
    // Если путь есть, убираем ../ и берем имя файла или формируем путь
    const fileName = audioPath.split('/').pop();
    audioUrl = `/audio/${dish.menu === 'Вино' ? 'wine' : 'en'}/${fileName}`;
  }

  const usefulPhrases = toArray(dish.i18n?.en?.['useful phrases & words'] || []);
  return {
    id: dish.id,
    title: dish.title,
    description: dish.description,
    image: dish.image?.src || '/images/zaglushka.webp',
    ingredients: toArray(dish.ingredients),
    allergens: toArray(dish.allergens),
    tags: toArray(dish.tags),
    contains: dish.contains || '',
    features: dish.features || '',
    section: dish.section || '',
    menu: dish.menu || '',
    // Английские данные
    titleEn: dish.i18n?.en?.['title-en'] || dish.title || '',
    descriptionEn: dish.i18n?.en?.['description-en'] || dish.description || '',
    sectionEn: dish.i18n?.en?.['section-en'] || dish.section || '',
    ingredientsEn: toArray(dish.i18n?.en?.['ingredients-en'] || dish.ingredients),
    allergensEn: toArray(dish.i18n?.en?.['allergens-en'] || dish.allergens),
    containsEn: dish.i18n?.en?.['contains-en'] || dish.contains || '',
    featuresEn: dish.i18n?.en?.['features-en'] || '',
    commentsEn: toArray(dish.i18n?.en?.['comments-en'] || []),
    usefulPhrases: usefulPhrases,
    audioUrl: audioUrl,
    // Поля для виз
    origin: dish.origin || '',
    producer: dish.producer || '',
    grapeVarieties: toArray(dish.grapeVarieties),
    comments: toArray(dish.comments),
    // Пытаемся достать произношение из первой фразы (например, "Gavi — pronounced 'GAH-vee'")
    pronunciation: usefulPhrases[0]?.includes('pronounced')
      ? usefulPhrases[0].split('pronounced')[1].split(',')[0].replace(/['"]/g, '').trim()
      : ''
  };
};

/**
 * Генерирует вопрос в зависимости от режима
 */
export const generateQuestion = (dish, mode, lang = 'RU') => {
  const menu = dish.menu || '';
  const section = dish.section || '';
  const isWine = menu === 'Вино' || menu === 'Винная карта';
  const isTea = menu === 'Чай';
  const isBeer = section.includes('Пиво') || section.includes('Beer');
  const isCocktail = (menu === 'Барное меню' || menu === 'Коктейли') && !isBeer;

  const getTerm = (caseType = 'acc') => {
    if (lang === 'EN') {
      return isWine ? 'wine' : isTea ? 'tea' : isCocktail ? 'cocktail' : isBeer ? 'beer' : 'dish';
    }
    const terms = {
      wine: { acc: 'вино', gen: 'вина', prep: 'вине' },
      tea: { acc: 'чай', gen: 'чая', prep: 'чае' },
      cocktail: { acc: 'коктейль', gen: 'коктейля', prep: 'коктейле' },
      beer: { acc: 'пиво', gen: 'пива', prep: 'пиве' },
      dish: { acc: 'блюдо', gen: 'блюда', prep: 'блюде' }
    };
    const key = isWine ? 'wine' : isTea ? 'tea' : isCocktail ? 'cocktail' : isBeer ? 'beer' : 'dish';
    return terms[key][caseType];
  };

  if (lang === 'EN') {
    const t = getTerm();
    switch (mode) {
      case 'description': return `Describe the ${t} to the guest beautifully`;
      case 'allergens': return 'Which features would you point out to the guest?';
      case 'composition': return `Describe the full composition and cooking features`;
      case 'english': {
        const variants = [
          `How would you say the name of this ${t} in English?`,
          `How about this ${t}?`,
          `And this?`,
          `What's this ${t} called in English?`,
          `Name this ${t} for the guest.`
        ];
        // Детерминированный выбор на основе ID (чексумма для равномерного распределения)
        const idStr = String(dish.id || '');
        const checksum = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const seed = checksum % variants.length;
        return variants[seed];
      }
      case 'characteristics': return `What are the main characteristics of this ${t}?`;
      case 'vocabulary': return 'Useful vocabulary and interesting facts';
      default: return `Tell about the ${t}`;
    }
  }

  switch (mode) {
    case 'description':
      return `Красиво опишите ${getTerm('acc')} гостю`;
    case 'allergens':
      return 'На какие особенности вы бы обратили внимание гостя?';
    case 'composition':
      return `Опишите полный состав ${getTerm('gen')} и особенности его приготовления?`;
    case 'english':
      return `Как произносится название этого ${getTerm('gen')} на английском?`;
    case 'characteristics':
      return `Назовите основные характеристики этого ${getTerm('gen')}?`;
    case 'vocabulary':
      return 'Полезная лексика и интересные факты';
    default:
      return `Расскажите о ${getTerm('prep')}`;
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

