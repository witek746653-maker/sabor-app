import React from 'react';

/**
 * Компонент для отображения маленького бейджа "В разработке" / "Coming soon"
 * 
 * Использование:
 * <ComingSoonBadge language="RU" />
 * 
 * @param {string} language - Язык отображения ('RU' или 'EN')
 * @param {string} className - Дополнительные CSS классы
 */
function ComingSoonBadge({ language = 'RU', className = '' }) {
  const text = language === 'EN' ? 'Coming soon' : 'В разработке';
  
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-gray-100/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/50 ${className}`}
      title={language === 'EN' ? 'This section is under development' : 'Этот раздел находится в разработке'}
    >
      <span className="material-symbols-outlined text-[10px] opacity-70">construction</span>
      {text}
    </span>
  );
}

export default ComingSoonBadge;
