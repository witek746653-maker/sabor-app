import React from 'react';

const MenuImagePlaceholder = ({ menuName, className = '' }) => {
    const menuLower = (menuName || '').toLowerCase();

    // Логика подбора иконки (KISS)
    const getIcon = () => {
        if (menuLower.includes('основн')) return 'restaurant';
        if (menuLower.includes('завтрак')) return 'bakery_dining';
        if (menuLower.includes('сезон') || menuLower.includes('зимн') || menuLower.includes('постн')) return 'eco';
        if (menuLower.includes('напит') || menuLower.includes('бар') || menuLower.includes('вино')) return 'local_bar';
        if (menuLower.includes('десерт')) return 'icecream';
        if (menuLower.includes('детск')) return 'child_care';
        if (menuLower.includes('чай')) return 'emoji_food_beverage';
        return 'restaurant_menu';
    };

    // Логика подбора градиента
    const getGradient = () => {
        if (menuLower.includes('основн')) return 'from-orange-100 to-orange-200 dark:from-orange-900/20 dark:to-orange-800/20';
        if (menuLower.includes('завтрак')) return 'from-yellow-50 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20';
        if (menuLower.includes('вино')) return 'from-red-50 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20';
        if (menuLower.includes('чай') || menuLower.includes('эко')) return 'from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20';
        return 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700';
    };

    return (
        <div className={`absolute inset-0 bg-gradient-to-br ${getGradient()} flex items-center justify-center ${className}`}>
            <span className="material-symbols-outlined text-primary/30 dark:text-white/10 text-2xl">
                {getIcon()}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        </div>
    );
};

export default MenuImagePlaceholder;
