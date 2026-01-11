import * as Sentry from '@sentry/react';

/**
 * Инициализация Sentry для автоматического сбора ошибок
 * 
 * Sentry - это сервис для отслеживания ошибок в приложениях.
 * Он автоматически собирает информацию об ошибках: стек вызовов,
 * контекст (какая страница, какая роль пользователя), и отправляет
 * их на сервер Sentry, где вы можете их анализировать.
 */

// Проверяем, включен ли сбор ошибок для текущего окружения
const isErrorTrackingEnabled = () => {
  const env = process.env.NODE_ENV || 'development';
  const enabled = process.env.REACT_APP_SENTRY_ENABLED;
  
  // Если явно указано в переменных окружения, используем это значение
  if (enabled !== undefined) {
    return enabled === 'true' || enabled === '1';
  }
  
  // По умолчанию включаем для production и demo, отключаем для development
  return env === 'production' || env === 'demo';
};

// Получаем DSN (Data Source Name) из переменных окружения
// DSN - это уникальный адрес вашего проекта в Sentry
const getSentryDsn = () => {
  return process.env.REACT_APP_SENTRY_DSN || '';
};

/**
 * Инициализирует Sentry
 * Вызывается один раз при загрузке приложения
 */
export const initSentry = () => {
  // Проверяем, включен ли сбор ошибок
  if (!isErrorTrackingEnabled()) {
    console.log('[Sentry] Error tracking is disabled for this environment');
    return;
  }

  const dsn = getSentryDsn();
  
  // Если DSN не указан, не инициализируем Sentry
  if (!dsn) {
    console.warn('[Sentry] DSN is not configured. Error tracking will be disabled.');
    return;
  }

  // Инициализируем Sentry с настройками
  Sentry.init({
    // DSN - уникальный идентификатор вашего проекта в Sentry
    dsn: dsn,
    
    // Окружение (development, demo, production)
    environment: process.env.NODE_ENV || 'development',
    
    // Версия приложения (можно указать в package.json или через переменную окружения)
    release: process.env.REACT_APP_VERSION || '1.0.0',
    
    // Включаем интеграции для отслеживания
    integrations: [
      // Интеграция для отслеживания производительности браузера
      Sentry.browserTracingIntegration(),
      // Включаем запись сессий для воспроизведения действий пользователя при ошибке
      Sentry.replayIntegration({
        maskAllText: true,  // Скрываем весь текст на странице (безопасность)
        blockAllMedia: true,  // Блокируем медиа (изображения, видео)
      }),
    ],
    
    // Процент трафика, для которого включается отслеживание производительности (0-1)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Процент сессий, которые будут записаны (0.1 = 10%)
    replaysSessionSampleRate: 0.1,
    // Процент сессий для записи, когда происходит ошибка (1.0 = 100%)
    replaysOnErrorSampleRate: 1.0,
    
    // Фильтруем чувствительные данные перед отправкой
    beforeSend(event, hint) {
      // Не отправляем ошибки, если Sentry отключен
      if (!isErrorTrackingEnabled()) {
        return null;
      }
      
      // Удаляем чувствительные данные из ошибки
      event = sanitizeEvent(event);
      
      return event;
    },
    
    // Фильтруем данные из breadcrumbs (история действий пользователя)
    beforeBreadcrumb(breadcrumb, hint) {
      // Удаляем чувствительные данные из breadcrumbs
      if (breadcrumb.data) {
        breadcrumb.data = sanitizeBreadcrumbData(breadcrumb.data);
      }
      return breadcrumb;
    },
  });
  
  console.log('[Sentry] Error tracking initialized');
};

/**
 * Устанавливает контекст пользователя для всех отправляемых ошибок
 * @param {Object} user - объект пользователя из AuthContext
 */
export const setUserContext = (user) => {
  if (!isErrorTrackingEnabled()) {
    return;
  }
  
  if (user) {
    // Устанавливаем контекст пользователя (БЕЗ пароля!)
    Sentry.setUser({
      id: user.id?.toString() || 'unknown',
      username: user.username || 'unknown',
      role: user.role || 'guest',
      // НЕ передаём пароль, email и другие чувствительные данные!
    });
  } else {
    // Если пользователь вышел, очищаем контекст
    Sentry.setUser(null);
  }
};

/**
 * Устанавливает теги для группировки ошибок
 * @param {Object} tags - объект с тегами (например, { page: '/menu', action: 'loadDishes' })
 */
export const setTags = (tags) => {
  if (!isErrorTrackingEnabled()) {
    return;
  }
  
  Sentry.setTags(tags);
};

/**
 * Добавляет дополнительный контекст к ошибкам
 * @param {Object} context - объект с контекстом (например, { menuName: 'Основное меню' })
 */
export const setContext = (key, context) => {
  if (!isErrorTrackingEnabled()) {
    return;
  }
  
  Sentry.setContext(key, context);
};

/**
 * Удаляет чувствительные данные из события ошибки
 * @param {Object} event - событие ошибки от Sentry
 */
function sanitizeEvent(event) {
  // Удаляем пароли из request data
  if (event.request) {
    if (event.request.data) {
      event.request.data = sanitizeData(event.request.data);
    }
    if (event.request.query_string) {
      event.request.query_string = sanitizeString(event.request.query_string);
    }
  }
  
  // Удаляем пароли из user data
  if (event.user) {
    delete event.user.password;
    delete event.user.password_hash;
    delete event.user.email;  // Удаляем email, если не нужен
  }
  
  // Удаляем пароли из extra data
  if (event.extra) {
    event.extra = sanitizeData(event.extra);
  }
  
  return event;
}

/**
 * Удаляет чувствительные данные из breadcrumb data
 * @param {Object} data - данные breadcrumb
 */
function sanitizeBreadcrumbData(data) {
  return sanitizeData(data);
}

/**
 * Рекурсивно удаляет чувствительные поля из объекта
 * @param {Object|Array|string} data - данные для очистки
 */
function sanitizeData(data) {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Пропускаем поля, которые могут содержать пароли или чувствительные данные
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('credential')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Удаляет пароли из строки
 * @param {string} str - строка для очистки
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  
  // Удаляем значения вида "password": "..." из JSON строк
  return str.replace(/"password":\s*"[^"]*"/gi, '"password": "[REDACTED]"');
}

// Экспортируем объект Sentry для прямого использования (если нужно)
export { Sentry };
