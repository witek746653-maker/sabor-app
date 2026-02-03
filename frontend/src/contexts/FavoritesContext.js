import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getFavorites, replaceFavorites, updateFavorite } from '../services/api';

const FavoritesContext = createContext(null);

const FAVORITES_KEYS = {
  catalog: 'favoriteDishes',
  artLegacy: 'art-favorites',
  media: 'media.favorites',
  articles: 'article-favorites'
};

const readArray = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const unique = (list) => {
  const out = [];
  const seen = new Set();
  (list || []).forEach((v) => {
    const id = String(v || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
};

const mergePreserve = (primary, secondary) => {
  const out = [];
  const seen = new Set();
  (primary || []).forEach((id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  (secondary || []).forEach((id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
};

const readLocalCatalog = () => {
  const base = readArray(FAVORITES_KEYS.catalog);
  const legacyArt = readArray(FAVORITES_KEYS.artLegacy);
  return unique([...base, ...legacyArt]);
};

const writeLocal = (key, list) => {
  try {
    localStorage.setItem(key, JSON.stringify(unique(list)));
  } catch {
    // ignore localStorage errors
  }
};

export const FavoritesProvider = ({ children }) => {
  const { isAuthenticated, isGuest } = useAuth();
  const canSync = isAuthenticated && !isGuest;

  const [catalogIds, setCatalogIds] = useState(() => readLocalCatalog());
  const [mediaIds, setMediaIds] = useState(() => readArray(FAVORITES_KEYS.media));
  const [articleIds, setArticleIds] = useState(() => readArray(FAVORITES_KEYS.articles));
  const [syncing, setSyncing] = useState(false);

  const syncFromServer = useCallback(async () => {
    setSyncing(true);
    try {
      const server = await getFavorites();
      const serverCatalog = Array.isArray(server?.catalog) ? server.catalog : [];
      const serverMedia = Array.isArray(server?.media) ? server.media : [];
      const serverArticles = Array.isArray(server?.articles) ? server.articles : [];

      const nextCatalog = mergePreserve(serverCatalog, readLocalCatalog());
      const nextMedia = mergePreserve(serverMedia, readArray(FAVORITES_KEYS.media));
      const nextArticles = mergePreserve(serverArticles, readArray(FAVORITES_KEYS.articles));

      const needsReplace =
        nextCatalog.length !== serverCatalog.length ||
        nextMedia.length !== serverMedia.length ||
        nextArticles.length !== serverArticles.length;

      if (needsReplace) {
        await replaceFavorites({
          catalog: nextCatalog,
          media: nextMedia,
          articles: nextArticles
        });
      }

      setCatalogIds(nextCatalog);
      setMediaIds(nextMedia);
      setArticleIds(nextArticles);
    } catch (error) {
      console.warn('Не удалось синхронизировать избранное:', error);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!canSync) return;
    syncFromServer();
  }, [canSync, syncFromServer]);

  useEffect(() => {
    writeLocal(FAVORITES_KEYS.catalog, catalogIds);
  }, [catalogIds]);

  useEffect(() => {
    writeLocal(FAVORITES_KEYS.media, mediaIds);
  }, [mediaIds]);

  useEffect(() => {
    writeLocal(FAVORITES_KEYS.articles, articleIds);
  }, [articleIds]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (!e.key || e.key === FAVORITES_KEYS.catalog || e.key === FAVORITES_KEYS.artLegacy) {
        setCatalogIds(readLocalCatalog());
      }
      if (!e.key || e.key === FAVORITES_KEYS.media) {
        setMediaIds(readArray(FAVORITES_KEYS.media));
      }
      if (!e.key || e.key === FAVORITES_KEYS.articles) {
        setArticleIds(readArray(FAVORITES_KEYS.articles));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleWithServer = useCallback(async (type, id, setState, currentList) => {
    const normId = String(id || '').trim();
    if (!normId) return;
    const exists = currentList.includes(normId);
    const next = exists ? currentList.filter((x) => x !== normId) : [...currentList, normId];
    setState(next);

    if (!canSync) return;
    try {
      await updateFavorite(type, normId, 'toggle');
    } catch (error) {
      console.warn('Не удалось обновить избранное на сервере:', error);
      setState(currentList);
    }
  }, [canSync]);

  const toggleCatalogFavorite = useCallback(
    async (id) => toggleWithServer('catalog', id, setCatalogIds, catalogIds),
    [catalogIds, toggleWithServer]
  );
  const toggleMediaFavorite = useCallback(
    async (id) => toggleWithServer('media', id, setMediaIds, mediaIds),
    [mediaIds, toggleWithServer]
  );
  const toggleArticleFavorite = useCallback(
    async (id) => toggleWithServer('article', id, setArticleIds, articleIds),
    [articleIds, toggleWithServer]
  );

  const value = useMemo(
    () => ({
      catalogIds,
      mediaIds,
      articleIds,
      syncing,
      toggleCatalogFavorite,
      toggleMediaFavorite,
      toggleArticleFavorite,
      refreshFavorites: syncFromServer
    }),
    [
      catalogIds,
      mediaIds,
      articleIds,
      syncing,
      toggleCatalogFavorite,
      toggleMediaFavorite,
      toggleArticleFavorite,
      syncFromServer
    ]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
};
