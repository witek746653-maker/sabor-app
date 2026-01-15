import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import HelpPopover from './HelpPopover';

// Показывает пользователю/админу:
// - жив ли API (/api/health)
// - откуда загружено меню сейчас (сервер / статический файл / кэш / офлайн-гость)

const OFFLINE_GUEST_KEY = 'sabor.offlineGuest.v1';
const MENU_DB_RUNTIME_KEY = 'sabor.menuDbRuntime.v1';
const MENU_DB_CACHE_META_KEY = 'sabor.menuDbCacheMeta.v1';
const MENU_DB_CACHE_KEY = 'sabor.menuDbCache.v1';
const MENU_DB_SOURCE_STORAGE_KEY = 'sabor.menuDbSource.v1';

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function formatTime(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

function sourceLabel(source) {
  if (source === 'api') return 'сервер (API)';
  if (source === 'static') return 'файл сайта (/data/menu-database.json)';
  if (source === 'cache') return 'кэш браузера (последняя копия)';
  if (source === 'offline-guest') return 'офлайн‑гость (только просмотр)';
  return 'неизвестно';
}

export default function StatusBanner() {
  const { isAdmin } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [autoShownAt, setAutoShownAt] = useState(null);

  const [health, setHealth] = useState({
    state: 'checking', // checking | ok | degraded | down
    httpStatus: null,
    checkedAt: null,
  });

  const [runtime, setRuntime] = useState(() => {
    const r = safeJsonParse(localStorage.getItem(MENU_DB_RUNTIME_KEY) || '');
    return r || { source: null, at: null, note: null };
  });

  const [cacheMeta, setCacheMeta] = useState(() => {
    const m = safeJsonParse(localStorage.getItem(MENU_DB_CACHE_META_KEY) || '');
    return m || null;
  });

  const [menuSourceMode, setMenuSourceMode] = useState(() => {
    // Термин **режим источника**: откуда мы берём меню прямо сейчас (авто / файл / файл через бэкенд).
    try {
      return (localStorage.getItem(MENU_DB_SOURCE_STORAGE_KEY) || 'auto').toLowerCase();
    } catch {
      return 'auto';
    }
  });

  const offlineGuestEnabled = localStorage.getItem(OFFLINE_GUEST_KEY) === 'true';

  const refreshRuntime = useCallback(() => {
    const r = safeJsonParse(localStorage.getItem(MENU_DB_RUNTIME_KEY) || '');
    if (r) setRuntime(r);
    const m = safeJsonParse(localStorage.getItem(MENU_DB_CACHE_META_KEY) || '');
    setCacheMeta(m || null);
    try {
      setMenuSourceMode((localStorage.getItem(MENU_DB_SOURCE_STORAGE_KEY) || 'auto').toLowerCase());
    } catch {
      setMenuSourceMode('auto');
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setHealth((prev) => ({ ...prev, state: 'checking' }));
    try {
      const res = await fetchJsonWithTimeout('/api/health', 4000);
      const now = Date.now();
      if (res.ok) {
        setHealth({ state: 'ok', httpStatus: res.status, checkedAt: now });
        return;
      }
      // 503 = деградация (сервис жив, но меню/данные могут быть недоступны)
      if (res.status === 503) {
        setHealth({ state: 'degraded', httpStatus: res.status, checkedAt: now });
        return;
      }
      setHealth({ state: 'down', httpStatus: res.status, checkedAt: now });
    } catch {
      setHealth({ state: 'down', httpStatus: null, checkedAt: Date.now() });
    }
  }, []);

  useEffect(() => {
    // 1) первичная проверка
    checkHealth();
    refreshRuntime();

    // 2) периодические обновления (KISS: без сложных подписок)
    const t1 = setInterval(checkHealth, 20000); // раз в 20 сек
    const t2 = setInterval(refreshRuntime, 2000); // быстро обновляем источник, чтобы индикатор был честным

    // 3) обновление при изменениях localStorage (в других вкладках)
    const onStorage = (e) => {
      if (
        e.key === MENU_DB_RUNTIME_KEY ||
        e.key === MENU_DB_CACHE_META_KEY ||
        e.key === OFFLINE_GUEST_KEY
      ) {
        refreshRuntime();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(t1);
      clearInterval(t2);
      window.removeEventListener('storage', onStorage);
    };
  }, [checkHealth, refreshRuntime]);

  const effectiveSource = useMemo(() => {
    if (offlineGuestEnabled) return 'offline-guest';
    return runtime?.source || null;
  }, [offlineGuestEnabled, runtime]);

  const hasIssue = useMemo(() => {
    const src = effectiveSource;
    const sourceNotServer = src && src !== 'api';
    const apiBad = health.state === 'down' || health.state === 'degraded';
    const apiChecking = health.state === 'checking';
    // Для пользователя показываем чип, когда есть проблема или меню явно не с сервера.
    // checking для пользователя не считаем проблемой само по себе.
    return apiBad || sourceNotServer || (offlineGuestEnabled && !apiChecking);
  }, [effectiveSource, health.state, offlineGuestEnabled]);

  const shouldShow = isAdmin || hasIssue;

  const chipTone = useMemo(() => {
    if (health.state === 'down') return 'down';
    if (health.state === 'degraded') return 'degraded';
    if (effectiveSource && effectiveSource !== 'api') return 'fallback';
    if (health.state === 'checking') return 'checking';
    return 'ok';
  }, [effectiveSource, health.state]);

  const chipColors = useMemo(() => {
    // Инлайн-цвета, чтобы не зависеть от Tailwind на проде
    if (chipTone === 'down') return { bg: '#dc2626', dot: '#fecaca', text: '#ffffff' }; // red-600
    if (chipTone === 'degraded') return { bg: '#ea580c', dot: '#ffedd5', text: '#ffffff' }; // orange-600
    if (chipTone === 'fallback') return { bg: '#b45309', dot: '#fef3c7', text: '#ffffff' }; // amber-700
    if (chipTone === 'checking') return { bg: '#374151', dot: '#d1d5db', text: '#ffffff' }; // gray-700
    return { bg: '#16a34a', dot: '#bbf7d0', text: '#ffffff' }; // green-600
  }, [chipTone]);

  // "Как принято": для обычного пользователя показываем детали ВРЕМЕННО,
  // чтобы индикатор не мешал интерфейсу. Потом сворачиваем в маленькую иконку.
  useEffect(() => {
    if (!shouldShow) return;

    // Админу авто-сворачивание не делаем.
    if (isAdmin) return;

    // Если есть проблема — можно авто-показать детали 1 раз.
    if (hasIssue && !expanded) {
      setExpanded(true);
      setAutoShownAt(Date.now());
    }
  }, [expanded, hasIssue, isAdmin, shouldShow]);

  useEffect(() => {
    if (!expanded) return;
    if (isAdmin) return;

    // Если раскрыто автоматически — сворачиваем через 6 секунд.
    if (!autoShownAt) return;
    const t = setTimeout(() => {
      setExpanded(false);
      setAutoShownAt(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [autoShownAt, expanded, isAdmin]);

  const details = useMemo(() => {
    const parts = [];
    if (health.httpStatus) parts.push(`health: ${health.httpStatus}`);
    const t = formatTime(health.checkedAt);
    if (t) parts.push(`проверка: ${t}`);
    if (runtime?.at) {
      const rt = formatTime(runtime.at);
      if (rt) parts.push(`источник: ${rt}`);
    }
    if (runtime?.note) {
      parts.push(`примечание: ${runtime.note}`);
    }
    if (cacheMeta?.savedAt) {
      const ct = formatTime(cacheMeta.savedAt);
      if (ct) parts.push(`кэш сохранён: ${ct} (${cacheMeta.source || 'unknown'})`);
    }
    return parts.join(' • ');
  }, [cacheMeta, health.checkedAt, health.httpStatus, runtime?.at]);

  const apiLabel =
    health.state === 'ok'
      ? 'OK'
      : health.state === 'degraded'
      ? 'DEGRADED'
      : health.state === 'down'
      ? 'DOWN'
      : 'CHECK';

  const srcShort =
    effectiveSource === 'api'
      ? 'сервер'
      : effectiveSource === 'static'
      ? 'файл'
      : effectiveSource === 'cache'
      ? 'кэш'
      : effectiveSource === 'offline-guest'
      ? 'офлайн'
      : '—';

  // Индустриальный вариант:
  // - маленькая "иконка статуса" (почти не перекрывает UI)
  // - подробности открываются по клику (и у пользователя авто-сворачиваются)
  // Размещаем справа СНИЗУ над футером, чтобы не перекрывать элементы шапки (например, колокольчик).
  const rootStyle = {
    position: 'fixed',
    bottom: 84, // чуть выше нижнего меню (обычно ~60px + безопасный отступ)
    right: 12,
    zIndex: 2147483647,
    pointerEvents: 'none',
  };

  const iconButtonStyle = {
    pointerEvents: 'auto',
    width: 34,
    height: 34,
    borderRadius: 999,
    background: chipColors.bg,
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const iconDotStyle = {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: chipColors.dot,
    boxShadow: '0 0 0 3px rgba(0,0,0,0.12) inset',
  };

  const panelStyle = {
    pointerEvents: 'auto',
    marginBottom: 8, // раскрываемся "вверх" от иконки
    width: 360,
    maxWidth: 'calc(100vw - 24px)',
    borderRadius: 12,
    background: '#111827', // gray-900
    color: '#ffffff',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    padding: 12,
    fontSize: 12,
    lineHeight: '16px',
  };

  if (!shouldShow) return null;

  return (
    <div style={rootStyle} data-status-banner="1">
      {expanded && (
        <div style={{ ...panelStyle, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ fontWeight: 900 }}>Статус</div>
            <HelpPopover title="Справка: статус и источники меню" icon="help" size="lg">
              <div style={{ fontSize: 12, lineHeight: '16px' }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Зачем это окно</div>
                <div style={{ opacity: 0.9 }}>
                  Оно показывает 2 вещи:
                  <br />- жив ли <b>API</b> (термин API: “адрес на бэкенде”)
                  <br />- откуда прямо сейчас взято меню (сервер / файл / кэш)
                </div>

                <details>
                  <summary>Что значит “Источник меню”</summary>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    - <b>сервер (API)</b>: данные пришли с бэкенда (обычно из БД).
                    <br />- <b>файл сайта</b>: данные взяты из <code>/data/menu-database.json</code> (public).
                    <br />- <b>кэш браузера</b>: показана последняя удачная копия (на случай проблем).
                  </div>
                </details>

                <details>
                  <summary>Режим меню (локально) — что это</summary>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    Это переключатель <b>только для вашего браузера</b> (хранится в localStorage).
                    <br />
                    <br />- <b>Авто</b>: как обычно — меню берётся из API/БД.
                    <br />- <b>Файл через бэкенд</b>: быстрый предпросмотр — UI берёт меню из <code>data/menu-database.json</code> через <code>/api/menu-json</code>.
                    <br />- <b>Файл public</b>: UI берёт меню из <code>frontend/public/data/menu-database.json</code> (URL <code>/data/menu-database.json</code>).
                  </div>
                </details>

                <details>
                  <summary>Почему иногда “не видно изменений”</summary>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    Самая частая причина: вы правили файл, но режим стоял “Авто”, и UI показывал БД (или наоборот).
                    <br />
                    Ещё причина: показался кэш (в строке видно “кэш сохранён …”).
                  </div>
                </details>

                <div style={{ marginTop: 10, opacity: 0.85 }}>
                  Подсказка: ESC закрывает окно справки.
                </div>
              </div>
            </HelpPopover>
          </div>
          <div style={{ opacity: 0.95 }}>
            <div>
              <span style={{ opacity: 0.8 }}>API:</span> {health.state} {health.httpStatus ? `(${health.httpStatus})` : ''}
            </div>
            <div>
              <span style={{ opacity: 0.8 }}>Источник меню:</span> {sourceLabel(effectiveSource)}
            </div>
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              <span style={{ opacity: 0.8 }}>Коротко:</span> API: <b>{apiLabel}</b>, меню: <b>{srcShort}</b>
            </div>
            {details && <div style={{ opacity: 0.8, marginTop: 6 }}>{details}</div>}
          </div>

          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <div style={{ opacity: 0.85, fontWeight: 800, marginBottom: 6 }}>
                Режим меню (локально):{' '}
                <span style={{ opacity: 1 }}>
                  {menuSourceMode === 'backend-json'
                    ? 'файл через бэкенд'
                    : menuSourceMode === 'static'
                    ? 'файл public'
                    : 'авто'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { key: 'auto', label: 'Авто (как обычно)' },
                  { key: 'backend-json', label: 'Файл через бэкенд (быстро править)' },
                  { key: 'static', label: 'Файл public (fallback)' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                        if (opt.key === 'auto') localStorage.removeItem(MENU_DB_SOURCE_STORAGE_KEY);
                        else localStorage.setItem(MENU_DB_SOURCE_STORAGE_KEY, opt.key);
                        // Чистим кэш меню, чтобы не увидеть “старое” после переключения
                        localStorage.removeItem(MENU_DB_CACHE_KEY);
                        localStorage.removeItem(MENU_DB_CACHE_META_KEY);
                        localStorage.removeItem(MENU_DB_RUNTIME_KEY);
                      } catch {
                        // ignore
                      }
                      setMenuSourceMode(opt.key);
                      window.location.reload(); // самый простой способ применить режим
                    }}
                    style={{
                      background:
                        (menuSourceMode === opt.key || (opt.key === 'auto' && menuSourceMode === 'auto'))
                          ? 'rgba(255,255,255,0.22)'
                          : 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '6px 10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    checkHealth();
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.14)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '6px 10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Проверить
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '6px 10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    opacity: 0.9,
                  }}
                >
                  Скрыть
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Маленькая иконка-индикатор */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          role="status"
          aria-live="polite"
          style={iconButtonStyle}
          title={expanded ? 'Скрыть детали' : 'Показать детали'}
          onClick={() => {
            setExpanded((v) => !v);
            setAutoShownAt(null); // пользователь кликнул сам — не считаем авто-показом
          }}
        >
          <span style={iconDotStyle} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

