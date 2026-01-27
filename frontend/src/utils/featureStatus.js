/**
 * Централизованная конфигурация статусов функций
 * 
 * Используется для управления тем, какие функции/страницы/элементы находятся в разработке.
 * Легко включать и отключать статус "в разработке" без переписывания логики компонентов.
 * 
 * Пример использования:
 * import { isComingSoon } from '../utils/featureStatus';
 * 
 * <ComingSoonWrapper isComingSoon={isComingSoon('workSchedule')}>
 *   <button>Режим работы</button>
 * </ComingSoonWrapper>
 */

/**
 * Дефолтные статусы функций (fallback), если конфиг из админки ещё не загружен.
 *
 * Важно:
 * - `comingSoon: true`  => показываем бейдж "В разработке"
 * - `allowAccess: true` => доступ РАЗРЕШЁН, но бейдж остаётся
 */
export const DEFAULT_FEATURE_FLAGS = {
  // Главная → боковое меню
  workSchedule: { comingSoon: true, allowAccess: false },
  banquets: { comingSoon: true, allowAccess: false },
  guestSituations: { comingSoon: true, allowAccess: false },
  faq: { comingSoon: true, allowAccess: false },
  checklists: { comingSoon: true, allowAccess: false },
  servicePrinciples: { comingSoon: true, allowAccess: false },

  // Прочее
  theme: { comingSoon: false, allowAccess: true },
  cigarEncyclopedia: { comingSoon: true, allowAccess: false },
  waiterTrainer: { comingSoon: true, allowAccess: false }, // Тренажер официанта (Информация)

  // Админка
  adminUsers: { comingSoon: false, allowAccess: true },
  adminNotifications: { comingSoon: false, allowAccess: true },
  adminFeedback: { comingSoon: false, allowAccess: true },

  // Навигация
  favorites: { comingSoon: false, allowAccess: true },
  barMenu: { comingSoon: false, allowAccess: true },
  globalSearch: { comingSoon: false, allowAccess: true },
};

/**
 * Метаданные для админ‑интерфейса (чтобы было понятно, что это за фича).
 */
export const FEATURE_DEFINITIONS = [
  { key: 'workSchedule', label: 'Режим работы (Главная → боковое меню)' },
  { key: 'banquets', label: 'Банкеты (Главная → боковое меню)' },
  { key: 'guestSituations', label: 'Ситуации с гостем (Главная → боковое меню)' },
  { key: 'faq', label: 'Частые вопросы гостей (Главная → боковое меню)' },
  { key: 'checklists', label: 'Чек‑листы (Главная → боковое меню)' },
  { key: 'servicePrinciples', label: 'Принципы сервиса (Главная → боковое меню)' },
  { key: 'waiterTrainer', label: 'Тренажер официанта (Информация)' },
  { key: 'cigarEncyclopedia', label: 'Сигарная энциклопедия (Информация)' },
];

/**
 * Проверяет, находится ли функция в разработке
 * 
 * @param {string} featureName - Название функции из FEATURE_STATUS
 * @returns {boolean} - true, если функция в разработке
 */
export const isComingSoon = (featureName) => {
  const cfg = DEFAULT_FEATURE_FLAGS[featureName];
  return cfg?.comingSoon === true;
};

/**
 * Получает все функции, которые находятся в разработке
 * 
 * @returns {Array<string>} - Массив названий функций в разработке
 */
export const getComingSoonFeatures = () => {
  return Object.keys(DEFAULT_FEATURE_FLAGS).filter(
    feature => DEFAULT_FEATURE_FLAGS[feature]?.comingSoon === true
  );
};

/**
 * Получает все функции, которые работают
 * 
 * @returns {Array<string>} - Массив названий работающих функций
 */
export const getAvailableFeatures = () => {
  return Object.keys(DEFAULT_FEATURE_FLAGS).filter(
    feature => DEFAULT_FEATURE_FLAGS[feature]?.comingSoon !== true
  );
};

export default {
  isComingSoon,
  getComingSoonFeatures,
  getAvailableFeatures,
  DEFAULT_FEATURE_FLAGS
};
