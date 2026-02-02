import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import {
  getAdminVisibilityConfig,
  publishVisibilityConfig,
  rollbackVisibilityConfig,
  saveVisibilityDraft,
} from '../../services/visibilityConfig';
import { normalizeVisibilityConfig, resolveVisibility } from '../../utils/visibilityResolver';
import { DEFAULT_FEATURE_FLAGS, FEATURE_DEFINITIONS } from '../../utils/featureStatus';

const RULE_SCOPES = ['route', 'menuItem', 'menuSection', 'pageBlock', 'featureAction', 'contentItem'];
const ACTIONS = ['allow', 'deny'];
const ROLE_OPTIONS = ['guest', 'официант', 'администратор', 'хостес'];

// Стили для темных выпадающих списков (select)
const selectStyles = `
  select {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 0.7rem center;
    background-size: 1em;
    padding-right: 2.5rem !important;
  }
  select option {
    background-color: #1a1a1a;
    color: white;
    padding: 10px;
  }
  .dark select option {
    background-color: #111111;
    color: white;
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
      { scope: 'pageBlock', target: 'home.sidebar.feedback', label: 'Боковое меню: Обратная связь' },
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
    parts.push(`роли: ${when.roles.join(', ')}`);
  }
  if (Array.isArray(when.userIds) && when.userIds.length > 0) {
    parts.push(`ID пользователей: ${when.userIds.join(', ')}`);
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
  return `${actionLabel} • ${scopeLabel} • ${rule.target} • ${whenLabel} • ${enabledLabel}`;
};

const buildSummaryForRole = (rules, previewContext) => {
  const uniqueTargets = new Map();
  (rules || []).forEach((rule) => {
    if (!rule || !rule.scope || !rule.target) return;
    const key = `${rule.scope}::${rule.target}`;
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
    return `${action}: ${scopeLabel} → ${item.target}`;
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
  const [loading, setLoading] = useState(true);
  const [draftConfig, setDraftConfig] = useState({ version: 0, rules: [] });
  const [publishedConfig, setPublishedConfig] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [filterScope, setFilterScope] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [previewRole, setPreviewRole] = useState('guest');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('footer');
  const [targetQuickSearch, setTargetQuickSearch] = useState('');

  const previewContext = useMemo(() => buildPreviewContext(previewRole), [previewRole]);

  const normalizedDraft = useMemo(() => normalizeVisibilityConfig(draftConfig), [draftConfig]);
  const rules = normalizedDraft.rules;
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getAdminVisibilityConfig();
        const publishedData = data?.published?.config || null;
        const draftData = data?.draft?.config || { rules: [] };

        // Если черновик пуст, а опубликованные правила есть — берем их за основу
        const initialRules = (draftData.rules && draftData.rules.length > 0)
          ? draftData.rules
          : (publishedData?.rules || []);

        const initialFeatures = (draftData.features && Object.keys(draftData.features).length > 0)
          ? draftData.features
          : (publishedData?.features || {});

        setDraftConfig({
          version: data?.draft?.version || 0,
          rules: initialRules,
          features: initialFeatures,
        });

        setPublishedConfig(
          data?.published
            ? {
              version: data.published.version,
              rules: publishedData?.rules || [],
              features: publishedData?.features || {},
              updatedBy: data.published.updated_by,
              updatedAt: data.published.updated_at,
            }
            : null
        );
        setVersions(data?.versions || []);
        setJsonText(JSON.stringify({ rules: initialRules, features: initialFeatures }, null, 2));
      } catch (err) {
        toast.error('Не удалось загрузить конфиг видимости');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  useEffect(() => {
    setJsonText(
      JSON.stringify({ rules: normalizedDraft.rules, features: normalizedDraft.features || {} }, null, 2)
    );
  }, [normalizedDraft.rules, normalizedDraft.features]);

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
    // Если меняется ID, то "причесываем" его (убираем лишние пробелы по краям)
    const normalizedPatch = { ...patch };
    if (normalizedPatch.id) {
      normalizedPatch.id = normalizedPatch.id.trim();
    }

    setDraftConfig((prev) => ({
      ...prev,
      rules: (prev.rules || []).map((rule) =>
        (rule.id === ruleId ? { ...rule, ...normalizedPatch } : rule)
      ),
    }));

    // Синхронизируем выбор, чтобы редактор не закрылся
    if (normalizedPatch.id && selectedRuleId === ruleId) {
      setSelectedRuleId(normalizedPatch.id);
    }
  };

  const updateRuleWhen = (ruleId, patch) => {
    setDraftConfig((prev) => ({
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
    setDraftConfig((prev) => ({
      ...prev,
      rules: [newRule, ...(prev.rules || [])],
    }));
    setSelectedRuleId(newRule.id);
  };

  const handleDeleteRule = (ruleId) => {
    const ok = window.confirm(`Удалить правило "${ruleId}"?`);
    if (!ok) return;

    const normId = String(ruleId || '').trim();
    setDraftConfig((prev) => ({
      ...prev,
      rules: (prev.rules || []).filter((rule) => {
        const currentId = String(rule.id || '').trim();
        return currentId !== normId;
      }),
    }));

    if (selectedRuleId === ruleId) setSelectedRuleId(null);
    toast.success('Правило удалено из черновика');
  };

  const handleApplyJson = () => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rules)) {
        setJsonError('JSON должен содержать поле rules (массив)');
        return;
      }
      setDraftConfig((prev) => ({
        ...prev,
        rules: parsed.rules,
        features: parsed.features && typeof parsed.features === 'object' ? parsed.features : (prev.features || {}),
      }));
    } catch (err) {
      setJsonError('Не удалось разобрать JSON. Проверьте синтаксис.');
    }
  };

  const updateFeature = (featureKey, patch) => {
    const key = String(featureKey || '').trim();
    if (!key) return;
    setDraftConfig((prev) => {
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

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await saveVisibilityDraft({
        rules: normalizedDraft.rules,
        features: normalizedDraft.features || {},
      });
      const draft = res?.draft?.config || { rules: [] };
      setDraftConfig({
        version: res?.draft?.version || normalizedDraft.version || 0,
        rules: draft.rules || [],
        features: draft.features || {},
      });
      toast.success('Черновик сохранён');
    } catch (err) {
      toast.error('Не удалось сохранить черновик');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (normalizedDraft.rules.length === 0) {
      const confirmEmpty = window.confirm('Внимание! Список правил пуст. Если вы опубликуете, ВСЕ ограничения будут сняты. Продолжить?');
      if (!confirmEmpty) return;
    } else {
      const ok = window.confirm('Опубликовать текущий черновик?');
      if (!ok) return;
    }
    setPublishing(true);
    try {
      const res = await publishVisibilityConfig(normalizedDraft.version);
      const published = res?.published?.config || { rules: [] };
      setPublishedConfig({
        version: res?.published?.version || normalizedDraft.version,
        rules: published.rules || [],
        updatedBy: res?.published?.updated_by,
        updatedAt: res?.published?.updated_at,
      });
      toast.success('Конфиг опубликован');
    } catch (err) {
      toast.error('Не удалось опубликовать конфиг');
    } finally {
      setPublishing(false);
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
        updatedBy: res?.published?.updated_by,
        updatedAt: res?.published?.updated_at,
      };
      setPublishedConfig(configData);
      // КРИТИЧНО: Синхронизируем черновик, чтобы правила появились в редакторе
      setDraftConfig({
        version: configData.version,
        rules: configData.rules,
        features: configData.features,
      });
      toast.success('Откат выполнен. Правила восстановлены в редакторе.');
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
            Управляйте тем, что видит пользователь, без изменения кода.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <div>Опубликовано: {publishedConfig?.version || 'нет'}</div>
          <div>Черновик: {normalizedDraft?.version || 'нет'}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <h3 className="text-sm font-bold mb-2">Состояние</h3>
          <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark space-y-1">
            <div>Опубликованная версия: {publishedConfig?.version || '—'}</div>
            <div>Обновил: {publishedConfig?.updatedBy || '—'}</div>
            <div>Дата: {publishedConfig?.updatedAt || '—'}</div>
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

      {/* ===== Фичи: "В разработке" ===== */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
        <h3 className="text-sm font-bold mb-2">Фичи: ярлык «В разработке»</h3>
        <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark mb-3">
          Здесь можно включать/выключать бейдж «В разработке» и отдельно разрешать доступ к таким разделам.
        </div>
        <div className="grid gap-2">
          {FEATURE_DEFINITIONS.map((feat) => {
            const current = normalizedDraft.features?.[feat.key] || {};
            const fallback = DEFAULT_FEATURE_FLAGS?.[feat.key] || {};
            const comingSoon = (current.comingSoon ?? fallback.comingSoon) === true;
            const allowAccess = (current.allowAccess ?? fallback.allowAccess) === true;
            return (
              <div
                key={feat.key}
                className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold">{feat.label}</div>
                  <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    key: <span className="font-mono">{feat.key}</span>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={comingSoon}
                    onChange={(e) => {
                      const nextComing = e.target.checked;
                      updateFeature(feat.key, {
                        comingSoon: nextComing,
                        // если выключили "в разработке" — снимаем и allowAccess (KISS, чтобы не было сюрпризов)
                        allowAccess: nextComing ? allowAccess : false,
                      });
                    }}
                  />
                  <span>В разработке</span>
                </label>
                <label className={`flex items-center gap-2 text-xs ${!comingSoon ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={allowAccess}
                    disabled={!comingSoon}
                    onChange={(e) => updateFeature(feat.key, { allowAccess: e.target.checked })}
                  />
                  <span>Разрешить доступ</span>
                </label>
              </div>
            );
          })}
          {FEATURE_DEFINITIONS.length === 0 && (
            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Список фич пуст.
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-xl border border-gray-200 dark:border-white/10 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value)}
              className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs"
            >
              <option value="all">Все типы</option>
              {RULE_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по id/target"
              className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs"
            />
          </div>
          <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
            Фильтр помогает быстро найти нужное правило по типу и названию.
          </div>
          <button
            onClick={handleAddRule}
            className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold"
          >
            + Добавить правило
          </button>
          <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Предпросмотр роли:
            <select
              value={previewRole}
              onChange={(e) => setPreviewRole(e.target.value)}
              className="ml-2 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
            Здесь вы можете увидеть, как правило сработает для выбранной роли.
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {filteredRules.map((rule) => {
              const visible = resolveVisibility({
                config: normalizedDraft,
                scope: rule.scope,
                target: rule.target,
                userContext: previewContext,
              });
              return (
                <button
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${selectedRuleId === rule.id
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                >
                  <div className="font-bold text-sm text-primary mb-1">{rule.id}</div>
                  <div className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                    Тип: {SCOPE_LABELS[rule.scope] || rule.scope} • Цель: {rule.target}
                  </div>
                  <div className={`text-[10px] mt-1 font-semibold ${visible ? 'text-green-600' : 'text-red-600'}`}>
                    Результат: {visible ? 'Показывать' : 'Скрывать'}
                  </div>
                </button>
              );
            })}
            {filteredRules.length === 0 && (
              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Правил нет
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-white/10 p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Визуальный редактор</h3>
            {selectedRule && (
              <button
                onClick={() => handleDeleteRule(selectedRule.id)}
                className="text-xs text-red-600"
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
                          key={`${item.scope}:${item.target}:quick`}
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
                      key={`${item.scope}:${item.target}`}
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
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={selectedRule.enabled !== false}
                  onChange={(e) => updateRule(selectedRule.id, { enabled: e.target.checked })}
                />
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Включено</span>
              </label>

              <div className="md:col-span-2 border-t border-gray-200 dark:border-white/10 pt-4">
                <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-2">
                  Targeting (кому применять)
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-xs">
                  <label className="flex flex-col gap-1">
                    <span>Роли (через запятую)</span>
                    <input
                      placeholder="Например: guest, официант"
                      defaultValue={(selectedRule.when?.roles || []).join(', ')}
                      onBlur={(e) =>
                        updateRuleWhen(selectedRule.id, {
                          roles: e.target.value
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                      className="px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                    />
                    <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                      Ограничить по ролям (например: guest, официант). Применится после клика в сторону.
                    </span>
                  </label>
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
                    <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                      Точное ограничение по конкретным пользователям (сохранится после клика в сторону).
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedRule.when?.isGuest)}
                      onChange={(e) => updateRuleWhen(selectedRule.id, { isGuest: e.target.checked })}
                    />
                    <span>Только гость</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedRule.when?.isAdmin)}
                      onChange={(e) => updateRuleWhen(selectedRule.id, { isAdmin: e.target.checked })}
                    />
                    <span>Только админ</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedRule.when?.canWrite)}
                      onChange={(e) => updateRuleWhen(selectedRule.id, { canWrite: e.target.checked })}
                    />
                    <span>Может писать</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedRule.when?.isAuthenticated)}
                      onChange={(e) => updateRuleWhen(selectedRule.id, { isAuthenticated: e.target.checked })}
                    />
                    <span>Только авторизованные</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedRule.when?.everyone)}
                      onChange={(e) => updateRuleWhen(selectedRule.id, { everyone: e.target.checked })}
                    />
                    <span>Для всех</span>
                  </label>
                  <div className="md:col-span-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    Если ничего не выбрано, правило действует для всех.
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
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-medium"
              >
                Применить JSON
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить черновик'}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                {publishing ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>

          {versions.length > 0 && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-4">
              <h3 className="text-sm font-bold mb-2">История версий</h3>
              <div className="grid md:grid-cols-2 gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {versions.map((item) => (
                  <div key={`${item.id}-${item.version}`} className="border rounded-lg p-2">
                    <div>Версия: {item.version}</div>
                    <div>Статус: {item.status}</div>
                    <div>Обновил: {item.updated_by || '—'}</div>
                    <div>Дата: {item.updated_at || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VisibilityPage;
