import React, { useEffect, useRef } from 'react';
import styles from './FeedbackWidget.module.css';

/**
 * @param {{
 *  open: boolean,
 *  onClose: () => void,
 *  children: React.ReactNode,
 *  safeBottom: number
 * }} props
 */
export default function FeedbackSheet({ open, onClose, children, safeBottom }) {
  const sheetRef = useRef(null);
  const closeBtnRef = useRef(null);
  const dragStateRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    if (closeBtnRef.current) closeBtnRef.current.focus();
    return () => {
      if (prev && prev.focus) prev.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const focusable = sheetRef.current?.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handlePointerDown = (e) => {
    dragStateRef.current = { startY: e.clientY, startX: e.clientX };
  };

  const handlePointerMove = (e) => {
    if (!dragStateRef.current) return;
    const deltaY = e.clientY - dragStateRef.current.startY;
    const deltaX = e.clientX - dragStateRef.current.startX;
    if (deltaY > 80 || deltaX > 80) {
      dragStateRef.current = null;
      onClose();
    }
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  if (!open) return null;

  return (
    <>
      <div className={`${styles.overlay} ${styles.overlayOpen}`} onClick={onClose} />
      <div
        className={`${styles.sheet} ${styles.sheetOpen}`}
        style={{ paddingBottom: safeBottom ? `${safeBottom}px` : undefined }}
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Сообщить о проблеме"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={styles.sheetHeader}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div>
            <div className={styles.dragHandle} />
            <div className={styles.sheetTitle}>Сообщить о проблеме</div>
          </div>
          <button
            ref={closeBtnRef}
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
