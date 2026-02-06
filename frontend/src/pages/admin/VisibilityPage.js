import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import {
  getAdminVisibilityConfig,
  rollbackVisibilityConfig,
  updateVisibilityLive,
} from '../../services/visibilityConfig';
import {
  DEFAULT_VISIBILITY_CONFIG,
  normalizeVisibilityConfig,
  resolveVisibility,
  ruleMatchesUser,
} from '../../utils/visibilityResolver';
import { FEATURE_DEFINITIONS, DEFAULT_FEATURE_FLAGS } from '../../utils/featureStatus';

const RULE_SCOPES = ['route', 'menuItem', 'menuSection', 'pageBlock', 'featureAction', 'contentItem'];
const ACTIONS = ['allow', 'deny'];
const ROLE_OPTIONS = ['guest', 'официант', 'администратор', 'хостес', 'менеджер'];

// Стили для выпадающих списков (select)
const selectStyles = `
  select {
    appearance: none !important;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
    background-repeat: no-repeat !important;
    background-position: right 0.5rem center !important;
    background-size: 1em !important;
    padding-right: 2rem !important;
    background-color: transparent !important;
    color: inherit !important;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 0.5rem;
  }
  .dark select {
    border-color: rgba(255,255,255,0.1);
  }
  select option {
    background-color: #ffffff !important;
    color: #1a1a1a !important;
  }
  .dark select option {
    background-color: #1c1c1e !important;
    color: #ffffff !important;
  }
`;

const SCOPE_LABELS = {
  route: 'Маршрут',
  menuItem: 'Элемент меню',
  menuSection: 'Раздел меню',
  pageBlock: 'Блок страницы',
  featureAction: 'Действие/кнопка',
  contentItem: 'Конкретная позиция',
};

const TARGET_GROUPS = [
  {
    id: 'footer',
    title: 'Нижнее меню (footer)',
    hint: 'Управляет видимостью кнопок нижнего меню и, по договорённости, блокирует доступ к страницам.',
    items: [
      { scope: 'menuItem', target: 'footer.menu', label: 'Нижнее меню: Меню' },
      { scope: 'menuItem', target: 'footer.favorites', label: 'Нижнее меню: Избранное' },
      { scope: 'menuItem', target: 'footer.search', label: 'Нижнее меню: Поиск' },
      { scope: 'menuItem', target: 'footer.tools', label: 'Нижнее меню: Информация' },
      { scope: 'menuItem', target: 'footer.admin', label: 'Нижнее меню: Админ-панель' },
    ],
  },
  {
    id: 'routes',
    title: 'Маршруты (route)',
    hint: 'Если отключить — доступ по прямой ссылке блокируется.',
    items: [
      { scope: 'route', target: '/', label: 'Маршрут: / (Главная)' },
      { scope: 'route', target: '/favorites', label: 'Маршрут: /favorites (Избранное)' },
      { scope: 'route', target: '/info', label: 'Маршрут: /info (Информация)' },
      { scope: 'route', target: '/wine-catalog', label: 'Маршрут: /wine-catalog (Каталог вин)' },
      { scope: 'route', target: '/wine/:id', label: 'Маршрут: /wine/:id (Карточка вина)' },
      { scope: 'route', target: '/bar/:id', label: 'Маршрут: /bar/:id (Карточка бара)' },
    ],
  },
  {
    id: 'homeTiles',
    title: 'Главная: плитки меню',
    hint: 'Управляет видимостью плиток на главной.',
    items: [
      { scope: 'pageBlock', target: 'home.tile.main', label: 'Главная: Основное меню' },
      { scope: 'pageBlock', target: 'home.tile.breakfast', label: 'Главная: Авторские завтраки' },
      { scope: 'pageBlock', target: 'home.tile.winter', label: 'Главная: Зимнее меню' },
      { scope: 'pageBlock', target: 'home.tile.kids', label: 'Главная: Детское меню' },
      { scope: 'pageBlock', target: 'home.tile.plantBased', label: 'Главная: Постное меню' },
      { scope: 'pageBlock', target: 'home.tile.bar', label: 'Главная: Барное меню' },
      { scope: 'pageBlock', target: 'home.tile.tea', label: 'Главная: Чайное меню' },
      { scope: 'pageBlock', target: 'home.tile.special', label: 'Главная: Специальное меню' },
      { scope: 'pageBlock', target: 'home.tile.wine', label: 'Главная: Вино' },
    ],
  },
  {
    id: 'homeSidebar',
    title: 'Главная: боковое меню',
    hint: 'Управляет видимостью пунктов в боковом меню.',
    items: [
      { scope: 'pageBlock', target: 'home.sidebar.workSchedule', label: 'Боковое меню: Режим работы' },
      { scope: 'pageBlock', target: 'home.sidebar.banquets', label: 'Боковое меню: Банкеты' },
      { scope: 'pageBlock', target: 'home.sidebar.guestSituations', label: 'Боковое меню: Ситуации с гостем' },
      { scope: 'pageBlock', target: 'home.sidebar.faq', label: 'Боковое меню: Частые вопросы гостей' },
      { scope: 'pageBlock', target: 'home.sidebar.checklists', label: 'Боковое меню: Чек-листы' },
      { scope: 'pageBlock', target: 'home.sidebar.servicePrinciples', label: 'Боковое меню: Принципы сервиса' },
      { scope: 'pageBlock', target: 'home.sidebar.theme', label: 'Боковое меню: Тема' },
      { scope: 'pageBlock', target: 'home.sidebar.logout', label: 'Боковое меню: Выход из системы' },
    ],
  },
  {
    id: 'detailBlocks',
    title: 'Карточки: блоки контента',
    hint: 'Управляет блоками на страницах блюда, вина и бара.',
    items: [
      { scope: 'pageBlock', target: 'dishDetail.description', label: 'Карточка блюда: Описание' },
      { scope: 'pageBlock', target: 'dishDetail.composition', label: 'Карточка блюда: Состав' },
      { scope: 'pageBlock', target: 'dishDetail.allergens', label: 'Карточка блюда: Аллергены' },
      { scope: 'pageBlock', target: 'dishDetail.features', label: 'Карточка блюда: Особенности' },
      { scope: 'pageBlock', target: 'wineDetail.description', label: 'Карточка вина: Описание' },
      { scope: 'pageBlock', target: 'wineDetail.features', label: 'Карточка вина: Особенности' },
      { scope: 'pageBlock', target: 'wineDetail.characteristics', label: 'Карточка вина: Характеристики' },
      { scope: 'pageBlock', target: 'wineDetail.pairings', label: 'Карточка вина: Пэринг' },
      { scope: 'pageBlock', target: 'barDetail.ingredients', label: 'Карточка бара: Ингредиенты' },
      { scope: 'pageBlock', target: 'barDetail.allergens', label: 'Карточка бара: Аллергены' },
      { scope: 'pageBlock', target: 'barDetail.description', label: 'Карточка бара: Описание' },
    ],
  },
  {
    id: 'detailButtons',
    title: 'Карточки: действия',
    hint: 'Управляет кнопками на индивидуальных страницах.',
    items: [
      { scope: 'featureAction', target: 'favorite.button', label: 'Кнопка: Избранное (сердце)' },
      { scope: 'featureAction', target: 'language.switcher', label: 'Кнопка: Язык' },
      { scope: 'pageBlock', target: 'search.input', label: 'Поле: Поиск' },
      { scope: 'featureAction', target: 'tools.pdf.share', label: 'Информация: действие Отправить' },
    ],
  },
  {
    id: 'contentItems',
    title: 'Конкретные блюда и напитки (по ID)',
    hint: 'Введите ID позиции, например: dish:123, wine:456, bar:789.',
    items: [
      { scope: 'contentItem', target: 'status.archived', label: 'Архивные позиции (скрыть/показать)' },
      { scope: 'contentItem', target: 'dish:ID', label: 'Блюдо по ID (dish:123)' },
      { scope: 'contentItem', target: 'wine:ID', label: 'Вино по ID (wine:123)' },
      { scope: 'contentItem', target: 'bar:ID', label: 'Напиток по ID (bar:123)' },
    ],
  },
];

const ALL_TARGETS = TARGET_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupId: group.id }))
);

const describeWhen = (when) => {
  if (!when || when.everyone) {
    return 'для всех пользователей';
  }
  const parts = [];
  if (Array.isArray(when.roles) && when.roles.length > 0) {
    parts.push(`роли: ${when.roles.join(', ')} `);
  }
  if (Array.isArray(when.userIds) && when.userIds.length > 0) {
    parts.push(`ID пользователей: ${when.userIds.join(', ')} `);
  }
  if (when.isGuest) parts.push('только гости');
  if (when.isAdmin) parts.push('только админы');
  if (when.canWrite) parts.push('может писать');
  if (when.isAuthenticated) parts.push('только авторизованные');
  if (parts.length === 0) return 'для всех пользователей';
  return parts.join('; ');
};

const describeRule = (rule) => {
  if (!rule) return '';
  const actionLabel = rule.action === 'deny' ? 'Скрыть' : 'Показать';
  const scopeLabel = SCOPE_LABELS[rule.scope] || rule.scope;
  const whenLabel = describeWhen(rule.when);
  const enabledLabel = rule.enabled === false ? 'выключено' : 'включено';
  return `${actionLabel} • ${scopeLabel} • ${rule.target} • ${whenLabel} • ${enabledLabel} `;
};

const buildSummaryForRole = (rules, previewContext) => {
  const uniqueTargets = new Map();
  (rules || []).forEach((rule) => {
    if (!rule || !rule.scope || !rule.target) return;
    const key = `${rule.scope}::${rule.target} `;
    if (!uniqueTargets.has(key)) {
      const visible = resolveVisibility({
        config: { rules },
        scope: rule.scope,
        target: rule.target,
        userContext: previewContext,
      });
      uniqueTargets.set(key, {
        scope: rule.scope,
        target: rule.target,
        visible,
      });
    }
  });
  const items = Array.from(uniqueTargets.values());
  const visibleCount = items.filter((item) => item.visible).length;
  const hiddenCount = items.length - visibleCount;
  const lines = items.slice(0, 8).map((item) => {
    const scopeLabel = SCOPE_LABELS[item.scope] || item.scope;
    const action = item.visible ? 'Показывать' : 'Скрывать';
    return `${action}: ${scopeLabel} → ${item.target} `;
  });
  return { total: items.length, visibleCount, hiddenCount, lines };
};

const buildPreviewContext = (roleKey) => {
  if (roleKey === 'guest') {
    return {
      userId: 'guest',
      role: 'guest',
      isAuthenticated: true,
      isGuest: true,
      isAdmin: false,
      canWrite: false,
    };
  }
  if (roleKey === 'администратор') {
    return {
      userId: 1,
      role: 'администратор',
      isAuthenticated: true,
      isGuest: false,
      isAdmin: true,
      canWrite: true,
    };
  }
  return {
    userId: 2,
    role: roleKey || 'официант',
    isAuthenticated: true,
    isGuest: false,
    isAdmin: false,
    canWrite: true,
  };
};

function VisibilityPage() {
  const toast = useToast();
  const [config, setConfig] = useState(DEFAULT_VISIBILITY_CONFIG);
  const [lastSavedConfig, setLastSavedConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'syncing' | 'error'
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [filterScope, setFilterScope] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [history, setHistory] = useState([]);
  const [previewRole, setPreviewRole] = useState('guest');
  const [showHistory, setShowHistory] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('footer');
  const [targetQuickSearch, setTargetQuickSearch] = useState('');

  const previewContext = useMemo(() => buildPreviewContext(previewRole), [previewRole]);

  // Создаем карту: ID правила -> его содержимое в виде СТРОГОЙ строки
  const publishedRulesMap = useMemo(() => {
    const map = new Map();
    // Сначала прогоняем через нормализатор, чтобы убрать лишний "шум"
    const normalizedPublished = normalizeVisibilityConfig({ rules: config?.rules || [] });
    normalizedPublished.rules.forEach(r => {
      map.set(r.id, JSON.stringify(r));
    });
    return map;
  }, [config]);

  const normalizedConfig = useMemo(() => normalizeVisibilityConfig(config), [config]);
  const rules = normalizedConfig.rules;
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) || null;
  const selectedRuleSummary = useMemo(() => describeRule(selectedRule), [selectedRule]);
  const roleSummary = useMemo(
    () => buildSummaryForRole(rules, previewContext),
    [rules, previewContext]
  );
  const activeTargetGroup = useMemo(
    () => TARGET_GROUPS.find((group) => group.id === targetGroupId) || TARGET_GROUPS[0],
    [targetGroupId]
  );
  const quickMatch = useMemo(() => {
    const query = targetQuickSearch.trim().toLowerCase();
    if (!query) return null;
    return ALL_TARGETS.find((item) => item.label.toLowerCase() === query) || null;
  }, [targetQuickSearch]);
  const quickSuggestions = useMemo(() => {
    const query = targetQuickSearch.trim().toLowerCase();
    if (!query) return [];
    return ALL_TARGETS.filter((item) => item.label.toLowerCase().includes(query)).slice(0, 6);
  }, [targetQuickSearch]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getAdminVisibilityConfig();
      // Получаем конфиг напрямую из поля 'config' возвращаемого объекта
      const raw = data.published?.config || {};
      const pub = normalizeVisibilityConfig({
        ...raw,
        version: data.published?.version || raw.version || 0
      });

      setConfig(pub);
      setLastSavedConfig(JSON.stringify(pub));
      setJsonText(JSON.stringify(pub, null, 2));
      setHistory(data.history || []);
      if (pub.version) setLastSavedVersion(pub.version);
    } catch (err) {
      toast.error('Ошибка при загрузке конфигурации');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Авто-сохранение (Debounce 1.5 сек)
  useEffect(() => {
    if (loading) return;

    const currentStr = JSON.stringify(config);
    if (currentStr === lastSavedConfig) {
      setSyncStatus('saved');
      return;
    }

    setSyncStatus('syncing');
    const timer = setTimeout(async () => {
      try {
        const result = await updateVisibilityLive(config);
        setLastSavedVersion(result.version);
        setLastSavedConfig(currentStr);
        setSyncStatus('saved');
      } catch (err) {
        console.error(err);
        setSyncStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [config, loading, lastSavedConfig]);

  useEffect(() => {
    setJsonText(
      JSON.stringify({ rules: normalizedConfig.rules, features: normalizedConfig.features || {} }, null, 2)
    );
  }, [normalizedConfig.rules, normalizedConfig.features]);

  const filteredRules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rules.filter((rule) => {
      if (filterScope !== 'all' && rule.scope !== filterScope) return false;
      if (!query) return true;
      return (
        rule.id.toLowerCase().includes(query) ||
        rule.target.toLowerCase().includes(query) ||
        rule.scope.toLowerCase().includes(query)
      );
    });
  }, [rules, filterScope, searchQuery]);


  const updateRule = (ruleId, patch) => {
    const normalizedPatch = { ...patch };
    if (normalizedPatch.id) normalizedPatch.id = normalizedPatch.id.trim();

    setConfig((prev) => ({
      ...prev,
      rules: (prev.rules || []).map((rule) =>
        (rule.id === ruleId ? { ...rule, ...normalizedPatch } : rule)
      ),
    }));

    if (normalizedPatch.id && selectedRuleId === ruleId) setSelectedRuleId(normalizedPatch.id);
  };

  const updateRuleWhen = (ruleId, patch) => {
    setConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const nextWhen = { ...(rule.when || {}), ...patch };
        return { ...rule, when: nextWhen };
      }),
    }));
  };

  const handleAddRule = () => {
    const newRule = {
      id: `rule-${Date.now()}`,
      scope: 'route',
      target: '/info',
      action: 'deny',
      enabled: true,
      when: { isGuest: true },
    };
    setConfig((prev) => ({
      ...prev,
      rules: [newRule, ...(prev.rules || [])],
    }));
    setSelectedRuleId(newRule.id);
  };

  const handleDeleteRule = (ruleId) => {
    const ok = window.confirm(`Удалить правило "${ruleId}"?`);
    if (!ok) return;

    const normId = String(ruleId || '').trim();
    setConfig((prev) => ({
      ...prev,
      rules: (prev.rules || []).filter((rule) => String(rule.id || '').trim() !== normId),
    }));

    if (selectedRuleId === ruleId) setSelectedRuleId(null);
  };

  const handleApplyJson = () => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rules)) {
        setJsonError('JSON должен содержать поле rules (массив)');
        return;
      }
      setConfig((prev) => ({
        ...prev,
        rules: parsed.rules,
        features: parsed.features && typeof parsed.features === 'object' ? parsed.features : (prev.features || {}),
      }));
      toast.success('JSON применен');
    } catch (err) {
      setJsonError('Не удалось разобрать JSON. Проверьте синтаксис.');
    }
  };

  const updateFeature = (featureKey, patch) => {
    const key = String(featureKey || '').trim();
    if (!key) return;
    setConfig((prev) => {
      const prevFeatures = prev.features && typeof prev.features === 'object' ? prev.features : {};
      const current = prevFeatures[key] && typeof prevFeatures[key] === 'object' ? prevFeatures[key] : {};
      const next = { ...current, ...patch };
      return {
        ...prev,
        features: {
          ...prevFeatures,
          [key]: next,
        },
      };
    });
  };

  const handleResetVersion = async () => {
    const ok = window.confirm('Сбросить счетчик версий на 1? Это просто сбросит номер следующей версии.');
    if (!ok) return;
    try {
      setSyncStatus('syncing');
      const result = await updateVisibilityLive(config, true);
      setLastSavedVersion(result.version);
      setSyncStatus('saved');
      setLastSavedConfig(JSON.stringify(config));
      toast.success('Счетчик версий сброшен на 1');
    } catch (err) {
      setSyncStatus('error');
      toast.error('Не удалось сбросить версию');
    }
  };

  const handleRollback = async () => {
    const version = Number(rollbackVersion);
    if (!Number.isInteger(version)) {
      toast.warning('Введите корректную версию');
      return;
    }
    const ok = window.confirm(`Откатить на версию ${version}?`);
    if (!ok) return;
    try {
      const res = await rollbackVisibilityConfig(version);
      const published = res?.published?.config || { rules: [] };
      const configData = {
        version: res?.published?.version || version,
        rules: published.rules || [],
        features: published.features || {},
      };

      setConfig(configData);
      setLastSavedConfig(JSON.stringify(configData));
      setLastSavedVersion(configData.version);
      toast.success('Откат выполнен. Конфигурация восстановлена.');
    } catch (err) {
      toast.error('Не удалось откатить версию');
    }
  };

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6 gap-6 bg-background-light dark:bg-background-dark">
      <style>{selectStyles}</style>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Видимость / Feature flags
          </h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Управляйте тем, что видит пользователь. Все изменения применяются <span className="font-bold text-primary">мгновенно</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus === 'syncing' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Синхронизация...
            </div>
          )}
          {syncStatus === 'saved' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-[11px] font-bold">
              <span className="material-symbols-outlined text-sm">cloud_done</span>
              Все изменения сохранены (v{lastSavedVersion})
            </div>
          )}
          {syncStatus === 'error' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 text-[11px] font-bold">
              <span className="material-symbols-outlined text-sm">error_outline</span>
              Ошибка синхронизации
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <h3 className="text-sm font-bold mb-2">Информация</h3>
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark space-y-1">
              <div>Версия на сервере: <span className="font-bold text-primary">{lastSavedVersion || '—'}</span></div>
              <div>Дата: {new Date().toLocaleDateString()}</div>
              <div>Время: {new Date().toLocaleTimeString()}</div>
            </div>
            <button
              onClick={handleResetVersion}
              className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-[10px] font-bold hover:bg-primary/5 transition-colors"
            >
              Сбросить на v1
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <h3 className="text-sm font-bold mb-2">Откат версии</h3>
          <div className="flex items-center gap-2">
            <input
              value={rollbackVersion}
              onChange={(e) => setRollbackVersion(e.target.value)}
              placeholder="Например: 3"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-sm"
            />
            <button
              onClick={handleRollback}
              className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-medium"
            >
              Откатить
            </button>
          </div>
        </div>
      </div>

      {/* ===== Секция управления правилами ===== */}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-xl border border-gray-200 dark:border-white/10 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold">1. Список правил</h3>
          <div className="flex flex-col gap-2">
            <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark italic">Фильтр и поиск:</div>
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs"
            >
              <option value="all">Все типы (Global)</option>
              {RULE_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {SCOPE_LABELS[scope] || scope}
                </option>
              ))}
            </select>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по ID или Target..."
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] px-1">
            <span className="text-text-secondary-light dark:text-text-secondary-dark">Предпросмотр роли:</span>
            <select
              value={previewRole}
              onChange={(e) => setPreviewRole(e.target.value)}
              className="px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-medium"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAddRule}
            className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold"
          >
            + Добавить новое правило
          </button>

          <div className="space-y-2 max-h-[520px] overflow-y-auto mt-2">
            {filteredRules.map((rule) => {
              const matches = ruleMatchesUser(rule, previewContext);

              // Проверяем: совпадает ли ТЕКУЩЕЕ правило с тем, что ОПУБЛИКОВАНО на сервере
              const serverRuleJson = publishedRulesMap.get(rule.id);
              const currentRuleJson = JSON.stringify(rule);
              const isPublished = serverRuleJson === currentRuleJson;

              const totalVisible = resolveVisibility({
                config: normalizedConfig,
                scope: rule.scope,
                target: rule.target,
                userContext: previewContext,
              });

              return (
                <button
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl border text-xs transition-all duration-200 relative overflow-hidden ${selectedRuleId === rule.id
                    ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background-dark z-10'
                    : ''
                    } ${isPublished
                      ? 'border-primary/50 bg-primary/10 shadow-sm'
                      : 'border-yellow-500/30 bg-yellow-500/5'
                    } `}
                >
                  {/* Ярлык "Активно" */}
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-primary/20 text-[9px] text-primary font-bold rounded-bl-lg uppercase tracking-wider">
                    Активно ✅
                  </div>

                  <div className={`font-bold text-sm mb-1 ${isPublished ? 'text-primary' : 'text-yellow-700 dark:text-yellow-500'} `}>
                    {rule.id}
                  </div>

                  <div className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
                    <div>Тип: {SCOPE_LABELS[rule.scope] || rule.scope} • Тег: {rule.target}</div>
                  </div>

                  <div className={`text-[10px] mt-2 p-1.5 rounded-lg border font-bold text-center ${totalVisible
                    ? 'border-green-500/30 text-green-600 bg-green-500/5'
                    : 'border-red-500/30 text-red-600 bg-red-500/5'
                    } `}>
                    {totalVisible ? 'ПОКАЗЫВАТЬ' : 'СКРЫТЬ'}
                  </div>
                </button>
              );
            })}
            {filteredRules.length === 0 && (
              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark text-center py-4 italic">
                Правил не найдено
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-white/10 p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">2. Визуальный редактор правила</h3>
            {selectedRule && (
              <button
                onClick={() => handleDeleteRule(selectedRule.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Удалить правило
              </button>
            )}
          </div>

          {!selectedRule && (
            <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Выберите правило из списка слева.
            </div>
          )}

          {selectedRule && (
            <div key={selectedRule.id} className="grid md:grid-cols-2 gap-4 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">ID / Название правила</span>
                <input
                  defaultValue={selectedRule.id}
                  onBlur={(e) => updateRule(selectedRule.id, { id: e.target.value })}
                  placeholder="Например: Скрыть зимнее меню"
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                />
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark font-medium text-primary">
                  Это имя правила, по которому вы найдете его в списке слева. (Применится после клика в сторону)
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Scope</span>
                <select
                  value={selectedRule.scope}
                  onChange={(e) => updateRule(selectedRule.id, { scope: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                >
                  {RULE_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {scope}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  Где применяется правило: страница, пункт меню, блок или кнопка.
                </span>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Target</span>
                <input
                  value={selectedRule.target}
                  onChange={(e) => updateRule(selectedRule.id, { target: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                />
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  Конкретный идентификатор. Например: /info, footer.favorites, home.tile.wine.
                </span>
                <div className="mt-2 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5">
                  <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark mb-2">
                    Быстрый выбор по названию (можно писать, как вы это видите):
                  </div>
                  <input
                    value={targetQuickSearch}
                    onChange={(e) => {
                      const next = e.target.value;
                      setTargetQuickSearch(next);
                      const found = ALL_TARGETS.find((item) => item.label.toLowerCase() === next.trim().toLowerCase());
                      if (found) {
                        updateRule(selectedRule.id, { scope: found.scope, target: found.target });
                        setTargetGroupId(found.groupId);
                      }
                    }}
                    placeholder="Например: Нижнее меню: Информация"
                    className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs"
                  />
                  {quickMatch && (
                    <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark mt-2">
                      Подставлено: {quickMatch.label} → {quickMatch.target}
                    </div>
                  )}
                  {!quickMatch && quickSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {quickSuggestions.map((item) => (
                        <button
                          key={`${item.scope}:${item.target}: quick`}
                          type="button"
                          onClick={() => {
                            updateRule(selectedRule.id, { scope: item.scope, target: item.target });
                            setTargetGroupId(item.groupId);
                            setTargetQuickSearch(item.label);
                          }}
                          className="px-2 py-1 text-[11px] rounded-full border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark mb-1">
                    Область:
                  </div>
                  <select
                    value={targetGroupId}
                    onChange={(e) => setTargetGroupId(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs"
                  >
                    {TARGET_GROUPS.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark mt-1">
                    {activeTargetGroup?.hint}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {activeTargetGroup?.items.map((item) => (
                    <button
                      key={`${item.scope}:${item.target} `}
                      type="button"
                      onClick={() =>
                        updateRule(selectedRule.id, {
                          scope: item.scope,
                          target: item.target,
                        })
                      }
                      className="px-2 py-1 text-[11px] rounded-full border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  Нажмите на пункт — Scope и Target подставятся автоматически.
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Action</span>
                <select
                  value={selectedRule.action}
                  onChange={(e) => updateRule(selectedRule.id, { action: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                >
                  {ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  allow = показать, deny = скрыть.
                </span>
              </label>
              <div className="flex items-center justify-between mt-2 p-3 rounded-lg bg-white/40 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <div className="flex flex-col">
                  <span className="text-xs font-bold">Статус правила</span>
                  <span className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">Включено или временно не действует</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={selectedRule.enabled !== false}
                    onChange={(e) => updateRule(selectedRule.id, { enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="md:col-span-2 border-t border-gray-200 dark:border-white/10 pt-4">
                <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-2">
                  Targeting (кому применять)
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-3">
                    <div className="font-semibold text-primary mb-1">Роли и флаги:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-white/5 bg-white/30 dark:bg-white/5">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedRule.when?.everyone)}
                          onChange={(e) => updateRuleWhen(selectedRule.id, { everyone: e.target.checked })}
                        />
                        <span>Для всех</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-white/5 bg-white/30 dark:bg-white/5">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedRule.when?.isGuest)}
                          onChange={(e) => updateRuleWhen(selectedRule.id, { isGuest: e.target.checked })}
                        />
                        <span>Гость</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-white/5 bg-white/30 dark:bg-white/5">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedRule.when?.isAdmin) || (Array.isArray(selectedRule.when?.roles) && selectedRule.when.roles.includes('администратор'))}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            const currentRoles = Array.isArray(selectedRule.when?.roles) ? selectedRule.when.roles : [];
                            let nextRoles = isChecked
                              ? [...currentRoles.filter(r => r !== 'администратор'), 'администратор']
                              : currentRoles.filter(r => r !== 'администратор');

                            updateRuleWhen(selectedRule.id, {
                              isAdmin: isChecked,
                              roles: nextRoles
                            });
                          }}
                        />
                        <span className="font-bold text-primary">Админ</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-white/5 bg-white/30 dark:bg-white/5">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedRule.when?.isAuthenticated)}
                          onChange={(e) => updateRuleWhen(selectedRule.id, { isAuthenticated: e.target.checked })}
                        />
                        <span>Авторизованные</span>
                      </label>

                      {['менеджер', 'официант', 'хостес'].map(roleName => (
                        <label key={roleName} className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-white/5 bg-white/30 dark:bg-white/5">
                          <input
                            type="checkbox"
                            checked={Array.isArray(selectedRule.when?.roles) && selectedRule.when.roles.includes(roleName)}
                            onChange={(e) => {
                              const currentRoles = Array.isArray(selectedRule.when?.roles) ? selectedRule.when.roles : [];
                              const nextRoles = e.target.checked
                                ? [...currentRoles, roleName]
                                : currentRoles.filter(r => r !== roleName);
                              updateRuleWhen(selectedRule.id, { roles: nextRoles });
                            }}
                          />
                          <span className="capitalize">{roleName}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="font-semibold text-primary mb-1">Дополнительно:</div>
                    <label className="flex flex-col gap-1">
                      <span>User IDs (через запятую)</span>
                      <input
                        placeholder="Например: 1, 2, 3"
                        defaultValue={(selectedRule.when?.userIds || []).join(', ')}
                        onBlur={(e) =>
                          updateRuleWhen(selectedRule.id, {
                            userIds: e.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        className="px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                      />
                      <span className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                        Конкретные пользователи.
                      </span>
                    </label>
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedRule.when?.canWrite)}
                        onChange={(e) => updateRuleWhen(selectedRule.id, { canWrite: e.target.checked })}
                      />
                      <span>Может редактировать</span>
                    </label>
                  </div>

                  <div className="md:col-span-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px]">
                    Если ничего не выбрано, правило считается выключенным или для всех (зависит от настроек).
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-white/10 pt-4">
            <h3 className="text-sm font-bold mb-2">Резюме настроек</h3>
            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark space-y-2">
              <div>
                Роль предпросмотра: <b className="text-text-primary-light dark:text-text-primary-dark">{previewRole}</b>
              </div>
              <div>
                Всего целей: {roleSummary.total || 0}, показываем: {roleSummary.visibleCount || 0}, скрываем:{' '}
                {roleSummary.hiddenCount || 0}.
              </div>
              {selectedRule && (
                <div>
                  Выбранное правило: <span className="text-text-primary-light dark:text-text-primary-dark">{selectedRuleSummary}</span>
                </div>
              )}
              {roleSummary.lines.length > 0 && (
                <div className="grid gap-1">
                  {roleSummary.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              )}
              {roleSummary.total === 0 && <div>Пока нет правил для резюме.</div>}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-white/10 pt-4">
            <h3 className="text-sm font-bold mb-2">JSON редактор</h3>
            <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark mb-2">
              Этот режим для опытных пользователей. Формат: {"{ rules: [...] }"}.
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs font-mono"
            />
            {jsonError && <div className="text-xs text-red-500 mt-1">{jsonError}</div>}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleApplyJson}
                className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold"
              >
                Применить и Сохранить JSON
              </button>
            </div>
          </div>

          {showHistory && history.length > 0 && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">История изменений</h3>
                <button onClick={() => setShowHistory(false)} className="text-xs text-primary">Скрыть</button>
              </div>
              <div className="grid md:grid-cols-2 gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {history.slice(0, 10).map((item) => (
                  <div key={`${item.id}-${item.version}`} className="border rounded-lg p-2 bg-white/30 dark:bg-white/5">
                    <div className="flex justify-between font-bold text-text-primary">
                      <span>Версия {item.version}</span>
                      <span>{item.status}</span>
                    </div>
                    <div className="mt-1">Обновил: {item.updated_by || '—'}</div>
                    <div className="text-[10px]">{item.updated_at || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!showHistory && history.length > 0 && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-4">
              <button
                onClick={() => setShowHistory(true)}
                className="text-xs text-text-secondary-light hover:text-primary transition-colors underline"
              >
                Показать историю изменений (v{lastSavedVersion})
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ===== Фичи: "В разработке" (Перенесено вниз) ===== */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold">Дополнительно: ярлыки «В разработке»</h3>
        </div>
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_DEFINITIONS.map((feat) => {
            const current = normalizedConfig.features?.[feat.key] || {};
            const fallback = DEFAULT_FEATURE_FLAGS?.[feat.key] || {};
            const comingSoon = (current.comingSoon ?? fallback.comingSoon) === true;
            return (
              <label
                key={feat.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 cursor-pointer hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={comingSoon}
                  onChange={(e) => updateFeature(feat.key, { comingSoon: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <div className="flex-1">
                  <div className="text-xs font-semibold">{feat.label}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VisibilityPage;
