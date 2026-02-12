import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * GuestBlocker — оборачивает контент, который должен быть скрыт от гостей.
 * Если пользователь — гость, показывает плейсхолдер (skeleton) + плашку с CTA.
 * Если авторизован — показывает children как есть.
 *
 * Props:
 *   children — контент для авторизованных
 *   lines   — кол-во skeleton-линий (по умолчанию 3)
 *   message — текст плашки (можно переопределить)
 */
export default function GuestBlocker({ children, lines = 3, message }) {
    const { isGuest, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // Показываем контент, если пользователь авторизован и НЕ гость
    if (isAuthenticated && !isGuest) {
        return children;
    }

    // Плейсхолдер для гостя
    return (
        <div className="guest-blocker">
            {/* Skeleton-линии */}
            <div className="space-y-2 mb-4">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
                        style={{ width: `${70 + Math.random() * 30}%` }}
                    />
                ))}
            </div>

            {/* Баннер авторизации */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-orange-50/80 dark:bg-white/5 border border-orange-200/50 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="material-symbols-outlined text-primary text-[20px]">lock</span>
                    <span>{message || 'Данные будут доступны только после авторизации'}</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/', { state: { showLogin: true } })}
                        className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                        Войти
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * GuestActionBlocker — оборачивает интерактивный элемент (кнопку).
 * Для гостя: disabled + при клике показывает toast.
 *
 * Props:
 *   children   — содержание кнопки (текст/иконка)
 *   onClick    — действие для авторизованных
 *   className  — CSS классы
 *   toast      — ссылка на useToast() (передать из родителя)
 *   ...rest    — остальные пропсы button
 */
export function GuestActionBlocker({ children, onClick, className = '', toast, ...rest }) {
    const { isGuest, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const blocked = !isAuthenticated || isGuest;

    const handleClick = (e) => {
        if (blocked) {
            e.preventDefault();
            e.stopPropagation();
            if (toast) {
                toast.warning('Действие доступно только после входа', {
                    title: '🔒 Требуется вход',
                    action: {
                        label: 'Войти',
                        onClick: () => navigate('/', { state: { showLogin: true } })
                    }
                });
            }
            return;
        }
        if (onClick) onClick(e);
    };

    return (
        <button
            {...rest}
            onClick={handleClick}
            disabled={blocked}
            className={`${className} ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {children}
        </button>
    );
}
