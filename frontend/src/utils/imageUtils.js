const API_URL = process.env.REACT_APP_API_URL || '';

/**
 * Преобразует путь к изображению в правильный URL
 * @param {string} imagePath - Путь к изображению из данных
 * @returns {string|null} - Правильный URL или null
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // Если передали объект (например { src, alt }), берём src.
  if (typeof imagePath === 'object') {
    const src = imagePath?.src;
    if (!src || typeof src !== 'string') return null;
    return getImageUrl(src);
  }

  // Если это уже полный URL (http/https), возвращаем как есть
  if (typeof imagePath === 'string' && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
    return imagePath;
  }

  // Частый кейс в menu-database.json: пути вида "./images/..."
  // Для браузера корректнее использовать абсолютный путь от корня сайта: "/images/..."
  if (typeof imagePath === 'string' && imagePath.startsWith('./images/')) {
    const normalized = imagePath.replace(/^\.\//, '/'); // "./images/..." -> "/images/..."
    const filename = normalized.replace('/images/', '');
    return `${API_URL}/images/${filename}`;
  }

  // Если путь начинается с ../images/, преобразуем в URL бэкенда
  if (typeof imagePath === 'string' && imagePath.startsWith('../images/')) {
    const filename = imagePath.replace('../images/', '');
    return `${API_URL}/images/${filename}`;
  }

  // Если путь начинается с /images/, используем бэкенд
  if (typeof imagePath === 'string' && imagePath.startsWith('/images/')) {
    const filename = imagePath.replace('/images/', '');
    return `${API_URL}/images/${filename}`;
  }

  // Если путь начинается с images/, используем бэкенд
  if (typeof imagePath === 'string' && imagePath.startsWith('images/')) {
    const filename = imagePath.replace('images/', '');
    return `${API_URL}/images/${filename}`;
  }

  // Для остальных случаев возвращаем как есть (может быть относительный путь)
  return typeof imagePath === 'string' ? imagePath : null;
};

/**
 * Получает URL изображения из объекта блюда
 * @param {object} dish - Объект блюда
 * @returns {string|null} - URL изображения или null
 */
export const getDishImageUrl = (dish) => {
  if (!dish) return null;

  // Проверяем разные варианты структуры данных
  let path = null;

  if (dish.image && typeof dish.image === 'object' && dish.image.src) {
    path = dish.image.src;
  } else if (dish.imageUrl) {
    path = dish.imageUrl;
  } else if (dish.image && typeof dish.image === 'string') {
    path = dish.image;
  }

  if (path === 'null') path = null;

  // Авто-исправление для Постного меню
  const isPostnoe = dish.menu && String(dish.menu).includes('Постн');

  // Фолбэк по ID для критических позиций
  if (isPostnoe && !path && dish.id) {
    const fallbackMap = {
      '0418': 'hummus.jpg',
      '0419': 'tsvetnaya-kapusta-s-sousom-chimichuri.jpg',
      '0421': 'barhatnyj-sup-iz-seldereya-s-gribami.jpg',
      '0423': 'grechnevaya-kasha-po-receptu-babushki.jpg'
    };
    if (fallbackMap[dish.id]) {
      path = `../images/postnoe-menyu-${fallbackMap[dish.id]}`;
    }
  }

  // Гарантируем наличие префикса в имени файла
  if (isPostnoe && path && typeof path === 'string') {
    if (!path.includes('postnoe-menyu-')) {
      const parts = path.split('/');
      const filename = parts[parts.length - 1];
      path = path.replace(filename, `postnoe-menyu-${filename}`);
    }
    if (!path.toLowerCase().endsWith('.jpg') && !path.toLowerCase().endsWith('.webp')) {
      path = path.replace(/\.[^/.]+$/, ".jpg");
    }
  }

  return getImageUrl(path);
};

