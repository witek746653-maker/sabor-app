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

// Конфигурация статусов функций
const FEATURE_STATUS = {
  // Навигация и меню
  'workSchedule': true,          // Режим работы
  'banquets': true,              // Банкеты
  'guestSituations': true,       // Ситуации с гостем
  'faq': true,                   // Частые вопросы гостей
  'checklists': true,            // Чек-листы
  'servicePrinciples': true,     // Принципы сервиса
  'theme': true,                 // Тема (переключение темы)
  
  // Инструменты
  'cigarEncyclopedia': true,     // Сигарная энциклопедия
  
  // Админ-панель (можно добавить конкретные функции)
  'adminUsers': false,           // Управление пользователями (работает)
  'adminNotifications': false,   // Уведомления (работает)
  'adminFeedback': false,        // Обратная связь (работает)
  
  // Другие функции
  'favorites': false,            // Избранное (работает, но только для не-гостей)
  'barMenu': false,              // Барное меню (работает)
  'globalSearch': false,         // Глобальный поиск (работает)
};

/**
 * Проверяет, находится ли функция в разработке
 * 
 * @param {string} featureName - Название функции из FEATURE_STATUS
 * @returns {boolean} - true, если функция в разработке
 */
export const isComingSoon = (featureName) => {
  return FEATURE_STATUS[featureName] === true;
};

/**
 * Получает все функции, которые находятся в разработке
 * 
 * @returns {Array<string>} - Массив названий функций в разработке
 */
export const getComingSoonFeatures = () => {
  return Object.keys(FEATURE_STATUS).filter(
    feature => FEATURE_STATUS[feature] === true
  );
};

/**
 * Получает все функции, которые работают
 * 
 * @returns {Array<string>} - Массив названий работающих функций
 */
export const getAvailableFeatures = () => {
  return Object.keys(FEATURE_STATUS).filter(
    feature => FEATURE_STATUS[feature] === false
  );
};

export default {
  isComingSoon,
  getComingSoonFeatures,
  getAvailableFeatures,
  FEATURE_STATUS
};
