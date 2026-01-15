// Базовый URL API (для получения изображений через бэкенд)
// В продакшене фронт и бэкенд обычно на одном домене, поэтому по умолчанию используем относительный URL.
// Важно: если оставить "http://localhost:5000", на сервере браузер пользователя будет пытаться грузить картинки с ЕГО компьютера.
const API_URL = process.env.REACT_APP_API_URL || '';

/**
 * Преобразует путь к изображению в правильный URL
 * @param {string} imagePath - Путь к изображению из данных
 * @returns {string|null} - Правильный URL или null
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Если это уже полный URL (http/https), возвращаем как есть
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Если путь начинается с ../images/, преобразуем в URL бэкенда
  if (imagePath.startsWith('../images/')) {
    const filename = imagePath.replace('../images/', '');
    return `${API_URL}/images/${filename}`;
  }
  
  // Если путь начинается с /images/, используем бэкенд
  if (imagePath.startsWith('/images/')) {
    const filename = imagePath.replace('/images/', '');
    return `${API_URL}/images/${filename}`;
  }
  
  // Если путь начинается с images/, используем бэкенд
  if (imagePath.startsWith('images/')) {
    const filename = imagePath.replace('images/', '');
    return `${API_URL}/images/${filename}`;
  }
  
  // Для остальных случаев возвращаем как есть (может быть относительный путь)
  return imagePath;
};

/**
 * Получает URL изображения из объекта блюда
 * @param {object} dish - Объект блюда
 * @returns {string|null} - URL изображения или null
 */
export const getDishImageUrl = (dish) => {
  if (!dish) return null;
  
  // Проверяем разные варианты структуры данных
  if (dish.image?.src) {
    return getImageUrl(dish.image.src);
  }
  
  if (dish.imageUrl) {
    return getImageUrl(dish.imageUrl);
  }
  
  if (dish.image) {
    return getImageUrl(dish.image);
  }
  
  return null;
};

