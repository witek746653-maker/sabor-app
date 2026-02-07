export const DEFAULT_VISIBILITY_CONFIG = {
  version: 0,
  rules: [],
  features: {},
};

const ALLOWED_ACTIONS = new Set(['allow', 'deny']);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const cleanObject = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const result = {};
  // Сортируем ключи, чтобы порядок всегда был одинаковым
  Object.keys(obj).sort().forEach(key => {
    const val = obj[key];
    // Пропускаем пустые или дефолтные значения
    if (val === null || val === undefined) return;
    if (Array.isArray(val) && val.length === 0) return;
    if (typeof val === 'boolean' && val === false && key !== 'enabled') return;
    result[key] = val;
  });
  return Object.keys(result).length > 0 ? result : null;
};

const normalizeRule = (rule) => {
  if (!rule || typeof rule !== 'object') return null;
  const id = String(rule.id || '').trim();
  const scope = String(rule.scope || '').trim();
  const target = String(rule.target || '').trim();
  const action = String(rule.action || '').trim();
  if (!id || !scope || !target || !ALLOWED_ACTIONS.has(action)) return null;

  const enabled = rule.enabled !== false;
  const when = cleanObject(rule.when);

  // Возвращаем объект с четким порядком ключей для JSON.stringify
  return {
    action,
    enabled,
    id,
    scope,
    target,
    when,
  };
};

const ruleMatchesTarget = (rule, scope, target) => {
  if (!rule || !rule.enabled) return false;
  if (rule.scope !== scope) return false;
  return rule.target === target;
};

export const ruleMatchesUser = (rule, userContext) => {
  if (!rule) return false;
  const when = rule.when || {}; // Защита от null

  const role = userContext?.role;
  const userId = userContext?.userId;
  const isGuest = Boolean(userContext?.isGuest);
  const isAdminUser = Boolean(userContext?.isAdmin); // Это реальный статус пользователя
  const canWrite = Boolean(userContext?.canWrite);
  const isAuthenticated = Boolean(userContext?.isAuthenticated);

  // === НОВАЯ ЛОГИКА ДЛЯ АДМИНА ===
  // Админ видит всё по умолчанию. Правила скрытия (deny) для него работают 
  // ТОЛЬКО если в правиле явно стоит галочка "Админ" (when.isAdmin === true).
  // Галочка "Для всех" (when.everyone) на админа НЕ действует.
  if (isAdminUser) {
    if (when.isAdmin === true) return true; // Правило применяется к админу
    return false; // Иначе админ игнорирует это правило
  }

  // === ЛОГИКА ДЛЯ ОСТАЛЬНЫХ ===
  // Если "Для всех", то правило работает для всех (кроме админа, см. выше)
  if (when.everyone === true) return true;

  // Если правило пустое (нет условий), считаем что оно не работает ни для кого 
  // (или для всех? По старой логике было для всех, но безопаснее требовать явного указания).
  // Но для обратной совместимости, если объект when пуст, можно считать false, 
  // так как в UI галочка "Для всех" создает поле everyone: true.
  if (Object.keys(when).length === 0) return false;

  const conditions = [];

  // Проверка ролей
  if (Array.isArray(when.roles) && when.roles.length > 0) {
    conditions.push(() => role && when.roles.includes(role));
  }
  // Проверка ID
  if (Array.isArray(when.userIds) && when.userIds.length > 0) {
    const allowedIds = when.userIds.map((id) => String(id));
    conditions.push(() => userId && allowedIds.includes(String(userId)));
  }

  // Флаги
  if (when.isGuest === true) {
    conditions.push(() => isGuest === true);
  }
  // when.isAdmin === true уже не проверяем здесь, так как non-admin пользователь не может быть админом
  if (when.canWrite === true) {
    conditions.push(() => canWrite === true);
  }
  if (when.isAuthenticated === true) {
    conditions.push(() => isAuthenticated === true);
  }

  if (conditions.length === 0) return false;

  return conditions.some((check) => check());
};

const ruleSpecificity = (rule, userContext) => {
  const when = rule?.when || {};
  let score = 0;

  if (Array.isArray(when.userIds) && when.userIds.length > 0) {
    const allowedIds = when.userIds.map((id) => String(id));
    if (allowedIds.includes(String(userContext?.userId))) score += 3;
  }
  if (Array.isArray(when.roles) && when.roles.length > 0) {
    if (when.roles.includes(userContext?.role)) score += 2;
  }
  if (when.isGuest === true) score += 1;
  if (when.isAdmin === true) score += 1;
  if (when.canWrite === true) score += 1;
  if (when.isAuthenticated === true) score += 1;

  return score;
};

export const normalizeVisibilityConfig = (rawConfig) => {
  if (!rawConfig || typeof rawConfig !== 'object') return DEFAULT_VISIBILITY_CONFIG;
  const rules = toArray(rawConfig.rules)
    .map(normalizeRule)
    .filter(Boolean);

  const rawFeatures = rawConfig.features && typeof rawConfig.features === 'object' ? rawConfig.features : {};
  const features = {};
  Object.entries(rawFeatures).forEach(([key, value]) => {
    const featureKey = String(key || '').trim();
    if (!featureKey) return;
    const obj = value && typeof value === 'object' ? value : {};
    features[featureKey] = {
      comingSoon: obj.comingSoon === true,
      allowAccess: obj.allowAccess === true,
    };
  });
  return {
    version: Number(rawConfig.version || 0),
    rules,
    features,
  };
};

export const resolveVisibility = ({ config, scope, target, userContext }) => {
  const normalized = normalizeVisibilityConfig(config);
  if (!scope || !target) return true;

  const matched = normalized.rules
    .filter((rule) => ruleMatchesTarget(rule, scope, target))
    .filter((rule) => ruleMatchesUser(rule, userContext))
    .map((rule) => ({
      rule,
      specificity: ruleSpecificity(rule, userContext),
    }));

  if (matched.length === 0) return true;

  const maxSpecificity = Math.max(...matched.map((item) => item.specificity));
  const top = matched.filter((item) => item.specificity === maxSpecificity);

  if (top.some((item) => item.rule.action === 'deny')) return false;
  if (top.some((item) => item.rule.action === 'allow')) return true;

  return true;
};
