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
      className={styles.edgeTabButton}
      style={{ right: safeRight ? `${safeRight}px` : 0 }}
    >
      <div className={styles.edgeTabVisual} />
    </button>
  );
}
