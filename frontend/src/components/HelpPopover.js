import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * HelpPopover — маленькая "справка по месту" (иконка ? → всплывающее окно).
 *
 * Термин **popover**: небольшое окно, которое появляется рядом с кнопкой.
 * Термин **modal**: окно, которое блокирует фон. Здесь гибрид: окно как popover, но с лёгким затемнением,
 * чтобы клик снаружи был понятным способом закрыть подсказку.
 */
export default function HelpPopover({
  title = 'Справка',
  children,
  icon = 'help',
  size = 'md', // sm | md | lg
  className = '',
  buttonClassName = '',
  zIndex = 2147483647, // чтобы не прятаться под любыми панелями (важно для StatusBanner)
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  // Термин **dark mode**: тёмная тема. В проекте она обычно включается классом `dark` на <html>.
  const [isDark, setIsDark] = useState(() => {
    try {
      return document?.documentElement?.classList?.contains('dark') || false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Следим за сменой темы без перезагрузки страницы
    try {
      const root = document.documentElement;
      const obs = new MutationObserver(() => {
        setIsDark(root.classList.contains('dark'));
      });
      obs.observe(root, { attributes: true, attributeFilter: ['class'] });
      return () => obs.disconnect();
    } catch {
      return undefined;
    }
  }, []);

  const maxWidth = useMemo(() => {
    if (size === 'sm') return 320;
    if (size === 'lg') return 520;
    return 420;
  }, [size]);

  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'bottom' });

  // Закрытие по ESC (как принято)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Позиционирование рядом с иконкой (похоже на то, как делают библиотеки)
  useLayoutEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;

    const padding = 12;
    const gap = 8;

    const rect = btn.getBoundingClientRect();

    // Сначала ставим “снизу справа”, потом корректируем по экрану
    const panelRect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const idealLeft = rect.left;
    let left = Math.min(Math.max(padding, idealLeft), vw - panelRect.width - padding);

    // Пробуем снизу
    let top = rect.bottom + gap;
    let placement = 'bottom';
    if (top + panelRect.height + padding > vh) {
      // Иначе сверху
      top = rect.top - gap - panelRect.height;
      placement = 'top';
    }
    top = Math.min(Math.max(padding, top), vh - panelRect.height - padding);

    setPos({ top, left, placement });
  }, [open, maxWidth]);

  const buttonStyle = {
    pointerEvents: 'auto',
  };

  const theme = useMemo(() => {
    // Под стиль приложения: светлая — белая карточка, тёмная — #181311 (как в модалках HomePage)
    if (isDark) {
      return {
        overlayBg: 'rgba(0,0,0,0.60)',
        panelBg: '#181311',
        text: '#ffffff',
        muted: 'rgba(255,255,255,0.78)',
        border: 'rgba(255,255,255,0.12)',
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: 'rgba(255,255,255,0.12)',
        iconBg: 'rgba(255,255,255,0.08)',
        iconBorder: 'rgba(255,255,255,0.14)',
        iconColor: 'rgba(255,255,255,0.90)',
      };
    }
    return {
      overlayBg: 'rgba(0,0,0,0.45)',
      panelBg: '#ffffff',
      text: '#181311',
      muted: 'rgba(24,19,17,0.72)',
      border: 'rgba(24,19,17,0.12)',
      cardBg: 'rgba(24,19,17,0.04)',
      cardBorder: 'rgba(24,19,17,0.10)',
      iconBg: 'rgba(24,19,17,0.05)',
      iconBorder: 'rgba(24,19,17,0.10)',
      iconColor: 'rgba(24,19,17,0.80)',
    };
  }, [isDark]);

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: theme.overlayBg,
    backdropFilter: 'blur(6px)',
    zIndex,
  };

  const panelStyle = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    width: `min(${maxWidth}px, calc(100vw - 24px))`,
    maxHeight: 'min(70vh, 560px)',
    overflow: 'auto',
    borderRadius: 12,
    background: theme.panelBg,
    color: theme.text,
    boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
    border: `1px solid ${theme.border}`,
    zIndex: zIndex + 1,
  };

  const headerStyle = {
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  };

  const bodyStyle = {
    padding: 12,
    fontSize: 13,
    lineHeight: '18px',
  };

  const iconBtnStyle = {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.iconBg,
    border: `1px solid ${theme.iconBorder}`,
    cursor: 'pointer',
    userSelect: 'none',
  };

  const closeBtnStyle = {
    width: 28,
    height: 28,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: `1px solid ${theme.iconBorder}`,
    cursor: 'pointer',
    userSelect: 'none',
    opacity: 0.95,
  };

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Справка"
        title="Справка"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={buttonClassName}
        style={buttonStyle}
      >
        <span
          className="material-symbols-outlined"
          style={{ ...iconBtnStyle, color: theme.iconColor }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </button>

      {open && (
        <>
          <div
            style={overlayStyle}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={title}
            style={panelStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={headerStyle}>
              <div style={{ fontWeight: 900 }}>{title}</div>
              <button
                type="button"
                aria-label="Закрыть"
                title="Закрыть"
                style={closeBtnStyle}
                onClick={() => setOpen(false)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <div style={bodyStyle}>
              {/* Поддерживаем "много текста" через details/summary */}
              <style>{`
                [data-help-popover] details {
                  border: 1px solid ${theme.cardBorder};
                  border-radius: 10px;
                  padding: 8px 10px;
                  background: ${theme.cardBg};
                  margin-top: 8px;
                }
                [data-help-popover] summary {
                  cursor: pointer;
                  font-weight: 800;
                  outline: none;
                  user-select: none;
                }
                [data-help-popover] summary::-webkit-details-marker { display: none; }
                [data-help-popover] summary:after {
                  content: '▾';
                  float: right;
                  opacity: 0.8;
                }
                [data-help-popover] details[open] summary:after { content: '▴'; }
                [data-help-popover] code {
                  padding: 2px 6px;
                  border-radius: 8px;
                  border: 1px solid ${theme.cardBorder};
                  background: ${theme.cardBg};
                }
              `}</style>
              <div data-help-popover="1">{children}</div>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

