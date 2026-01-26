export const DEFAULT_VISIBILITY_CONFIG = {
  version: 0,
  rules: [],
};

const ALLOWED_ACTIONS = new Set(['allow', 'deny']);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const normalizeRule = (rule) => {
  if (!rule || typeof rule !== 'object') return null;
  const id = String(rule.id || '').trim();
  const scope = String(rule.scope || '').trim();
  const target = String(rule.target || '').trim();
  const action = String(rule.action || '').trim();
  if (!id || !scope || !target || !ALLOWED_ACTIONS.has(action)) return null;

  const enabled = rule.enabled !== false;
  const when = rule.when && typeof rule.when === 'object' ? rule.when : null;

  return {
    id,
    scope,
    target,
    action,
    enabled,
    when,
  };
};

const ruleMatchesTarget = (rule, scope, target) => {
  if (!rule || !rule.enabled) return false;
  if (rule.scope !== scope) return false;
  return rule.target === target;
};

const ruleMatchesUser = (rule, userContext) => {
  if (!rule) return false;
  const when = rule.when;
  if (!when || when.everyone === true) return true;

  const role = userContext?.role;
  const userId = userContext?.userId;
  const isGuest = Boolean(userContext?.isGuest);
  const isAdmin = Boolean(userContext?.isAdmin);
  const canWrite = Boolean(userContext?.canWrite);
  const isAuthenticated = Boolean(userContext?.isAuthenticated);

  if (Array.isArray(when.roles) && when.roles.length > 0) {
    if (!role || !when.roles.includes(role)) return false;
  }
  if (Array.isArray(when.userIds) && when.userIds.length > 0) {
    const allowedIds = when.userIds.map((id) => String(id));
    if (!userId || !allowedIds.includes(String(userId))) return false;
  }
  if (typeof when.isGuest === 'boolean' && when.isGuest !== isGuest) return false;
  if (typeof when.isAdmin === 'boolean' && when.isAdmin !== isAdmin) return false;
  if (typeof when.canWrite === 'boolean' && when.canWrite !== canWrite) return false;
  if (typeof when.isAuthenticated === 'boolean' && when.isAuthenticated !== isAuthenticated) return false;

  return true;
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
  if (typeof when.isGuest === 'boolean') score += 1;
  if (typeof when.isAdmin === 'boolean') score += 1;
  if (typeof when.canWrite === 'boolean') score += 1;
  if (typeof when.isAuthenticated === 'boolean') score += 1;

  return score;
};

export const normalizeVisibilityConfig = (rawConfig) => {
  if (!rawConfig || typeof rawConfig !== 'object') return DEFAULT_VISIBILITY_CONFIG;
  const rules = toArray(rawConfig.rules)
    .map(normalizeRule)
    .filter(Boolean);
  return {
    version: Number(rawConfig.version || 0),
    rules,
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
