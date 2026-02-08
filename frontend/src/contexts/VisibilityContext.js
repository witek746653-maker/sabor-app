import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getVisibilityConfig } from '../services/visibilityConfig';
import { DEFAULT_VISIBILITY_CONFIG, normalizeVisibilityConfig, resolveVisibility } from '../utils/visibilityResolver';
import { useAuth } from './AuthContext';
import { DEFAULT_FEATURE_FLAGS } from '../utils/featureStatus';

const VisibilityContext = createContext(null);
const VISIBILITY_STORAGE_KEY = 'sabor.visibilityConfig.v1';

const safeReadCache = () => {
  try {
    const raw = sessionStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeVisibilityConfig(parsed);
  } catch {
    return null;
  }
};

const safeWriteCache = (config) => {
  try {
    sessionStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Кэш — это удобство, а не критичная часть.
  }
};

export const VisibilityProvider = ({ children }) => {
  const [config, setConfig] = useState(() => safeReadCache() || DEFAULT_VISIBILITY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    const loadConfig = async () => {
      try {
        // Добавляем timestamp, чтобы браузер не брал конфиг из своего сетевого кэша
        const timestamp = Date.now();
        const data = await getVisibilityConfig(timestamp);
        const normalized = normalizeVisibilityConfig(data);
        if (!alive) return;
        setConfig(normalized);
        safeWriteCache(normalized);
        setError(null);
      } catch (err) {
        if (!alive) return;
        // Fail-open: если не загрузилось — не скрываем ничего критичного
        const cached = safeReadCache();
        setConfig(cached || DEFAULT_VISIBILITY_CONFIG);
        setError(err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadConfig();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      config,
      loading,
      error,
    }),
    [config, loading, error]
  );

  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>;
};

export const useVisibility = () => {
  const context = useContext(VisibilityContext);
  if (!context) {
    throw new Error('useVisibility must be used inside VisibilityProvider');
  }

  const { isAuthenticated, currentUser, isGuest, isAdmin, canWrite } = useAuth();

  const userContext = useMemo(
    () => ({
      userId: currentUser?.id ?? null,
      role: currentUser?.role ?? null,
      isAuthenticated,
      isGuest,
      isAdmin,
      canWrite,
    }),
    [currentUser, isAuthenticated, isGuest, isAdmin, canWrite]
  );

  const isVisible = React.useCallback(
    ({ scope, target, userContext: overrideContext } = {}) => {
      const effectiveContext = overrideContext || userContext;
      return resolveVisibility({
        config: context.config,
        scope,
        target,
        userContext: effectiveContext,
      });
    },
    [context.config, userContext]
  );

  // ===== Feature flags: "В разработке" =====
  const getFeature = React.useCallback(
    (featureKey) => {
      const key = String(featureKey || '').trim();
      if (!key) return { comingSoon: false, allowAccess: true };

      const fromConfig = context.config?.features?.[key];
      const fallback = DEFAULT_FEATURE_FLAGS?.[key];
      return {
        comingSoon: (fromConfig?.comingSoon ?? fallback?.comingSoon) === true,
        allowAccess: (fromConfig?.allowAccess ?? fallback?.allowAccess) === true,
      };
    },
    [context.config]
  );

  const isFeatureComingSoon = React.useCallback(
    (featureKey) => getFeature(featureKey).comingSoon,
    [getFeature]
  );

  const isFeatureAccessAllowed = React.useCallback(
    (featureKey) => getFeature(featureKey).allowAccess,
    [getFeature]
  );

  return {
    ...context,
    isVisible,
    getFeature,
    isFeatureComingSoon,
    isFeatureAccessAllowed,
  };
};

