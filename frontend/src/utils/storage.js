// Простая абстракция хранения данных.
// Сейчас используем localStorage (браузерное хранилище).
// Если приложение станет PWA/мобильным/desktop, здесь можно заменить реализацию на SQLite.
// Важно: в браузерном проекте SQLite напрямую не подключаем.

export const getJSON = (key, fallbackValue) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
};

export const setJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Если хранилище недоступно, просто ничего не делаем.
  }
};

export const toggleInArray = (list, item) => {
  if (list.includes(item)) {
    return list.filter((value) => value !== item);
  }
  return [...list, item];
};
