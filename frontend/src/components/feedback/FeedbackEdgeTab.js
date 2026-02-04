import React from 'react';
import styles from './FeedbackWidget.module.css';

/**
 * @param {{onOpen: () => void, visible: boolean, safeRight: number}} props
 */
export default function FeedbackEdgeTab({ onOpen, visible, safeRight }) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Сообщить о проблеме"
      data-tour="feedback-tab"
      className={styles.edgeTabButton}
      style={{ right: safeRight ? `${safeRight}px` : undefined }}
    >
      <div className={styles.edgeTabVisual}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    </button>
  );
}
