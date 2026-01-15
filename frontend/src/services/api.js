import axios from 'axios';

// Базовый URL API
// На Beget фронтенд и бэкенд работают на одном домене, поэтому используем относительный путь
// Если REACT_APP_API_URL не задан, используем пустую строку (относительный путь)
const API_URL = process.env.REACT_APP_API_URL || '';

// Термин **localStorage**: “память браузера”, куда можно положить маленькую настройку.
// Мы используем это, чтобы переключать источник меню БЕЗ перезапуска dev-сервера.
const MENU_DB_SOURCE_STORAGE_KEY = 'sabor.menuDbSource.v1';

// Источник меню в DEV/локально:
// - "auto" (по умолчанию): сначала API, потом файл /data/menu-database.json, потом кэш
// - "static": ВСЕГДА брать меню из /data/menu-database.json (удобно, когда правите файл руками и хотите видеть сразу)
// - "backend-json": ВСЕГДА брать меню из бэкенда /api/menu-json (читает data/menu-database.json напрямую, без БД)
//
// Термин **.env**: это файл с настройками окружения. Важно: НЕ храните там пароли/токены и не коммитьте их в Git.
const MENU_DB_SOURCE_MODE = (() => {
  // 1) локальный переключатель (в браузере)
  try {
    if (typeof window !== 'undefined' && window?.localStorage) {
      const v = window.localStorage.getItem(MENU_DB_SOURCE_STORAGE_KEY);
      if (v && typeof v === 'string') return v.toLowerCase();
    }
  } catch {
    // ignore
  }
  // 2) настройка из .env
  return (process.env.REACT_APP_MENU_DB_SOURCE || 'auto').toLowerCase();
})();

// =========================
// Надёжность меню (KISS)
// =========================
// Идея простая:
// 1) Пытаемся взять данные из API (это основной источник)
// 2) Если API упал/не отвечает — берём из статического JSON: /data/menu-database.json
// 3) Если и JSON недоступен — берём последнюю удачную копию из localStorage
//
// Важно: чтобы пункт (2) работал даже при падении бэкенда, файл /data/menu-database.json
// должен отдаваться ВЕБ-СЕРВЕРОМ (nginx/Beget), а не Flask. Иначе при падении Flask файл тоже не отдастся.

const MENU_DB_STATIC_URL = '/data/menu-database.json';
const MENU_DB_BACKEND_JSON_URL = '/api/menu-json';
const MENU_DB_CACHE_KEY = 'sabor.menuDbCache.v1';
const MENU_DB_CACHE_META_KEY = 'sabor.menuDbCacheMeta.v1';
const MENU_DB_RUNTIME_KEY = 'sabor.menuDbRuntime.v1'; // какой источник использовался "прямо сейчас"
const MENU_DB_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

function _safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function _textContains(value, keywords) {
  if (!value) return false;
  const v = String(value).toLowerCase();
  return keywords.some((k) => k && v.includes(String(k).toLowerCase()));
}

function _normalizeId(rawId) {
  const id = String(rawId ?? '').trim();
  return id || null;
}

function _dedupeById(items) {
  // Оставляем последнюю запись для каждого id (как в бэкенде)
  const map = new Map();
  (items || []).forEach((it) => {
    if (!it || typeof it !== 'object') return;
    const id = _normalizeId(it.id);
    if (!id) return;
    map.set(id, { ...it, id });
  });
  return Array.from(map.values());
}

function _readMenuDbCache() {
  const meta = _safeJsonParse(localStorage.getItem(MENU_DB_CACHE_META_KEY) || '');
  const raw = localStorage.getItem(MENU_DB_CACHE_KEY);
  const parsed = _safeJsonParse(raw || '');
  if (!meta || !meta.savedAt || !Array.isArray(parsed)) return null;

  const age = Date.now() - meta.savedAt;
  if (age > MENU_DB_CACHE_MAX_AGE_MS) return null;

  return parsed;
}

function _writeMenuDbCache(items, source) {
  try {
    localStorage.setItem(MENU_DB_CACHE_KEY, JSON.stringify(items));
    localStorage.setItem(
      MENU_DB_CACHE_META_KEY,
      JSON.stringify({ savedAt: Date.now(), source: source || 'unknown' })
    );
  } catch {
    // Если localStorage переполнен или запрещён — просто молча пропускаем.
  }
}

function _setMenuDbRuntimeSource(source, note) {
  try {
    localStorage.setItem(
      MENU_DB_RUNTIME_KEY,
      JSON.stringify({ source: source || 'unknown', at: Date.now(), note: note || null })
    );
  } catch {
    // ignore
  }
}

async function _loadMenuDbFromStatic() {
  // Важно: используем fetch, чтобы не зависеть от axios настроек (cookies и т.п.)
  const res = await fetch(MENU_DB_STATIC_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Static menu JSON failed: ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Static menu JSON is not an array');
  }
  const items = _dedupeById(data);
  _writeMenuDbCache(items, 'static');
  _setMenuDbRuntimeSource('static');
  return items;
}

async function _loadMenuDbFromBackendJson() {
  // Берём menu-database.json через бэкенд (он читает data/menu-database.json напрямую)
  const res = await fetch(MENU_DB_BACKEND_JSON_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Backend menu JSON failed: ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Backend menu JSON is not an array');
  }
  const items = _dedupeById(data);
  _writeMenuDbCache(items, 'backend-json');
  // С точки зрения UI это всё равно "сервер", просто сервер отдаёт файл.
  _setMenuDbRuntimeSource('api', 'menu-json');
  return items;
}

function _forceStaticMenuDb() {
  // KISS: простой “переключатель поведения” без усложнений
  return MENU_DB_SOURCE_MODE === 'static';
}

function _forceBackendJsonMenuDb() {
  return MENU_DB_SOURCE_MODE === 'backend-json';
}

function _deriveMenus(items) {
  // Сохраняем порядок “как в файле”
  const seen = new Set();
  const out = [];
  (items || []).forEach((it) => {
    const name = String(it?.menu || '').trim();
    if (!name) return;
    if (seen.has(name)) return;
    seen.add(name);
    out.push(name);
  });
  return out;
}

function _deriveSections(items, menuName) {
  const menu = menuName ? String(menuName) : null;
  const seen = new Set();
  const out = [];
  (items || []).forEach((it) => {
    if (!it || typeof it !== 'object') return;
    if (menu && String(it.menu) !== menu) return;
    const section = String(it.section || '').trim();
    if (!section) return;
    if (seen.has(section)) return;
    seen.add(section);
    out.push(section);
  });
  return out;
}

function _filterWines(items) {
  const keywords = ['вин', 'wine'];
  return (items || []).filter(
    (it) =>
      it &&
      typeof it === 'object' &&
      (_textContains(it.menu, keywords) || _textContains(it.section, keywords))
  );
}

function _filterBarItems(items) {
  return (items || []).filter((it) => {
    if (!it || typeof it !== 'object') return false;
    return (
      _textContains(it.menu, ['бар', 'bar', 'напит', 'drink']) ||
      _textContains(it.section, [
        'коктейл',
        'cocktail',
        'чай',
        'tea',
        'пиво',
        'beer',
        'кофе',
        'coffee',
        'напит',
        'drink',
      ])
    );
  });
}

// Создаём экземпляр axios с настройками
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Для работы с cookies (Flask-Login)
});

// ========== ПУБЛИЧНЫЕ API ==========

export const getDishes = async () => {
  // Самый удобный режим для ручных правок:
  // REACT_APP_MENU_DB_SOURCE=backend-json
  // Тогда вы правите data/menu-database.json, а UI всегда берёт данные через /api/menu-json (без БД).
  if (_forceBackendJsonMenuDb()) {
    return await _loadMenuDbFromBackendJson();
  }

  // Если вы правите меню руками локально — включите REACT_APP_MENU_DB_SOURCE=static
  // Тогда UI будет читать только из frontend/public/data/menu-database.json
  if (_forceStaticMenuDb()) {
    return await _loadMenuDbFromStatic();
  }

  try {
    const response = await api.get('/api/dishes', { timeout: 8000 });
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      const items = _dedupeById(data);
      _writeMenuDbCache(items, 'api');
      _setMenuDbRuntimeSource('api');
      return items;
    }
    // Если API вернул пусто — пробуем “запасной план”, чтобы меню не пропало
    const fallback = await _loadMenuDbFromStatic();
    return fallback;
  } catch (err) {
    // 1) пробуем статический JSON
    try {
      return await _loadMenuDbFromStatic();
    } catch {
      // 2) пробуем кэш
      const cached = _readMenuDbCache();
      if (cached) {
        _setMenuDbRuntimeSource('cache');
        return cached;
      }
      throw err;
    }
  }
};

export const getDish = async (id) => {
  const normId = _normalizeId(id);
  if (!normId) {
    throw new Error('Dish id is required');
  }

  // Режим "backend-json": берём конкретное блюдо из data/menu-database.json через бэкенд (без API БД)
  if (_forceBackendJsonMenuDb()) {
    const items = await _loadMenuDbFromBackendJson();
    const found = items.find((it) => String(it.id) === String(normId));
    if (found) return found;
    throw new Error('Dish not found (backend-json)');
  }

  // Режим "static": берём конкретное блюдо из файла (без API)
  if (_forceStaticMenuDb()) {
    const items = await _loadMenuDbFromStatic();
    const found = items.find((it) => String(it.id) === String(normId));
    if (found) {
      _setMenuDbRuntimeSource('static', 'forced-static/single-item');
      return found;
    }
    throw new Error('Dish not found (static)');
  }

  try {
    const response = await api.get(`/api/dishes/${normId}`, { timeout: 8000 });
    _setMenuDbRuntimeSource('api');
    return response.data;
  } catch (err) {
    // Фолбэк: ищем блюдо в локальном JSON/кэше
    try {
      const items = await _loadMenuDbFromStatic();
      const found = items.find((it) => String(it.id) === String(normId));
      if (found) {
        _setMenuDbRuntimeSource('static', 'single-item');
        return found;
      }
    } catch {
      const cached = _readMenuDbCache();
      const found = cached?.find((it) => String(it.id) === String(normId));
      if (found) {
        _setMenuDbRuntimeSource('cache', 'single-item');
        return found;
      }
    }
    throw err;
  }
};

export const getMenus = async () => {
  // В режиме предпросмотра из файла НЕ ходим в /api/menus, чтобы БД не “перебивала” результат.
  if (_forceBackendJsonMenuDb()) {
    const items = await getDishes();
    return _deriveMenus(items);
  }
  try {
    const response = await api.get('/api/menus', { timeout: 8000 });
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      _setMenuDbRuntimeSource('api');
      return data;
    }
    const items = await getDishes();
    return _deriveMenus(items);
  } catch (err) {
    try {
      const items = await getDishes();
      return _deriveMenus(items);
    } catch {
      throw err;
    }
  }
};

export const getSections = async (menuName = null) => {
  // В режиме предпросмотра из файла НЕ ходим в /api/sections, чтобы БД не “перебивала” результат.
  if (_forceBackendJsonMenuDb()) {
    const items = await getDishes();
    return _deriveSections(items, menuName);
  }
  const params = menuName ? { menu: menuName } : {};
  try {
    const response = await api.get('/api/sections', { params, timeout: 8000 });
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      _setMenuDbRuntimeSource('api');
      return data;
    }
    const items = await getDishes();
    return _deriveSections(items, menuName);
  } catch (err) {
    try {
      const items = await getDishes();
      return _deriveSections(items, menuName);
    } catch {
      throw err;
    }
  }
};

// ========== API ДЛЯ ВИН ==========

export const getWines = async () => {
  // В режиме предпросмотра из файла берём вина из общего списка (из файла), а не из /api/wines.
  if (_forceBackendJsonMenuDb()) {
    const items = await getDishes();
    return _filterWines(items);
  }
  try {
    const response = await api.get('/api/wines', { timeout: 8000 });
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      _setMenuDbRuntimeSource('api');
      return data;
    }
    const items = await getDishes();
    return _filterWines(items);
  } catch (err) {
    try {
      const items = await getDishes();
      return _filterWines(items);
    } catch {
      throw err;
    }
  }
};

export const getWinesByCategory = async (category) => {
  const cat = String(category || '').trim();
  if (!cat) return [];
  if (_forceBackendJsonMenuDb()) {
    const items = await getDishes();
    return _filterWines(items).filter((w) => w?.category === cat);
  }
  try {
    const response = await api.get(`/api/wines/category/${cat}`, { timeout: 8000 });
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      _setMenuDbRuntimeSource('api');
      return data;
    }
    const items = await getDishes();
    return _filterWines(items).filter((w) => w?.category === cat);
  } catch (err) {
    try {
      const items = await getDishes();
      return _filterWines(items).filter((w) => w?.category === cat);
    } catch {
      throw err;
    }
  }
};

export const getWine = async (id) => {
  const normId = _normalizeId(id);
  if (!normId) {
    throw new Error('Wine id is required');
  }
  if (_forceBackendJsonMenuDb()) {
    const items = await getDishes();
    const found = _filterWines(items).find((w) => String(w.id) === String(normId));
    if (found) return found;
    throw new Error('Wine not found (backend-json)');
  }
  try {
    const response = await api.get(`/api/wines/${normId}`, { timeout: 8000 });
    _setMenuDbRuntimeSource('api');
    return response.data;
  } catch (err) {
    // Фолбэк: ищем в общем списке (из JSON/кэша)
    try {
      const items = await getDishes();
      const found = _filterWines(items).find((w) => String(w.id) === String(normId));
      if (found) return found;
    } catch {
      // игнорируем и пробрасываем исходную ошибку
    }
    throw err;
  }
};

// ========== API ДЛЯ БАРНОГО МЕНЮ ==========

export const getBarItems = async () => {
  // В режиме предпросмотра из файла берём бар из общего списка (из файла), а не из /api/bar-items.
  if (_forceBackendJsonMenuDb()) {
    const items = await getDishes();
    return _filterBarItems(items);
  }
  try {
    const response = await api.get('/api/bar-items', { timeout: 8000 });
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      _setMenuDbRuntimeSource('api');
      return data;
    }
    const items = await getDishes();
    return _filterBarItems(items);
  } catch (err) {
    try {
      const items = await getDishes();
      return _filterBarItems(items);
    } catch {
      throw err;
    }
  }
};

// ========== АДМИНСКИЕ API ==========

export const login = async (username, password, remember = false) => {
  // remember: "Запомнить меня" — просим сервер сделать долгую авторизацию
  const response = await api.post('/api/admin/login', { username, password, remember });
  return response.data;
};

export const loginAsGuest = async () => {
  const response = await api.post('/api/admin/login/guest');
  return response.data;
};

export const logout = async () => {
  const response = await api.post('/api/admin/logout');
  return response.data;
};

export const checkAuth = async () => {
  const response = await api.get('/api/admin/check');
  return response.data;
};

export const saveDishes = async (dishes) => {
  const response = await api.post('/api/admin/dishes', dishes);
  return response.data;
};

export const updateDish = async (id, dish) => {
  const response = await api.put(`/api/admin/dishes/${id}`, dish);
  return response.data;
};

export const addDish = async (dish) => {
  const response = await api.put('/api/admin/dishes', dish);
  return response.data;
};

export const deleteDish = async (id) => {
  const response = await api.delete(`/api/admin/dishes/${id}`);
  return response.data;
};

// ========== API ДЛЯ ОБРАТНОЙ СВЯЗИ ==========

export const submitFeedback = async (feedbackData) => {
  const response = await api.post('/api/feedback', feedbackData);
  return response.data;
};

export const getFeedbackMessages = async () => {
  const response = await api.get('/api/admin/feedback');
  return response.data;
};

export const markFeedbackRead = async (messageId) => {
  const response = await api.put(`/api/admin/feedback/${messageId}/read`);
  return response.data;
};

export const deleteFeedbackMessage = async (messageId) => {
  const response = await api.delete(`/api/admin/feedback/${messageId}`);
  return response.data;
};

// ========== API ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ==========

export const getUsers = async () => {
  const response = await api.get('/api/admin/users');
  return response.data;
};

export const createUser = async (userData) => {
  const response = await api.post('/api/admin/users', userData);
  return response.data;
};

export const updateUser = async (userId, userData) => {
  const response = await api.put(`/api/admin/users/${userId}`, userData);
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/api/admin/users/${userId}`);
  return response.data;
};

// ========== АДМИН: ИМПОРТ МЕНЮ И (ОПЦ.) ДЕПЛОЙ ==========

export const importMenuJson = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/admin/menu/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getDeployStatus = async () => {
  const response = await api.get('/api/admin/deploy/status');
  return response.data;
};

export const runDeploy = async (deployToken) => {
  const response = await api.post(
    '/api/admin/deploy/run',
    {},
    {
      headers: { 'X-Deploy-Token': deployToken || '' },
    }
  );
  return response.data;
};

export const getDeployJob = async () => {
  const response = await api.get('/api/admin/deploy/job');
  return response.data;
};

export default api;

