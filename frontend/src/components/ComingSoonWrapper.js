import React, { useState } from 'react';
import ComingSoonBadge from './ComingSoonBadge';

/**
 * Обертка для элементов, которые находятся в разработке
 * 
 * Использование:
 * <ComingSoonWrapper isComingSoon={true} language="RU">
 *   <button onClick={...}>Режим работы</button>
 * </ComingSoonWrapper>
 * 
 * @param {boolean} isComingSoon - Статус "в разработке"
 * @param {string} language - Язык отображения ('RU' или 'EN')
 * @param {React.ReactNode} children - Дочерние элементы для обертки
 * @param {string} className - Дополнительные CSS классы для обертки
 * @param {string} badgePosition - Позиция бейджа: 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'inline'
 */
function ComingSoonWrapper({ 
  isComingSoon = false, 
  language = 'RU',
  children, 
  className = '',
  badgePosition = 'top-right'
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Если функция не в разработке, просто возвращаем детей без обертки
  if (!isComingSoon) {
    return children;
  }

  // Текст подсказки
  const tooltipText = language === 'EN' 
    ? 'This section is under development' 
    : 'Этот раздел находится в разработке';

  // Позиции для бейджа
  const badgePositions = {
    'top-right': 'top-1 right-1',
    'top-left': 'top-1 left-1',
    'bottom-right': 'bottom-1 right-1',
    'bottom-left': 'bottom-1 left-1',
    'inline': 'relative inline-flex items-center gap-2'
  };

  const badgeClasses = badgePositions[badgePosition] || badgePositions['top-right'];

  // Обработчик клика - перехватываем, если элемент в разработке
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowTooltip(true);
    // Скрываем подсказку через 2 секунды
    setTimeout(() => setShowTooltip(false), 2000);
  };

  // Обработчик наведения
  const handleMouseEnter = () => {
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  // Клонируем children и добавляем обработчики и disabled, если это интерактивный элемент
  const wrappedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) {
      return child;
    }

    // Определяем, является ли элемент интерактивным (button, Link, a)
    const isInteractive = 
      child.type === 'button' || 
      child.props?.onClick !== undefined ||
      (child.type?.displayName === 'Link' || child.type?.name === 'Link');

    // Для inline позиции и кнопок - добавляем бейдж внутрь кнопки
    if (badgePosition === 'inline' && isInteractive && isComingSoon) {
      return React.cloneElement(child, {
        ...child.props,
        onClick: handleClick,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        disabled: true,
        className: `${child.props?.className || ''} relative flex items-center justify-between opacity-75 cursor-not-allowed`.trim(),
        style: {
          ...child.props?.style,
          pointerEvents: 'none'
        },
        'aria-disabled': 'true',
        children: (
          <>
            <div className="flex items-center gap-3 flex-1">{child.props?.children}</div>
            <ComingSoonBadge language={language} className="flex-shrink-0" />
          </>
        )
      });
    }

    // Для остальных случаев - стандартная обработка
    return React.cloneElement(child, {
      ...child.props,
      onClick: isComingSoon ? handleClick : child.props?.onClick,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      disabled: isComingSoon && isInteractive ? true : child.props?.disabled,
      className: `${child.props?.className || ''} ${isComingSoon ? 'relative opacity-75 cursor-not-allowed' : ''}`.trim(),
      style: {
        ...child.props?.style,
        pointerEvents: isComingSoon && isInteractive ? 'none' : child.props?.style?.pointerEvents
      },
      'aria-disabled': isComingSoon ? 'true' : child.props?.['aria-disabled']
    });
  });

  return (
    <div className={`relative ${className}`}>
      {badgePosition === 'inline' ? (
        // Для inline - бейдж уже добавлен внутрь элемента при клонировании
        wrappedChildren
      ) : (
        // Для абсолютной позиции
        <>
          {wrappedChildren}
          <div className={`absolute ${badgeClasses} z-10`}>
            <ComingSoonBadge language={language} />
          </div>
        </>
      )}
      
      {/* Подсказка при наведении/клике */}
      {showTooltip && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none"
          style={{ 
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default ComingSoonWrapper;
