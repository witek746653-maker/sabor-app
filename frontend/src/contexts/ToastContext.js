import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Термин **toast / тост**: маленькое уведомление-плашка, которое всплывает и само исчезает.
 * Это замена для alert(), чтобы стиль был как у приложения.
 */

const ToastContext = createContext(null);

const DEFAULT_DURATION_MS = 3500;

function typeToIcon(type) {
  switch (type) {
    case 'success':
      return 'check_circle';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

function typeToAccentClasses(type) {
  switch (type) {
    case 'success':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    default:
      return 'bg-primary';
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timers = timersRef.current;
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }, []);

  const push = useCallback(
    ({ type = 'info', title, message, durationMs = DEFAULT_DURATION_MS } = {}) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast = { id, type, title, message };

      setToasts((prev) => [toast, ...prev].slice(0, 3)); // KISS: максимум 3 уведомления

      if (durationMs && durationMs > 0) {
        const timer = setTimeout(() => remove(id), durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [remove]
  );

  const api = useMemo(
    () => ({
      push,
      remove,
      info: (message, opts) => push({ type: 'info', message, ...opts }),
      success: (message, opts) => push({ type: 'success', message, ...opts }),
      warning: (message, opts) => push({ type: 'warning', message, ...opts }),
      error: (message, opts) => push({ type: 'error', message, ...opts }),
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Контейнер тостов. pointer-events-none, чтобы не блокировать клики по странице. */}
      <div className="pointer-events-none fixed top-4 right-4 z-[200] flex w-[min(92vw,420px)] flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto overflow-hidden rounded-2xl border border-orange-100/60 bg-white/95 shadow-xl backdrop-blur-sm dark:border-gray-800 dark:bg-[#181311]/95"
          >
            <div className="flex items-start gap-3 p-4">
              <div className={`mt-1 h-10 w-1 rounded-full ${typeToAccentClasses(t.type)}`} />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                      {typeToIcon(t.type)}
                    </span>
                    <p className="text-sm font-bold text-[#181311] dark:text-white">
                      {t.title || (t.type === 'error' ? 'Ошибка' : t.type === 'success' ? 'Готово' : 'Уведомление')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="rounded-full p-1 text-gray-500 hover:bg-orange-50 hover:text-[#181311] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                    aria-label="Закрыть уведомление"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                {t.message && (
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{t.message}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

