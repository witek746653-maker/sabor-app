const searchInput = document.getElementById('searchInput');
const menuChips = document.getElementById('menuChips');
const allergenChips = document.getElementById('allergenChips');
const tagChips = document.getElementById('tagChips');
const cardsContainer = document.getElementById('cards');
const resultsCount = document.getElementById('resultsCount');
const emptyState = document.getElementById('emptyState');
const toggleEditBtn = document.getElementById('toggleEdit');
const addDishBtn = document.getElementById('addDishBtn');
const refreshBtn = document.getElementById('refreshBtn');
const editor = document.getElementById('editor');
const editorForm = document.getElementById('editorForm');
const editorTitle = document.getElementById('editorTitle');
const closeEditorBtn = document.getElementById('closeEditor');
const saveDishBtn = document.getElementById('saveDish');
const deleteDishBtn = document.getElementById('deleteDish');
const toast = document.getElementById('toast');
const dishModal = document.getElementById('dishModal');
const modalContent = document.getElementById('modalContent');
const modalCloseBtn = document.getElementById('modalClose');
const englishModal = document.getElementById('englishModal');
const englishModalContent = document.getElementById('englishModalContent');
const englishModalCloseBtn = document.getElementById('englishModalClose');
const pairingPreview = document.getElementById('pairingPreview');
const pairingContent = document.getElementById('pairingContent');
const pairingCloseBtn = document.getElementById('pairingClose');

const EDIT_PASSWORD = '5878';

const state = {
  dishes: [],
  enriched: [],
  filtered: [],
  fuse: null,
  filters: {
    query: '',
    menus: new Set(),
    allergens: new Set(),
    tags: new Set()
  },
  editMode: false,
  hasEditAccess: false,
  editingId: null,
  serverAvailable: true,
  dataSource: null,
  dataLoadedAt: null
};

const ALLERGEN_PRIORITY = [
  'орехи',
  'лактоза',
  'глютен',
  'яйца',
  'морепродукты',
  'рыба',
  'цитрусы',
  'кунжут',
  'горчица',
  'nuts',
  'lactose',
  'gluten',
  'eggs',
  'seafood',
  'fish',
  'citrus',
  'sesame',
  'mustard'
];

const ALLERGEN_ICONS = {
  орехи: '🥜',
  лактоза: '🥛',
  глютен: '🌾',
  яйца: '🥚',
  цитрусы: '🍋',
  морепродукты: '🍤',
  рыба: '🐟',
  кунжут: '⚪️',
  горчица: '🌭',
  чеснок: '🧄',
  лук: '🧅',
  'перец чили': '🌶️',
  кинза: '🌿',
  алкоголь: '🍷',
  грибы: '🍄',
  мёд: '🍯',
  трюфель: '🍄',
  свинина: '🐖',
  эстрагон: '🌿',
  халапеньо: '🌶️',
  шафран: '🧡',
  зелень: '🌿',
  nuts: '🥜',
  lactose: '🥛',
  gluten: '🌾',
  eggs: '🥚',
  citrus: '🍋',
  seafood: '🍤',
  fish: '🐟',
  sesame: '⚪️',
  mustard: '🌭',
  garlic: '🧄',
  onion: '🧅',
  "chili pepper": '🌶️',
  cilantro: '🌿',
  alcohol: '🍷',
  mushrooms: '🍄',
  honey: '🍯',
  truffle: '🍄',
  pork: '🐖',
  tarragon: '🌿',
  jalapeño: '🌶️',
  saffron: '🧡',
  herbs: '🌿'
};

const FEATURE_ICON_TAGS = {
  острое: { icon: '🌶️', label: 'Острое' },
  вегетарианское: { icon: '🌱', label: 'Вегетарианское' },
  веганское: { icon: '🥦', label: 'Веганское' },
  'долгое ожидание': { icon: '⏳', label: 'Долгое ожидание' }
};

const TAG_GROUPS = [
  {
    title: 'Особенности блюда',
    categories: [
      {
        title: 'Ограничения',
        tags: [
          'без глютена',
          'без лактозы',
          'без орехов',
          'без цитрусов',
          'без грибов',
          'без чеснока',
          'без лука',
          'веганское',
          'вегетарианское',
          'низкоуглеводное'
        ]
      },
      {
        title: 'Фудпэринг',
        tags: ['к вину', 'к пиву', 'к водке']
      },
      {
        title: 'Формат подачи / ситуация',
        tags: ['на компанию', 'долгое ожидание', 'постное меню']
      },
      {
        title: 'Характер блюда',
        tags: ['лёгкое блюдо', 'сытное блюдо', 'на кости', 'с алкоголем', 'сырой продукт', 'medium', 'острое', 'сладкий соус']
      },
      {
        title: 'Тип продукта',
        tags: ['говядина', 'баранина', 'свинина', 'курица', 'утка', 'кролик', 'рыба', 'морепродукты']
      }
    ]
  },
  {
    title: 'Вина',
    categories: [
      {
        title: 'Страна',
        tags: ['Аргентина', 'Германия', 'Испания', 'Италия', 'Новая Зеландия', 'США', 'Франция']
      },
      {
        title: 'Тип и стиль',
        tags: ['белое', 'красное', 'розовое', 'игристое', 'brut', 'полусладкое', 'сухое', 'танинное', 'лёгкое', 'полнотелое', 'мягкое', 'среднетелое']
      },
      {
        title: 'Сорта винограда',
        tags: ['Glera', 'Cabernet Sauvignon', 'Chardonnay', 'Malbec', 'Merlot', 'Pinot Grigio', 'Pinot Noir', 'Sauvignon Blanc', 'Syrah/Shiraz', 'Tempranillo', 'Trebbiano', 'Sangiovese', 'Zinfandel', 'Grenache/Garnacha', 'Riesling', 'Pinot Meunier', 'Malvasia Nera', 'Verdiso', 'Corvina', 'Rondinella', 'Molinara', 'Perera', 'Trebbiano', 'Canaiolo Nero', 'Grolleau', 'Carignano', 'Fumin', 'Cortese', 'Cinsaut', 'Clairette', 'Petit Verdot']
      },
      {
        title: 'Категории подачи',
        tags: ['аперитив', 'дижестив', 'универсальное']
      }
    ]
  }
];

const COCKTAIL_TAG_SECTIONS = [
  {
    title: 'Тип',
    tags: ['классический', 'авторский']
  },
  {
    title: 'База',
    tags: [
      'водка',
      'джин',
      'ром',
      'текила',
      'виски',
      'бурбон',
      'коньяк',
      'бренди',
      'ликёр',
      'вермут',
      'мескаль',
      'портвейн',
      'вино'
    ]
  },
  {
    title: 'Вкусовой профиль',
    tags: [
      'кислый',
      'сладкий',
      'горький',
      'пряный',
      'фруктовый',
      'ягодный',
      'травяной',
      'цитрусовый',
      'сливочный',
      'кремовый',
      'сухой'
    ]
  },
  {
    title: 'Крепость',
    tags: ['лёгкий', 'средний', 'крепкий', 'без алкоголя']
  },
  {
    title: 'Тип подачи',
    tags: ['short drink', 'long drink', 'highball', 'on the rocks', 'без льда', 'со льдом', 'горячий']
  },
  
];

const CYRILLIC_REGEX = /[А-Яа-яЁё]/;
const LATIN_REGEX = /[A-Za-z]/;

function formatDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function detectLanguage(text = '') {
  const hasCyrillic = CYRILLIC_REGEX.test(text);
  const hasLatin = LATIN_REGEX.test(text);
  if (hasCyrillic) return 'ru';
  if (hasLatin) return 'en';
  return 'ru';
}

function applyLanguage(element, text) {
  if (!element) return;
  element.setAttribute('lang', detectLanguage(text));
}

function markNeutralLanguage(element) {
  if (!element) return;
  element.setAttribute('lang', 'ru');
}

function detectScriptByWord(text = '') {
  const hasLatin = LATIN_REGEX.test(text);
  const hasCyrillic = CYRILLIC_REGEX.test(text);
  if (hasLatin && !hasCyrillic) return 'latin';
  if (hasCyrillic && !hasLatin) return 'cyrillic';
  return null;
}

function colorizeEnglishTextNodes(root) {
  if (!root || typeof document?.createTreeWalker !== 'function') return;

  const targets = root.querySelectorAll('.modal-description, .rich-text, .meta-block ul li');

  const wrapTextNode = (textNode) => {
    const content = textNode.textContent;
    if (!content || !content.trim()) return;

    const fragment = document.createDocumentFragment();
    const parts = content.split(/(\s+)/);

    parts.forEach((part) => {
      if (!part) return;
      const script = detectScriptByWord(part);
      if (script === 'latin' || script === 'cyrillic') {
        const span = document.createElement('span');
        span.classList.add('english-word', `english-word--${script}`);
        span.setAttribute('lang', script === 'latin' ? 'en' : 'ru');
        span.textContent = part;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    textNode.replaceWith(fragment);
  };

  targets.forEach((node) => {
    if (node.closest('.allergen-badges') || node.closest('.tags')) return;

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }
    textNodes.forEach(wrapTextNode);
  });
}

function decorateDishWithUpdateMeta(dish, source) {
  const clone = { ...dish };
  const resolvedSource = dish.update_source || source;

  if (resolvedSource) {
    Object.defineProperty(clone, '_updateSource', {
      value: resolvedSource,
      enumerable: false
    });
  }

  if (state.dataLoadedAt) {
    Object.defineProperty(clone, '_loadedAt', {
      value: state.dataLoadedAt,
      enumerable: false
    });
  }

  return clone;
}

function decorateDatasetWithUpdateMeta(dishes, source) {
  return dishes.map((dish) => decorateDishWithUpdateMeta(dish, source));
}

let toastTimeout = null;
let isSaving = false;
let lastFocusedElement = null;
let lastEnglishFocused = null;
const compactCardsQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(max-width: 640px)')
  : null;

const fuseOptions = {
  keys: [
    'title',
    'menu',
    'section',
    'description',
    'contains',
    'features',
    'status',
    'source_file',
    'ingredients',
    'allergens',
    'pairings.wines',
    'pairings.drinks',
    'pairings.dishes',
    'pairings.notes',
    'tags',
    'i18n.en.title-en',
    'i18n.en.description-en'
  ],
  threshold: 0.0,          // 👈 только точное вхождение строки
  ignoreLocation: true,
  minMatchCharLength: 2
};

function getEnglishTranslation(dish) {
  const enData = dish.i18n?.en;
  if (!enData) return null;
  const toList = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  };
  return {
    menu: (enData['menu-en'] || '').trim(),
    section: (enData['section-en'] || '').trim(),
    title: (enData['title-en'] || '').trim(),
    description: (enData['description-en'] || '').trim(),
    contains: (enData['contains-en'] || '').trim(),
    allergens: parseList(enData['allergens-en'] || ''),
    tags: parseList(enData['tags-en'] || ''),
    audio: (enData['audio-en'] || '').trim(),
    comments: toList(enData['comments-en'] || []),
    usefulPhrases: toList(enData['useful phrases & words'] || [])
  };
}

function hasEnglishContent(translation) {
  if (!translation) return false;
  const { menu, section, title, description, contains, allergens, tags, comments, usefulPhrases, audio } = translation;
  return Boolean(
    menu ||
    section ||
    title ||
    description ||
    contains ||
    audio ||
    (Array.isArray(allergens) && allergens.length) ||
    (Array.isArray(tags) && tags.length) ||
    (Array.isArray(comments) && comments.length) ||
    (Array.isArray(usefulPhrases) && usefulPhrases.length)
  );
}

function buildEnglishDish(dish) {
  const translation = getEnglishTranslation(dish);
  if (!hasEnglishContent(translation)) return null;
  const englishDish = decorateDishWithUpdateMeta({
    id: dish.id,
    menu: translation.menu,
    section: translation.section,
    title: translation.title,
    description: translation.description,
    contains: translation.contains,
    allergens: translation.allergens,
    tags: translation.tags,
    comments: translation.comments,
    usefulPhrases: translation.usefulPhrases,
    audio_en: translation.audio,
    updated_at: dish.updated_at,
    source_file: dish.source_file,
    image: dish.image ? { ...dish.image } : null,
    features: null,
    ingredients: [],
    pairings: null,
    i18n: null
  }, dish._updateSource || state.dataSource);
  englishDish['audio-en'] = englishDish.audio_en;
  return englishDish;
}

function getWorkingDishes() {
  return state.enriched && state.enriched.length ? state.enriched : state.dishes;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.slice();
  if (value) return [value];
  return [];
}

function clonePairings(pairings = {}) {
  const wines = ensureArray(pairings.wines || []);
  const drinks = ensureArray(pairings.drinks || []);
  const dishes = ensureArray(pairings.dishes || []);
  const notes = ensureArray(pairings.notes || []);

  const cloned = { wines, drinks, dishes };
  if (notes.length) {
    cloned.notes = notes;
  }
  return cloned;
}

function addUniqueItem(list, value) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return;
  const exists = list.some((item) => normalize(item) === normalizedValue);
  if (!exists) {
    list.push(value);
  }
}

function detectItemCategory(dish) {
  const menu = normalize(dish.menu);
  const section = normalize(dish.section);
  if (menu.includes('вино') || section.includes('вино')) {
    return 'wine';
  }
  if (menu.includes('напит') || menu.includes('бар') || section.includes('напит') || section.includes('бар')) {
    return 'drink';
  }
  return 'dish';
}

function enrichPairings(dishes) {
  const clones = dishes.map((dish) => {
    const clone = {
      ...dish,
      pairings: clonePairings(dish.pairings)
    };

    return decorateDishWithUpdateMeta(clone, dish._updateSource || state.dataSource);
  });

  const titleToIndex = new Map();
  clones.forEach((dish, index) => {
    const key = normalize(dish.title);
    if (!key) return;
    if (!titleToIndex.has(key)) {
      titleToIndex.set(key, []);
    }
    titleToIndex.get(key).push(index);
  });

  const categoryCache = new Map();
  function getReverseCategory(item) {
    if (categoryCache.has(item.id)) {
      return categoryCache.get(item.id);
    }
    const category = detectItemCategory(item);
    const reverse = category === 'wine' ? 'wines' : category === 'drink' ? 'drinks' : 'dishes';
    categoryCache.set(item.id, reverse);
    return reverse;
  }

  clones.forEach((dish, sourceIndex) => {
    const sourceTitle = dish.title;
    if (!sourceTitle) return;
    const reverseCategory = getReverseCategory(dish);
    const pairings = dish.pairings || {};

    ensureArray(pairings.wines).forEach((wineName) => {
      const matches = titleToIndex.get(normalize(wineName));
      if (!matches) return;
      matches.forEach((targetIndex) => {
        addUniqueItem(clones[targetIndex].pairings.dishes, sourceTitle);
      });
    });

    ensureArray(pairings.drinks).forEach((drinkName) => {
      const matches = titleToIndex.get(normalize(drinkName));
      if (!matches) return;
      matches.forEach((targetIndex) => {
        addUniqueItem(clones[targetIndex].pairings.dishes, sourceTitle);
      });
    });

    ensureArray(pairings.dishes).forEach((pairName) => {
      const matches = titleToIndex.get(normalize(pairName));
      if (!matches) return;
      matches.forEach((targetIndex) => {
        addUniqueItem(clones[targetIndex].pairings[reverseCategory], sourceTitle);
      });
    });
  });

  return clones;
}

function refreshViewData() {
  state.enriched = enrichPairings(state.dishes);
  rebuildFuse();
  rebuildFilters();
  applyFilters();
}

function normalize(value) {
  return (value || '').toString().trim().toLowerCase();
}

function getFeatureTagIcons(dish) {
  const tags = Array.isArray(dish?.tags) ? dish.tags : [];
  const icons = [];
  const seen = new Set();

  tags.forEach((tag) => {
    const normalized = normalize(tag);
    const featureIcon = FEATURE_ICON_TAGS[normalized];
    if (!featureIcon || seen.has(normalized)) return;
    icons.push({ icon: featureIcon.icon, label: featureIcon.label || tag });
    seen.add(normalized);
  });

  return icons;
}

function debounce(fn, wait = 200) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function getAllergenPriority(label) {
  const normalized = normalize(label);
  const index = ALLERGEN_PRIORITY.indexOf(normalized);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function getAllergenIcon(label) {
  return ALLERGEN_ICONS[normalize(label)] || '⚠️';
}

function sortAllergens(allergens) {
  return [...allergens].sort((a, b) => {
    const priorityDiff = getAllergenPriority(a) - getAllergenPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.localeCompare(b, 'ru');
  });
}

function sortAllergenEntries(entries) {
  return [...entries].sort((a, b) => {
    const priorityDiff = getAllergenPriority(a[1]) - getAllergenPriority(b[1]);
    if (priorityDiff !== 0) return priorityDiff;
    return a[1].localeCompare(b[1], 'ru');
  });
}

function shouldUseCompactTitles() {
  if (compactCardsQuery) {
    return compactCardsQuery.matches;
  }
  return typeof window !== 'undefined' ? window.innerWidth <= 640 : false;
}

function formatCardTitle(title) {
  if (!title) return '';
  if (!shouldUseCompactTitles()) {
    return title;
  }

  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return words.join(' ');
  }

  return `${words.slice(0, 4).join(' ')}…`;
}

function showToast(message, isError = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('error', 'success');
  toast.classList.add(isError ? 'error' : 'success');
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function requestEditAccess() {
  if (state.hasEditAccess) {
    return true;
  }

  const input = typeof window !== 'undefined'
    ? window.prompt('Введите пароль для редактирования картотеки официанта')
    : null;

  if (input === null) {
    return false;
  }

  if (input.trim() === EDIT_PASSWORD) {
    state.hasEditAccess = true;
    showToast('Доступ к редактированию открыт.');
    return true;
  }

  showToast('Неверный пароль.', true);
  return false;
}

function setEditAvailability(available) {
  state.serverAvailable = available;
  toggleEditBtn.disabled = !available;
  addDishBtn.disabled = !available;
  deleteDishBtn.disabled = !available;
  saveDishBtn.disabled = !available;

  if (!available && state.editMode) {
    state.editMode = false;
    document.body.classList.remove('edit-mode');
    toggleEditBtn.textContent = 'Включить редактирование';
    closeEditorPanel();
  }

  if (!available) {
    state.hasEditAccess = false;
    showToast('Редактирование недоступно: нет соединения с API.', true);
  }
}

async function loadData(showMessage = false) {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Обновляем...';

  try {
    const response = await fetch('../api/dishes', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    state.dataSource = 'api';
    state.dataLoadedAt = new Date();
    state.dishes = Array.isArray(data)
      ? decorateDatasetWithUpdateMeta(
          data.filter((item) => !('_menu' in item)),
          state.dataSource
        )
      : [];
    refreshViewData();
    setEditAvailability(true);
    if (showMessage) {
      showToast('Данные обновлены.');
    }
  } catch (error) {
    console.error(error);
    try {
      const files = [
        '../data/menu-kitchen.json',
        '../data/menu-bar.json',
        '../data/menu-tea.json',
        '../data/menu-wine.json'
      ];
      
      const responses = await Promise.all(files.map(url => fetch(url, { cache: 'no-store' })));
      const results = await Promise.all(responses.map(res => res.json()));
      const combined = results.flat();

      state.dataSource = 'local-files';
      state.dataLoadedAt = new Date();
      state.dishes = Array.isArray(combined)
        ? decorateDatasetWithUpdateMeta(
            combined.filter((item) => item && !('_menu' in item)),
            state.dataSource
          )
        : [];
      refreshViewData();
      setEditAvailability(false);
      showToast('Показаны данные из локальных файлов. Для сохранения изменений запустите сервер API.', true);
    } catch (fallbackError) {
      console.error(fallbackError);
      cardsContainer.innerHTML = '';
      resultsCount.textContent = '0 позиций';
      emptyState.style.display = 'block';
      setEditAvailability(false);
      showToast('Не удалось загрузить данные (ошибка файлов).', true);
    }
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Обновить данные';
  }
}

function rebuildFuse() {
  state.fuse = new Fuse(getWorkingDishes(), fuseOptions);
}

function uniqueValues(dishes, getter) {
  const values = new Map();
  dishes.forEach((dish) => {
    const items = getter(dish);
    items.forEach((item) => {
      const norm = normalize(item);
      if (!norm || values.has(norm)) return;
      values.set(norm, item);
    });
  });
  return Array.from(values.entries()).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
}

function buildChipGroup(container, entries, selectedSet) {
  const existingSelections = new Set(selectedSet);
  container.innerHTML = '';

  const normalizedAvailable = new Set(entries.map(([norm]) => norm));
  selectedSet.clear();
  existingSelections.forEach((value) => {
    if (normalizedAvailable.has(value)) {
      selectedSet.add(value);
    }
  });

  entries.forEach(([norm, label]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.dataset.value = norm;
    if (selectedSet.has(norm)) {
      chip.classList.add('active');
    }
    chip.addEventListener('click', () => {
      if (selectedSet.has(norm)) {
        selectedSet.delete(norm);
        chip.classList.remove('active');
      } else {
        selectedSet.add(norm);
        chip.classList.add('active');
      }
      applyFilters();
    });
    container.appendChild(chip);
  });
}

function buildTagGroups(entries) {
  const existingSelections = new Set(state.filters.tags);
  const normalizedAvailable = new Set(entries.map(([norm]) => norm));

  state.filters.tags.clear();
  existingSelections.forEach((value) => {
    if (normalizedAvailable.has(value)) {
      state.filters.tags.add(value);
    }
  });

  const entryMap = new Map(entries);
  const used = new Set();
  tagChips.innerHTML = '';

  const createChip = (norm, label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.dataset.value = norm;

    if (state.filters.tags.has(norm)) {
      chip.classList.add('active');
    }

    chip.addEventListener('click', () => {
      if (state.filters.tags.has(norm)) {
        state.filters.tags.delete(norm);
        chip.classList.remove('active');
      } else {
        state.filters.tags.add(norm);
        chip.classList.add('active');
      }
      applyFilters();
    });

    return chip;
  };

  const renderSection = (title, tags) => {
    const chips = tags
      .map((tag) => {
        const normalized = normalize(tag);
        if (!entryMap.has(normalized)) return null;
        used.add(normalized);
        return createChip(normalized, entryMap.get(normalized));
      })
      .filter(Boolean);

    if (!chips.length) return null;

    const section = document.createElement('div');
    section.className = 'tag-subsection';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);

    const wrap = document.createElement('div');
    wrap.className = 'chip-group';
    chips.forEach((chip) => wrap.appendChild(chip));
    section.appendChild(wrap);

    return section;
  };

  TAG_GROUPS.forEach((group) => {
    const groupEl = document.createElement('details');
    groupEl.className = 'tag-group';

    const summary = document.createElement('summary');
    summary.className = 'tag-group-summary';

    const title = document.createElement('div');
    title.className = 'tag-group-title';
    title.textContent = group.title;
    summary.appendChild(title);

    const indicator = document.createElement('span');
    indicator.className = 'tag-group-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = '▾';
    summary.appendChild(indicator);

    groupEl.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'tag-group-content';

    group.categories.forEach((category) => {
      const section = renderSection(category.title, category.tags);
      if (section) {
        content.appendChild(section);
      }
    });

    if (content.childElementCount) {
      groupEl.appendChild(content);
      tagChips.appendChild(groupEl);
    }
  });

  const leftover = entries.filter(([norm]) => !used.has(norm));
  if (leftover.length) {
    const groupEl = document.createElement('details');
    groupEl.className = 'tag-group';

    const summary = document.createElement('summary');
    summary.className = 'tag-group-summary';

    const title = document.createElement('div');
    title.className = 'tag-group-title';
    title.textContent = 'Коктейли';
    summary.appendChild(title);

    const indicator = document.createElement('span');
    indicator.className = 'tag-group-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = '▾';
    summary.appendChild(indicator);

    groupEl.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'tag-group-content';

    const leftoverMap = new Map(leftover);

    COCKTAIL_TAG_SECTIONS.forEach((section) => {
      const chips = section.tags
        .map((tag) => {
          const normalized = normalize(tag);
          if (!leftoverMap.has(normalized)) return null;
          const chip = createChip(normalized, leftoverMap.get(normalized));
          leftoverMap.delete(normalized);
          return chip;
        })
        .filter(Boolean);

      if (!chips.length) return;

      const category = document.createElement('div');
      category.className = 'tag-subsection';

      const heading = document.createElement('h3');
      heading.textContent = section.title;
      category.appendChild(heading);

      const wrap = document.createElement('div');
      wrap.className = 'chip-group';
      chips.forEach((chip) => wrap.appendChild(chip));
      category.appendChild(wrap);

      content.appendChild(category);
    });

    if (leftoverMap.size) {
      const wrap = document.createElement('div');
      wrap.className = 'tag-subsection';

      const heading = document.createElement('h3');
      heading.textContent = 'Прочее';
      wrap.appendChild(heading);

      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'chip-group';

      [...leftoverMap.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
        .forEach(([norm, label]) => {
          chipsWrap.appendChild(createChip(norm, label));
        });

      wrap.appendChild(chipsWrap);
      content.appendChild(wrap);
    }

    groupEl.appendChild(content);
    tagChips.appendChild(groupEl);
  }
}

function rebuildFilters() {
  const dataset = getWorkingDishes();
  const menuEntries = uniqueValues(dataset, (dish) => dish.menu ? [dish.menu] : []);
  buildChipGroup(menuChips, menuEntries, state.filters.menus);

  const allergenEntries = sortAllergenEntries(
    uniqueValues(dataset, (dish) => Array.isArray(dish.allergens) ? dish.allergens : [])
  );
  buildChipGroup(allergenChips, allergenEntries, state.filters.allergens);

  const tagEntries = uniqueValues(dataset, (dish) => Array.isArray(dish.tags) ? dish.tags : []);
  buildTagGroups(tagEntries);
}

function matchesFilters(dish) {
  const menuMatch = !state.filters.menus.size || state.filters.menus.has(normalize(dish.menu));
  if (!menuMatch) return false;

  if (state.filters.allergens.size) {
    const dishAllergens = (dish.allergens || []).map(normalize);
    for (const allergen of state.filters.allergens) {
      if (!dishAllergens.includes(allergen)) {
        return false;
      }
    }
  }

  if (state.filters.tags.size) {
    const dishTags = (dish.tags || []).map(normalize);
    for (const tag of state.filters.tags) {
      if (!dishTags.includes(tag)) {
        return false;
      }
    }
  }

  return true;
}

function applyFilters() {
  const query = state.filters.query;
  const dataset = getWorkingDishes();
  let results;

  if (query) {
    const fuseResults = state.fuse.search(query);
    const seen = new Set();
    results = [];
    fuseResults.forEach(({ item }) => {
      if (seen.has(item.id)) return;
      if (matchesFilters(item)) {
        seen.add(item.id);
        results.push(item);
      }
    });
  } else {
    results = dataset.filter(matchesFilters);
  }

  state.filtered = results;
  renderCards(results);
  resultsCount.textContent = results.length ? `${results.length} позиций` : '0 позиций';
  emptyState.style.display = results.length ? 'none' : 'block';
}

function renderCards(dishes) {
  cardsContainer.innerHTML = '';
  dishes.forEach((dish) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('tabindex', '0');

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-btn';
    const dishTitle = dish.title || 'Без названия';
    editBtn.setAttribute('aria-label', `Редактировать «${dishTitle}»`);
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openEditor(dish.id);
    });
    card.appendChild(editBtn);

    const summary = document.createElement('div');
    summary.className = 'card-summary';

    if (dish.image?.src) {
      const figure = document.createElement('figure');
      figure.className = 'card-image';
      const img = document.createElement('img');
      img.src = dish.image.src;
      if (dish.image.alt) {
        img.alt = dish.image.alt;
      }
      figure.appendChild(img);
      if (dish.image.alt) {
        const caption = document.createElement('figcaption');
        caption.textContent = dish.image.alt;
        figure.appendChild(caption);
      }
      summary.appendChild(figure);
    }

    const menuTag = document.createElement('div');
    menuTag.className = 'menu-tag';
    menuTag.textContent = dish.menu || 'Без меню';
    summary.appendChild(menuTag);

    const updateNote = document.createElement('p');
    updateNote.className = 'card-update-note';
    updateNote.textContent = getUpdateNote(dish, false);
    applyLanguage(updateNote, updateNote.textContent);
    summary.appendChild(updateNote);

    const title = document.createElement('h3');
    title.textContent = formatCardTitle(dishTitle);
    title.dataset.fullTitle = dishTitle;
    title.title = dishTitle;
    summary.appendChild(title);

    if (dish.section) {
      const section = document.createElement('div');
      section.className = 'section';
      if (dish.section_icon?.src) {
        const icon = document.createElement('img');
        icon.src = dish.section_icon.src;
        icon.alt = dish.section_icon.alt || '';
        section.appendChild(icon);
      }
      const sectionLabel = document.createElement('span');
      sectionLabel.textContent = dish.section;
      section.appendChild(sectionLabel);
      summary.appendChild(section);
    }

    const featureIcons = getFeatureTagIcons(dish);
    if (dish.status || featureIcons.length) {
      const statusRow = document.createElement('div');
      statusRow.className = 'card-status-row';

      if (dish.status) {
        const statusText = (dish.status || '').trim();
        const status = document.createElement('span');
        status.className = 'status-badge';
        status.textContent = statusText;
        if (statusText.toLowerCase() === 'в архиве') {
          status.classList.add('status-badge--archived');
          card.classList.add('card--archived');
        }
        statusRow.appendChild(status);
      }

      if (featureIcons.length) {
        const featureWrap = document.createElement('div');
        featureWrap.className = 'feature-icons';
        featureIcons.forEach((iconData) => {
          const icon = document.createElement('span');
          icon.className = 'feature-icons__item';
          icon.textContent = iconData.icon;
          if (iconData.label) {
            icon.title = iconData.label;
          }
          featureWrap.appendChild(icon);
        });
        statusRow.appendChild(featureWrap);
      }

      summary.appendChild(statusRow);
    }

    card.appendChild(summary);

    const openModal = () => openDishModal(dish, card);

    card.addEventListener('click', (event) => {
      if (event.target.closest('.edit-btn')) return;
      openModal();
    });

    card.addEventListener('keydown', (event) => {
      if (event.target !== card) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal();
      }
    });

    cardsContainer.appendChild(card);
  });
}

if (compactCardsQuery) {
  const handleCompactChange = () => {
    if (!cardsContainer) return;
    renderCards(state.filtered);
  };

  if (typeof compactCardsQuery.addEventListener === 'function') {
    compactCardsQuery.addEventListener('change', handleCompactChange);
  } else if (typeof compactCardsQuery.addListener === 'function') {
    compactCardsQuery.addListener(handleCompactChange);
  }
}

function buildModalBody(dish, options = {}) {
  const { isEnglishCard = false } = options;

  const body = document.createElement('div');
  body.className = 'modal-body';

  const primaryColumn = document.createElement('div');
  primaryColumn.className = 'modal-column modal-column--primary';
  const secondaryColumn = document.createElement('div');
  secondaryColumn.className = 'modal-column modal-column--secondary';

  body.appendChild(primaryColumn);
  body.appendChild(secondaryColumn);

  const labels = {
    contains: isEnglishCard ? 'Serving / contents' : 'Подача / состав',
    allergens: isEnglishCard ? 'Allergens' : 'Аллергены',
    tags: isEnglishCard ? 'Tags' : 'Теги',
    source: isEnglishCard ? 'Source file' : 'Источник',
    comments: isEnglishCard ? 'Comments' : 'Комментарии',
    useful: 'Useful phrases & words'
  };

  if (dish.description) {
    const description = document.createElement('p');
    description.className = 'modal-description';
    description.textContent = dish.description;
    applyLanguage(description, description.textContent);
    primaryColumn.appendChild(description);
  }

  if (dish.contains) {
    primaryColumn.appendChild(createRichTextBlock(labels.contains, dish.contains));
  }

  if (!isEnglishCard && dish.features) {
    primaryColumn.appendChild(createRichTextBlock('Особенности', dish.features));
  }

  const usefulPhrases = Array.isArray(dish.usefulPhrases) ? dish.usefulPhrases : [];
  if (usefulPhrases.length && isEnglishCard) {
    primaryColumn.appendChild(createListBlock(labels.useful, usefulPhrases));
  }

  const englishTranslation = getEnglishTranslation(dish);
  if (!isEnglishCard && hasEnglishContent(englishTranslation)) {
    primaryColumn.appendChild(createTranslationBlock('English', englishTranslation, () => openEnglishModal(dish)));
  }

  const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
  if (ingredients.length && !isEnglishCard) {
    secondaryColumn.appendChild(createListBlock('Ингредиенты', ingredients));
  }

  const wineDetails = createWineDetailsBlock(dish, { isEnglishCard });
  if (wineDetails) {
    secondaryColumn.appendChild(wineDetails);
  }

  const allergens = Array.isArray(dish.allergens) ? sortAllergens(dish.allergens) : [];
  if (allergens.length) {
    secondaryColumn.appendChild(createAllergensBlock(allergens, labels.allergens));
  }

  const comments = Array.isArray(dish.comments) ? dish.comments : [];
  if (comments.length) {
    secondaryColumn.appendChild(createListBlock(labels.comments, comments));
  }

  const pairingBlock = isEnglishCard ? null : createPairingsBlock(dish.pairings);
  if (pairingBlock) {
    secondaryColumn.appendChild(pairingBlock);
  }

  if (dish.source_file) {
    const sourceBlock = document.createElement('div');
    sourceBlock.className = 'meta-block meta-block--source';
    const heading = document.createElement('strong');
    heading.textContent = labels.source;
    sourceBlock.appendChild(heading);
    const source = document.createElement('div');
    source.className = 'source-file';
    source.textContent = dish.source_file;
    markNeutralLanguage(source);
    sourceBlock.appendChild(source);
    secondaryColumn.appendChild(sourceBlock);
  }

  const tags = Array.isArray(dish.tags) ? dish.tags : [];
  if (tags.length) {
    secondaryColumn.appendChild(createTagsBlock(tags, labels.tags));
  }

  if (!primaryColumn.childElementCount) {
    primaryColumn.remove();
    secondaryColumn.classList.add('modal-column--full');
  } else if (!secondaryColumn.childElementCount) {
    secondaryColumn.remove();
    primaryColumn.classList.add('modal-column--full');
  }

  if (isEnglishCard) {
    colorizeEnglishTextNodes(body);
  }

  return body;
}

function getUpdateSourceLabel(source, isEnglishCard) {
  if (!source) return '';
  const normalized = source.toLowerCase();
  if (normalized === 'menu-database.json') {
    return 'menu-database.json';
  }
  if (normalized === 'editor') {
    return isEnglishCard ? 'Editor' : 'Редактор';
  }
  if (normalized === 'api') {
    return isEnglishCard ? 'Server API' : 'Сервер API';
  }
  return source;
}

function getUpdateNote(dish, isEnglishCard) {
  const formattedDate = formatDateTime(dish.updated_at || dish._loadedAt);
  const updateLabel = isEnglishCard ? 'Updated' : 'Изменения';
  const noUpdatesLabel = isEnglishCard
    ? 'No updates recorded yet'
    : 'Изменения пока не фиксировались';
  const sourceLabel = getUpdateSourceLabel(dish?._updateSource, isEnglishCard);

  if (formattedDate && sourceLabel) {
    return `${updateLabel}: ${formattedDate} · ${sourceLabel}`;
  }

  if (formattedDate) {
    return `${updateLabel}: ${formattedDate}`;
  }

  if (sourceLabel) {
    return `${updateLabel}: ${sourceLabel}`;
  }

  return noUpdatesLabel;
}

function buildModalHeader(dish, options = {}) {
  const { titleId = 'modalDishTitle', audioSource, isEnglishCard = false } = options;

  const modalHeader = document.createElement('header');
  modalHeader.className = 'modal-header';

  if (dish.image?.src) {
    const media = document.createElement('figure');
    media.className = 'modal-media dish-image';
    const img = document.createElement('img');
    img.src = dish.image.src;
    if (dish.image.alt) {
      img.alt = dish.image.alt;
    }
    media.appendChild(img);
    if (dish.image.alt) {
      const caption = document.createElement('figcaption');
      caption.textContent = dish.image.alt;
      media.appendChild(caption);
    }
    modalHeader.appendChild(media);
  } else {
    modalHeader.classList.add('modal-header--no-media');
  }

  const headerInfo = document.createElement('div');
  headerInfo.className = 'modal-header-info';

  if (dish.menu || !isEnglishCard) {
    const menuTag = document.createElement('div');
    menuTag.className = 'menu-tag';
    menuTag.textContent = dish.menu || 'Без меню';
    applyLanguage(menuTag, menuTag.textContent);
    markNeutralLanguage(menuTag);
    headerInfo.appendChild(menuTag);
  }

  const updatedAtLabel = document.createElement('p');
  updatedAtLabel.className = 'modal-update-note';
  updatedAtLabel.textContent = getUpdateNote(dish, isEnglishCard);
  applyLanguage(updatedAtLabel, updatedAtLabel.textContent);
  headerInfo.appendChild(updatedAtLabel);

  const titleRow = document.createElement('div');
  titleRow.className = 'modal-title-row';

  const title = document.createElement('h2');
  title.id = titleId;
  title.textContent = dish.title || (isEnglishCard ? 'English card' : 'Без названия');
  applyLanguage(title, title.textContent);
  markNeutralLanguage(title);
  titleRow.appendChild(title);

  if (audioSource) {
    const audioBtn = document.createElement('button');
    audioBtn.type = 'button';
    audioBtn.className = 'modal-audio-btn';
    audioBtn.setAttribute('aria-label', `Слушать: ${title.textContent}`);
    audioBtn.innerText = '🔊';
    audioBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const audio = new Audio(audioSource);
      audio.play().catch((err) => console.error('Audio play error:', err));
    });
    titleRow.appendChild(audioBtn);
  }

  headerInfo.appendChild(titleRow);

  let metaRow = null;

  if (dish.section) {
    metaRow = metaRow || document.createElement('div');
    metaRow.className = 'modal-header-meta';
    const section = document.createElement('div');
    section.className = 'section';
    if (dish.section_icon?.src) {
      const icon = document.createElement('img');
      icon.src = dish.section_icon.src;
      icon.alt = dish.section_icon.alt || '';
      section.appendChild(icon);
    }
    const sectionLabel = document.createElement('span');
    sectionLabel.textContent = dish.section;
    applyLanguage(sectionLabel, sectionLabel.textContent);
    markNeutralLanguage(sectionLabel);
    section.appendChild(sectionLabel);
    metaRow.appendChild(section);
  }

  if (dish.status) {
    const statusText = (dish.status || '').trim();
    metaRow = metaRow || document.createElement('div');
    metaRow.className = 'modal-header-meta';
    const status = document.createElement('span');
    status.className = 'status-badge';
    status.textContent = statusText;
    if (statusText.toLowerCase() === 'в архиве') {
      status.classList.add('status-badge--archived');
    }
    metaRow.appendChild(status);
  }

  if (dish.id) {
    metaRow = metaRow || document.createElement('div');
    metaRow.className = 'modal-header-meta';
    const idBadge = document.createElement('span');
    idBadge.className = 'id-badge';
    idBadge.textContent = dish.id;
    metaRow.appendChild(idBadge);
  }

  if (metaRow) {
    headerInfo.appendChild(metaRow);
  }

  modalHeader.appendChild(headerInfo);

  return modalHeader;
}

function createPairingsBlock(pairings = {}) {
  const pairingItems = [];
  if (Array.isArray(pairings.wines) && pairings.wines.length) {
    pairingItems.push({ label: 'Вина', items: pairings.wines });
  }
  if (Array.isArray(pairings.dishes) && pairings.dishes.length) {
    pairingItems.push({ label: 'Блюда', items: pairings.dishes });
  }
  if (Array.isArray(pairings.drinks) && pairings.drinks.length) {
    pairingItems.push({ label: 'Напитки', items: pairings.drinks });
  }
  const pairingNotes = Array.isArray(pairings.notes)
    ? pairings.notes
    : pairings?.notes
      ? [pairings.notes]
      : [];
  if (pairingNotes.length) {
    pairingItems.push({ label: 'Комментарии', items: pairingNotes });
  }

  if (!pairingItems.length) {
    return null;
  }

  const block = document.createElement('div');
  block.className = 'meta-block';
  const titleEl = document.createElement('strong');
  titleEl.textContent = 'Пары и рекомендации';
  block.appendChild(titleEl);

  pairingItems.forEach(({ label, items }) => {
    const labelEl = document.createElement('div');
    labelEl.style.fontSize = '13px';
    labelEl.style.color = 'var(--muted)';
    labelEl.style.marginTop = '4px';
    labelEl.textContent = label;
    block.appendChild(labelEl);

    const ul = document.createElement('ul');
    items.forEach((item) => {
      const li = document.createElement('li');

      if (label !== 'Комментарии') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pairing-link';
        button.textContent = item;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          openPairingPreview(item);
        });
        li.appendChild(button);
      } else {
        li.textContent = item;
      }

      ul.appendChild(li);
    });
    block.appendChild(ul);
  });

  return block;
}

function updateBodyModalState() {
  const hasOpenModal = (dishModal?.classList.contains('open')) || (englishModal?.classList.contains('open'));
  document.body.classList.toggle('modal-open', Boolean(hasOpenModal));
}

function openDishModal(dish, triggerElement) {
  if (!dishModal || !modalContent) return;

  modalContent.innerHTML = '';

  const modalHeader = buildModalHeader(dish);

  const body = buildModalBody(dish);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(body);

  dishModal.classList.add('open');
  dishModal.setAttribute('aria-hidden', 'false');
  updateBodyModalState();

  lastFocusedElement = triggerElement || document.activeElement;

  if (modalCloseBtn) {
    modalCloseBtn.setAttribute('tabindex', '0');
    modalCloseBtn.focus();
  }
  document.addEventListener('keydown', handleModalKeydown);
}

function closeDishModal() {
  if (!dishModal || !dishModal.classList.contains('open')) return;

  dishModal.classList.remove('open');
  dishModal.setAttribute('aria-hidden', 'true');
  updateBodyModalState();
  modalContent.innerHTML = '';
  closePairingPreview();
  document.removeEventListener('keydown', handleModalKeydown);

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

function openEnglishModal(dish, triggerElement) {
  if (!englishModal || !englishModalContent) return;

  const englishDish = buildEnglishDish(dish);
  if (!englishDish) return;

  englishModalContent.innerHTML = '';

  const modalHeader = buildModalHeader(englishDish, {
    titleId: 'englishModalTitle',
    audioSource: englishDish.audio_en,
    isEnglishCard: true
  });
  const body = buildModalBody(englishDish, { isEnglishCard: true });

  englishModalContent.appendChild(modalHeader);
  englishModalContent.appendChild(body);

  englishModal.classList.add('open');
  englishModal.setAttribute('aria-hidden', 'false');
  lastEnglishFocused = triggerElement || document.activeElement;

  if (englishModalCloseBtn) {
    englishModalCloseBtn.setAttribute('tabindex', '0');
    englishModalCloseBtn.focus();
  }

  document.addEventListener('keydown', handleEnglishModalKeydown);
  updateBodyModalState();
}

function closeEnglishModal() {
  if (!englishModal || !englishModal.classList.contains('open')) return;

  englishModal.classList.remove('open');
  englishModal.setAttribute('aria-hidden', 'true');
  englishModalContent.innerHTML = '';
  document.removeEventListener('keydown', handleEnglishModalKeydown);
  updateBodyModalState();

  if (lastEnglishFocused && typeof lastEnglishFocused.focus === 'function') {
    lastEnglishFocused.focus();
  }
  lastEnglishFocused = null;
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') {
    if (englishModal?.classList.contains('open')) {
      return;
    }
    if (pairingPreview?.classList.contains('open')) {
      closePairingPreview();
      return;
    }
    closeDishModal();
  }
}

function handleEnglishModalKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeEnglishModal();
  }
}

function findDishByTitle(title) {
  const normalizedTitle = normalize(title);
  if (!normalizedTitle) return null;
  const dishes = getWorkingDishes();
  return dishes.find((item) => normalize(item.title) === normalizedTitle) || null;
}

function openPairingPreview(title) {
  if (!pairingPreview || !pairingContent) return;

  const dish = findDishByTitle(title);
  if (!dish) {
    showToast('Не нашли позицию для этой пары.', true);
    return;
  }

  pairingContent.innerHTML = '';
  const header = buildModalHeader(dish, { titleId: 'pairingDishTitle' });
  const body = buildModalBody(dish);
  pairingContent.appendChild(header);
  pairingContent.appendChild(body);

  pairingPreview.classList.add('open');
  pairingPreview.setAttribute('aria-hidden', 'false');

  if (pairingCloseBtn) {
    pairingCloseBtn.focus({ preventScroll: true });
  }
}

function closePairingPreview() {
  if (!pairingPreview || !pairingContent) return;
  pairingPreview.classList.remove('open');
  pairingPreview.setAttribute('aria-hidden', 'true');
  pairingContent.innerHTML = '';
}

function createAllergensBlock(allergens, label = 'Аллергены') {
  const block = document.createElement('div');
  block.className = 'meta-block allergens-block';
  const heading = document.createElement('strong');
  heading.textContent = label;
  block.appendChild(heading);

  const badges = document.createElement('div');
  badges.className = 'allergen-badges';

  allergens.forEach((item) => {
    const priority = getAllergenPriority(item);
    const badge = document.createElement('span');
    badge.className = 'allergen-badge';

    if (priority <= 3) {
      badge.classList.add('allergen-badge--high');
    } else if (priority <= 8) {
      badge.classList.add('allergen-badge--medium');
    }

    const iconEl = document.createElement('span');
    iconEl.className = 'allergen-badge__icon';
    iconEl.textContent = getAllergenIcon(item);

    const labelEl = document.createElement('span');
    labelEl.className = 'allergen-badge__label';
    labelEl.textContent = item;
    applyLanguage(labelEl, labelEl.textContent);
    markNeutralLanguage(labelEl);

    badge.appendChild(iconEl);
    badge.appendChild(labelEl);
    badges.appendChild(badge);
  });

  block.appendChild(badges);
  return block;
}

function createListBlock(title, items) {
  const block = document.createElement('div');
  block.className = 'meta-block';
  const heading = document.createElement('strong');
  heading.textContent = title;
  block.appendChild(heading);
  const ul = document.createElement('ul');
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    applyLanguage(li, li.textContent);
    ul.appendChild(li);
  });
  block.appendChild(ul);
  return block;
}

function isWineDish(dish) {
  const menuName = (dish?.menu || '').toLowerCase();
  return menuName.includes('вино');
}

function createWineDetailsBlock(dish, { isEnglishCard = false } = {}) {
  if (!isWineDish(dish)) return null;

  const origin = (dish.origin || '').trim();
  const producer = (dish.producer || '').trim();
  const grapeVarieties = Array.isArray(dish.grapeVarieties)
    ? dish.grapeVarieties.filter(Boolean)
    : [];
  const sweetness = (dish.sweetness || '').trim();

  if (!origin && !producer && !grapeVarieties.length && !sweetness) {
    return null;
  }

  const labels = {
    heading: isEnglishCard ? 'Wine details' : 'Карта вина',
    origin: isEnglishCard ? 'Origin' : 'Происхождение',
    producer: isEnglishCard ? 'Producer' : 'Производитель',
    grapeVarieties: isEnglishCard ? 'Grape varieties' : 'Сорта винограда',
    sweetness: isEnglishCard ? 'Sweetness' : 'Содержание сахара'
  };

  const block = document.createElement('div');
  block.className = 'meta-block wine-meta-block';

  const heading = document.createElement('strong');
  heading.textContent = labels.heading;
  block.appendChild(heading);

  const details = document.createElement('div');
  details.className = 'wine-details';
  block.appendChild(details);

  const addDetail = (label, value, renderValue) => {
    if (!value) return;
    const row = document.createElement('div');
    row.className = 'wine-detail';

    const labelEl = document.createElement('div');
    labelEl.className = 'wine-detail__label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.className = 'wine-detail__value';

    if (typeof renderValue === 'function') {
      renderValue(valueEl);
    } else {
      valueEl.textContent = value;
      applyLanguage(valueEl, valueEl.textContent);
    }

    row.appendChild(valueEl);
    details.appendChild(row);
  };

  addDetail(labels.origin, origin);
  addDetail(labels.producer, producer);
  addDetail(labels.grapeVarieties, grapeVarieties.length, (container) => {
    const chips = document.createElement('div');
    chips.className = 'wine-grape-chips';
    grapeVarieties.forEach((grape) => {
      const chip = document.createElement('span');
      chip.className = 'wine-grape-chip';
      chip.textContent = grape;
      applyLanguage(chip, chip.textContent);
      chips.appendChild(chip);
    });
    container.appendChild(chips);
  });
  addDetail(labels.sweetness, sweetness);

  return block;
}

function createRichTextBlock(title, content) {
  const block = document.createElement('div');
  block.className = 'meta-block';
  const heading = document.createElement('strong');
  heading.textContent = title;
  block.appendChild(heading);
  const container = document.createElement('div');
  container.className = 'rich-text';
  container.innerHTML = content;
  applyLanguage(container, container.textContent || content);
  block.appendChild(container);
  return block;
}

function createTranslationBlock(label, translation, onOpen) {
  const block = document.createElement('button');
  block.type = 'button';
  block.className = 'meta-block translation translation-button';
  block.setAttribute('aria-label', `Открыть карточку ${label}`);

  block.addEventListener('click', (event) => {
    event.stopPropagation();
    if (typeof onOpen === 'function') {
      onOpen();
    }
  });

  block.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (typeof onOpen === 'function') {
        onOpen();
      }
    }
  });

  const heading = document.createElement('strong');
  heading.textContent = label;
  block.appendChild(heading);

  if (translation?.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'translation-title';
    titleEl.textContent = translation.title;
    applyLanguage(titleEl, titleEl.textContent);
    block.appendChild(titleEl);
  }

  if (translation?.description) {
    const desc = document.createElement('div');
    desc.className = 'translation-description';
    desc.textContent = translation.description;
    applyLanguage(desc, desc.textContent);
    block.appendChild(desc);
  }

  const hint = document.createElement('div');
  hint.className = 'translation-description';
  hint.style.marginTop = '6px';
  hint.style.color = 'var(--muted)';
  hint.textContent = 'Нажмите, чтобы открыть английскую карточку.';
  applyLanguage(hint, hint.textContent);
  block.appendChild(hint);

  return block;
}

function createTagsBlock(tags, label = 'Теги') {
  const block = document.createElement('div');
  block.className = 'meta-block tags-block';
  const heading = document.createElement('strong');
  heading.textContent = label;
  block.appendChild(heading);

  const tagsWrap = document.createElement('div');
  tagsWrap.className = 'tags';
  tags.forEach((tag) => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tag;
    applyLanguage(tagEl, tagEl.textContent);
    markNeutralLanguage(tagEl);
    tagsWrap.appendChild(tagEl);
  });
  block.appendChild(tagsWrap);

  return block;
}

function openEditor(id = null) {
  if (!state.serverAvailable) {
    showToast('Редактирование недоступно без запущенного сервера.', true);
    return;
  }

  if (id) {
    const dish = state.dishes.find((item) => item.id === id);
    if (!dish) return;
    state.editingId = id;
    editorTitle.textContent = `Редактирование — ${dish.title || 'Без названия'}`;
    editorForm.menu.value = dish.menu || '';
    editorForm.section.value = dish.section || '';
    editorForm.sectionIconType.value = dish.section_icon?.type || '';
    editorForm.sectionIconSrc.value = dish.section_icon?.src || '';
    editorForm.sectionIconAlt.value = dish.section_icon?.alt || '';
    editorForm.title.value = dish.title || '';
    editorForm.dishId.value = dish.id || '';
    editorForm.description.value = dish.description || '';
    editorForm.contains.value = dish.contains || '';
    editorForm.ingredients.value = (dish.ingredients || []).join(', ');
    editorForm.allergens.value = (dish.allergens || []).join(', ');
    editorForm.pairDishes.value = (dish.pairings?.dishes || []).join(', ');
    editorForm.pairWines.value = (dish.pairings?.wines || []).join(', ');
    editorForm.pairDrinks.value = (dish.pairings?.drinks || []).join(', ');
    const rawNotes = dish.pairings?.notes;
    const notes = Array.isArray(rawNotes)
      ? rawNotes
      : rawNotes
        ? [rawNotes]
        : [];
    editorForm.pairNotes.value = notes.join(', ');
    editorForm.tags.value = (dish.tags || []).join(', ');
    editorForm.comments.value = Array.isArray(dish.comments) ? dish.comments.join('\n') : '';
    editorForm.status.value = dish.status || '';
    editorForm.sourceFile.value = dish.source_file || '';
    editorForm.features.value = dish.features || '';
    editorForm.imageSrc.value = dish.image?.src || '';
    editorForm.imageAlt.value = dish.image?.alt || '';
    editorForm.enTitle.value = dish.i18n?.en?.['title-en'] || '';
    editorForm.enDescription.value = dish.i18n?.en?.['description-en'] || '';
    deleteDishBtn.style.display = 'inline-flex';
  } else {
    state.editingId = null;
    editorTitle.textContent = 'Новая позиция';
    editorForm.reset();
    editorForm.dishId.value = '';
    editorForm.comments.value = '';
    editorForm.sectionIconType.value = '';
    editorForm.sectionIconSrc.value = '';
    editorForm.sectionIconAlt.value = '';
    deleteDishBtn.style.display = 'none';
  }

  editor.classList.add('open');
  editor.setAttribute('aria-hidden', 'false');
}

function closeEditorPanel() {
  editor.classList.remove('open');
  editor.setAttribute('aria-hidden', 'true');
  state.editingId = null;
}

function parseList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseMultiline(value) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function generateId(title, menu) {
  const base = normalize(`${menu}-${title}`).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let candidate = base || `dish-${Date.now()}`;
  let attempt = 1;
  while (state.dishes.some((dish) => dish.id === candidate)) {
    candidate = `${base}-${attempt++}`;
  }
  return candidate;
}

async function persistChanges(successMessage) {
  if (!state.serverAvailable) {
    showToast('Сервер недоступен. Запустите server.py, чтобы сохранять изменения.', true);
    return false;
  }

  if (isSaving) return false;
  isSaving = true;
  saveDishBtn.disabled = true;
  saveDishBtn.textContent = 'Сохраняем…';
  try {
    const response = await fetch('../api/dishes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state.dishes, null, 2)
    });
    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }
    showToast(successMessage || 'Изменения сохранены.');
    return true;
  } catch (error) {
    console.error(error);
    showToast('Не удалось сохранить изменения.', true);
    setEditAvailability(false);
    return false;
  } finally {
    isSaving = false;
    saveDishBtn.disabled = false;
    saveDishBtn.textContent = 'Сохранить';
  }
}

async function handleSave() {
  const form = new FormData(editorForm);
  const menu = (form.get('menu') || '').trim();
  const section = (form.get('section') || '').trim();
  const title = (form.get('title') || '').trim();
  const dishIdFromForm = (form.get('dishId') || '').trim();

  if (!menu || !section || !title) {
    showToast('Заполните меню, раздел и название.', true);
    return;
  }

  const description = (form.get('description') || '').trim();
  const contains = (form.get('contains') || '').trim();
  const ingredients = parseList(form.get('ingredients') || '');
  const allergens = parseList(form.get('allergens') || '');
  const pairDishes = parseList(form.get('pairDishes') || '');
  const pairDrinks = parseList(form.get('pairDrinks') || '');
  const pairWines = parseList(form.get('pairWines') || '');
  const pairNotes = parseList(form.get('pairNotes') || '');
  const tags = parseList(form.get('tags') || '');
  const comments = parseMultiline(form.get('comments') || '');
  const status = (form.get('status') || '').trim();
  const sourceFile = (form.get('sourceFile') || '').trim();
  const features = (form.get('features') || '').trim();
  const imageSrc = (form.get('imageSrc') || '').trim();
  const imageAlt = (form.get('imageAlt') || '').trim();
  const enTitle = (form.get('enTitle') || '').trim();
  const enDescription = (form.get('enDescription') || '').trim();
  const sectionIconType = (form.get('sectionIconType') || '').trim();
  const sectionIconSrc = (form.get('sectionIconSrc') || '').trim();
  const sectionIconAlt = (form.get('sectionIconAlt') || '').trim();

  let index = -1;
  let existing = null;
  if (state.editingId) {
    index = state.dishes.findIndex((dish) => dish.id === state.editingId);
    if (index !== -1) {
      existing = state.dishes[index];
    }
  }

  const englishPayload = {
    ...(existing?.i18n?.en || {}),
    'title-en': enTitle,
    'description-en': enDescription
  };

  const updatedAt = new Date().toISOString();

  const payload = {
    ...(existing || {}),
    menu,
    section,
    title,
    description,
    contains,
    ingredients,
    allergens,
    pairings: {
      ...(existing?.pairings || {}),
      dishes: pairDishes,
      drinks: pairDrinks,
      wines: pairWines,
      notes: pairNotes
    },
    tags,
    comments,
    status,
    source_file: sourceFile,
    updated_at: updatedAt,
    features,
    image: imageSrc || imageAlt ? { src: imageSrc, alt: imageAlt } : undefined,
    i18n: {
      ...(existing?.i18n || {}),
      ru: {
        ...(existing?.i18n?.ru || {}),
        title,
        description
      },
      en: englishPayload
    }
  };

  const sectionIcon = {};
  if (sectionIconType) {
    sectionIcon.type = sectionIconType;
  }
  if (sectionIconSrc) {
    sectionIcon.src = sectionIconSrc;
  }
  if (sectionIconAlt) {
    sectionIcon.alt = sectionIconAlt;
  }
  if (Object.keys(sectionIcon).length) {
    payload.section_icon = sectionIcon;
  } else {
    delete payload.section_icon;
  }

  if (!payload.image) {
    delete payload.image;
  }
  if (!payload.contains) {
    delete payload.contains;
  }
  if (!payload.features) {
    delete payload.features;
  }
  if (!payload.status) {
    delete payload.status;
  }
  if (!payload.source_file) {
    delete payload.source_file;
  }
  if (!payload.comments || payload.comments.length === 0) {
    delete payload.comments;
  }
  if (Array.isArray(payload.pairings?.notes) && payload.pairings.notes.length === 0) {
    delete payload.pairings.notes;
  }
  if (payload.i18n?.en) {
    const englishTranslation = getEnglishTranslation({ i18n: { en: payload.i18n.en } });
    if (!hasEnglishContent(englishTranslation)) {
      delete payload.i18n.en;
    }
  }
  if (payload.i18n && !payload.i18n.en && !payload.i18n.ru?.title && !payload.i18n.ru?.description) {
    delete payload.i18n;
  }

  const payloadWithMeta = decorateDishWithUpdateMeta(payload, 'editor');

  if (state.editingId) {
    payloadWithMeta.id = state.editingId;
    if (index !== -1) {
      state.dishes[index] = payloadWithMeta;
    }
  } else {
    const desiredId = dishIdFromForm || generateId(payloadWithMeta.title, payloadWithMeta.menu);
    payloadWithMeta.id = desiredId;
    state.dishes.push(payloadWithMeta);
  }

  refreshViewData();
  const success = await persistChanges(state.editingId ? 'Позиция обновлена.' : 'Позиция добавлена.');
  if (success) {
    closeEditorPanel();
  }
}

async function handleDelete() {
  if (!state.editingId) return;
  if (!confirm('Удалить эту позицию?')) return;
  const index = state.dishes.findIndex((dish) => dish.id === state.editingId);
  if (index === -1) return;
  state.dishes.splice(index, 1);
  refreshViewData();
  const success = await persistChanges('Позиция удалена.');
  if (success) {
    closeEditorPanel();
  }
}

const handleSearch = debounce((event) => {
  state.filters.query = event.target.value.trim();
  applyFilters();
}, 200);

searchInput.addEventListener('input', handleSearch);

toggleEditBtn.addEventListener('click', () => {
  if (!state.serverAvailable) {
    showToast('Редактирование недоступно без запущенного server.py.', true);
    return;
  }
  if (!state.editMode && !requestEditAccess()) {
    return;
  }
  state.editMode = !state.editMode;
  document.body.classList.toggle('edit-mode', state.editMode);
  toggleEditBtn.textContent = state.editMode ? 'Выключить редактирование' : 'Включить редактирование';
  if (!state.editMode) {
    closeEditorPanel();
  }
});

addDishBtn.addEventListener('click', () => {
  if (!state.serverAvailable) {
    showToast('Редактирование недоступно без запущенного server.py.', true);
    return;
  }
  if (!state.editMode) {
    if (!requestEditAccess()) {
      return;
    }
    state.editMode = true;
    document.body.classList.add('edit-mode');
    toggleEditBtn.textContent = 'Выключить редактирование';
  }
  openEditor(null);
});

refreshBtn.addEventListener('click', () => loadData(true));

closeEditorBtn.addEventListener('click', () => {
  closeEditorPanel();
});

saveDishBtn.addEventListener('click', handleSave);

deleteDishBtn.addEventListener('click', handleDelete);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && editor.classList.contains('open')) {
    closeEditorPanel();
  }
});

if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', () => {
    closeDishModal();
  });
}

if (dishModal) {
  dishModal.addEventListener('click', (event) => {
    if (event.target === dishModal) {
      closeDishModal();
    }
  });
}

if (englishModalCloseBtn) {
  englishModalCloseBtn.addEventListener('click', () => {
    closeEnglishModal();
  });
}

if (englishModal) {
  englishModal.addEventListener('click', (event) => {
    if (event.target === englishModal) {
      closeEnglishModal();
    }
  });
}

if (pairingCloseBtn) {
  pairingCloseBtn.addEventListener('click', () => {
    closePairingPreview();
  });
}

if (pairingPreview) {
  pairingPreview.addEventListener('click', (event) => {
    if (event.target === pairingPreview) {
      closePairingPreview();
    }
  });
}

loadData();
