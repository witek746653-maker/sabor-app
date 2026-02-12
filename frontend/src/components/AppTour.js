import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

/**
 * **AppTour** - продвинутый компонент онбординга
 * 
 * Фичи:
 * - Spotlight-подсветка реальных элементов
 * - Интерактивные кнопки внутри тура
 * - Красивые градиентные иконки с анимацией
 * - Свайпы и прогресс-бар
 * 
 * ПРИМЕЧАНИЕ: Lottie-анимации требуют дополнительной загрузки файлов,
 * поэтому пока используем Material Icons с улучшенной анимацией
 */
function AppTour({ isOpen, onClose, onThemeToggle, onToggleLoginModal }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [highlightedElement, setHighlightedElement] = useState(null);

    // Шаги тура с информацией о spotlight
    const tourSteps = [
        {
            title: '👋 Добро пожаловать!',
            description: 'Это приложение для сотрудников ресторана Sabor de la Vida. Давай покажу, как с ним работать!',
            icon: 'celebration',
            gradient: 'from-orange-400 to-pink-500',
            mode: 'modal',
            iconAnimation: 'animate-bounce'
        },
        {
            title: '🔐 Вход и Регистрация',
            description: 'Войди используя логин и пароль для полного доступа. Или используй Гостевой режим для быстрого старта без регистрации, однако учти, некоторые функции в нем будут недоступны.',
            icon: 'login',
            gradient: 'from-blue-600 to-indigo-600',
            mode: 'modal',
            iconAnimation: 'animate-pulse'
        },
        {
            title: ' Главная страница',
            description: 'Здесь все разделы. Жми на плашку — откроется нужная категория.',
            icon: 'restaurant_menu',
            gradient: 'from-orange-500 to-red-500',
            mode: 'modal',
            iconAnimation: 'animate-pulse'
        },
        {
            title: '🔍 Нижняя панель',
            description: 'Навигация по сервисам: Меню, Избранное, Поиск, Информация. Если потерялся - смотри сюда.',
            icon: 'touch_app',
            gradient: 'from-blue-500 to-cyan-500',
            mode: 'spotlight',
            spotlightSelector: 'footer',
            iconAnimation: 'animate-ping'
        },
        {
            title: '❤️ Избранное',
            description: 'Нажимай сердечко — позиция улетит в Избранное и останется в твоём сердечке.',
            icon: 'favorite',
            gradient: 'from-red-500 to-rose-500',
            mode: 'spotlight',
            spotlightSelector: '[data-tour="footer-favorites"]',
            iconAnimation: 'animate-heartbeat'
        },
        {
            title: '🔎 Умный поиск',
            description: 'Ищи по названию, ингредиентам или категории. Работает по всем разделам сразу. Он ищет быстрее, чем ты думаешь.',
            icon: 'search',
            gradient: 'from-sky-500 to-blue-600',
            mode: 'spotlight',
            spotlightSelector: '[data-tour="footer-search"]',
            iconAnimation: 'animate-spin-slow'
        },
        {
            title: '📚 Информация',
            description: 'Важные материалы в одном месте: Медиа-обучение, База и Справочник официанта, Искусство в ресторане, Комплекс для сотрудников и многое другое.',
            icon: 'menu_book',
            gradient: 'from-teal-500 to-green-500',
            mode: 'spotlight',
            spotlightSelector: '[data-tour="footer-info"]',
            iconAnimation: 'animate-float'
        },
        {
            title: '🔔 Уведомления',
            description: 'Нажми на колокольчик, чтобы увидеть новости: акции, новые блюда и обновления.',
            icon: 'notifications',
            gradient: 'from-purple-500 to-indigo-500',
            mode: 'spotlight',
            spotlightSelector: 'button[aria-label="notifications"]',
            iconAnimation: 'animate-wiggle'
        },
        {
            title: '☰ Сэндвич-меню',
            description: 'Открой боковое меню для доступа к дополнительным функциям: тур по приложению, смена темы, выход из системы и многое другое.',
            icon: 'menu',
            gradient: 'from-indigo-500 to-purple-600',
            mode: 'modal',
            iconAnimation: 'animate-pulse'
        },
        {
            title: ' Связь с администратором',
            description: 'Видишь красный "язычок" справа? Это быстрый способ связаться с админом. Используй его для вопросов, предложений или если что-то сломалось.',
            icon: 'feedback',
            gradient: 'from-orange-500 to-red-600',
            mode: 'spotlight',
            spotlightSelector: '[data-tour="feedback-tab"]',
            iconAnimation: 'animate-pulse'
        },
        {
            title: '📡 Связь с сервером',
            description: 'Если связь пропадет — появится красный банер. Не пугайся! Можно на него нажать и проверить статус соединения. При восстановлении сети банер исчезнет автоматически.',
            icon: 'wifi_off',
            gradient: 'from-rose-500 to-red-600',
            mode: 'spotlight',
            spotlightSelector: '[data-tour="status-banner"]',
            onEnter: () => window.dispatchEvent(new CustomEvent('sabor-tour-wifi-state', { detail: true })),
            onLeave: () => window.dispatchEvent(new CustomEvent('sabor-tour-wifi-state', { detail: false })),
            iconAnimation: 'animate-pulse'
        },
        {
            title: '🍽️ Детали блюд',
            description: 'Нажми на блюдо для детальной информации: состав, аллергены, фото, можешь даже язык выбрать.',
            icon: 'info',
            gradient: 'from-amber-500 to-yellow-500',
            mode: 'modal',
            iconAnimation: 'animate-pulse'
        },
        {
            title: '🌙 Тёмная тема',
            description: 'Переключайся между светлой и тёмной темой. Попробуй прямо сейчас!',
            icon: 'dark_mode',
            gradient: 'from-slate-700 to-gray-900',
            mode: 'modal',
            interactive: true,
            actionButton: {
                text: '💡 Переключить тему',
                action: 'toggleTheme'
            },
            iconAnimation: 'animate-rotate'
        },
        {
            title: '📲 Добавь на экран Домой',
            description: 'Установи Sabor как полноценное приложение! iPhone: кнопка "Поделиться" → "На экран Домой". Android: 3 точки → "Установить на гл. экран".',
            icon: 'install_mobile',
            gradient: 'from-indigo-400 to-cyan-500',
            mode: 'modal',
            iconAnimation: 'animate-bounce'
        },
        {
            title: '🎉 Готово!',
            description: 'Ты освоил все возможности! Тур можно повторить, кнопку найдешь в сэндвич-меню слева → "Тур по приложению". До встречи!',
            icon: 'check_circle',
            gradient: 'from-green-600 to-emerald-600',
            mode: 'modal',
            iconAnimation: 'animate-scale-up'
        }
    ];

    // Анимация появления
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setIsVisible(true), 50);
        } else {
            setIsVisible(false);
            setHighlightedElement(null);
        }
    }, [isOpen]);

    // Обработка жизненного цикла шагов (onEnter, onLeave) и Spotlight
    useEffect(() => {
        if (!isOpen) return;

        const step = tourSteps[currentStep];

        // 1. Вызываем onEnter для текущего шага
        if (step.onEnter) {
            step.onEnter();
        }

        // 2. Настройка Spotlight
        let spotlightTimeout;
        if (step.mode === 'spotlight' && step.spotlightSelector) {
            // Небольшая задержка, чтобы элемент успел появиться (если его показывает onEnter)
            spotlightTimeout = setTimeout(() => {
                const element = document.querySelector(step.spotlightSelector);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    setHighlightedElement(rect);
                    // Прокрутка к элементу, если нужно
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        } else {
            setHighlightedElement(null);
        }

        // 3. Cleanup: вызываем onLeave при уходе с шага
        return () => {
            if (spotlightTimeout) clearTimeout(spotlightTimeout);
            if (step.onLeave) {
                step.onLeave();
            }
        };
    }, [currentStep, isOpen]);

    // **Функция вибрации** (Haptic Feedback)
    const triggerVibration = (pattern = 50) => {
        // Проверяем поддержку Vibration API
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    // **Функция конфетти** (на финальном шаге)
    const triggerConfetti = () => {
        const count = 200;
        const defaults = {
            origin: { y: 0.7 }
        };

        function fire(particleRatio, opts) {
            confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio),
                spread: 120,
                startVelocity: 55,
            });
        }

        // Три волны конфетти с разными цветами
        fire(0.25, { spread: 26, startVelocity: 55, colors: ['#ED742C', '#FF6B9D', '#FFC300'] });
        fire(0.2, { spread: 60, colors: ['#4ECDC4', '#44A08D', '#10B981'] });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#A855F7', '#EC4899', '#F59E0B'] });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    };

    // Эффект при достижении последнего шага
    useEffect(() => {
        if (currentStep === tourSteps.length - 1 && isVisible) {
            // Запускаем конфетти через небольшую задержку
            setTimeout(() => {
                triggerConfetti();
                triggerVibration([100, 50, 100]); // Двойная вибрация
            }, 300);
        }
    }, [currentStep, isVisible]);

    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > minSwipeDistance) handleNext();
        if (distance < -minSwipeDistance) handlePrevious();
    };

    const handleNext = () => {
        if (currentStep < tourSteps.length - 1) {
            triggerVibration(50); // Лёгкая вибрация при переходе
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            triggerVibration(30); // Более слабая вибрация при возврате
            setCurrentStep(currentStep - 1);
        }
    };

    const handleClose = () => {
        // Если закрываем на последнем шаге, запускаем конфетти
        if (currentStep === tourSteps.length - 1) {
            triggerConfetti();
            triggerVibration([200, 100, 200]); // Тройная вибрация на финише
        }

        localStorage.setItem('sabor.tourCompleted', 'true');
        setIsVisible(false);
        setTimeout(() => {
            setCurrentStep(0);
            onClose();
        }, 300);
    };

    // Обработка интерактивных действий
    const handleAction = (action) => {
        if (action === 'toggleTheme' && onThemeToggle) {
            triggerVibration(50); // Вибрация при переключении темы
            onThemeToggle();
        }
    };

    if (!isOpen) return null;

    const currentTourStep = tourSteps[currentStep];
    const isSpotlightMode = currentTourStep.mode === 'spotlight';

    // Determing modal position based on highlighted element
    const getModalPositionClass = () => {
        if (!isSpotlightMode || !highlightedElement) return 'inset-0 items-center';

        const screenHeight = window.innerHeight;
        const spaceAbove = highlightedElement.top;
        const spaceBelow = screenHeight - (highlightedElement.top + highlightedElement.height);

        // If there is more space above (and reasonable amount), show at top
        // But if space below is also very large (top of screen element), show at bottom
        if (spaceAbove > spaceBelow && spaceAbove > 200) {
            return 'top-4 left-0 right-0 items-start pt-12 safe-top-padding';
        }

        // Default to bottom if space permits, or if space below is larger
        return 'bottom-4 left-0 right-0 items-end pb-12 safe-bottom-padding';
    };

    return (
        <>
            {/* Затемнённый фон с вырезом для spotlight */}
            <div
                className={`fixed inset-0 z-[20002] transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'
                    }`}
                onClick={handleClose}
            >
                {isSpotlightMode && highlightedElement ? (
                    // SVG маска для spotlight эффекта
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <defs>
                            <mask id="spotlight-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                <rect
                                    x={highlightedElement.left - 8}
                                    y={highlightedElement.top - 8}
                                    width={highlightedElement.width + 16}
                                    height={highlightedElement.height + 16}
                                    rx="12"
                                    fill="black"
                                />
                            </mask>
                        </defs>
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="rgba(0, 0, 0, 0.7)"
                            mask="url(#spotlight-mask)"
                        />
                    </svg>
                ) : (
                    // Обычный backdrop
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                )}

                {/* Подсветка границы для spotlight */}
                {isSpotlightMode && highlightedElement && (
                    <div
                        className="absolute border-4 border-primary rounded-xl pointer-events-none"
                        style={{
                            left: highlightedElement.left - 8,
                            top: highlightedElement.top - 8,
                            width: highlightedElement.width + 16,
                            height: highlightedElement.height + 16,
                            boxShadow: '0 0 40px rgba(237, 116, 44, 0.8)',
                            animation: 'pulse-glow 2s ease-in-out infinite'
                        }}
                    />
                )}
            </div>

            {/* Модальное окно */}
            <div
                className={`fixed z-[20003] flex justify-center p-4 transition-all duration-500 ${getModalPositionClass()}`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div
                    className={`relative max-w-md w-full overflow-hidden transition-all duration-500 transform ${isVisible
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-95 translate-y-8'
                        }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Градиентный фон */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${currentTourStep.gradient} opacity-30 blur-3xl animate-pulse`} />

                    {/* Glassmorphism плашка */}
                    <div className="relative bg-white/90 dark:bg-[#181311]/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 dark:border-white/10">
                        {/* Прогресс-бар */}
                        <div className="h-1.5 bg-gray-200/50 dark:bg-gray-800/50 rounded-t-3xl overflow-hidden">
                            <div
                                className={`h-full bg-gradient-to-r ${currentTourStep.gradient} transition-all duration-500 ease-out shadow-lg`}
                                style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                            />
                        </div>

                        {/* Содержимое */}
                        <div className="p-8 text-center">
                            {/* Иконка с анимацией */}
                            <div className="mb-6">
                                <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br ${currentTourStep.gradient} shadow-2xl ${currentTourStep.iconAnimation}`}
                                    style={{
                                        boxShadow: `0 20px 60px -15px rgba(0, 0, 0, 0.4), 0 0 40px rgba(237, 116, 44, 0.3)`
                                    }}
                                >
                                    <span className="material-symbols-outlined text-white text-7xl drop-shadow-2xl">
                                        {currentTourStep.icon}
                                    </span>
                                </div>
                            </div>

                            {/* Заголовок */}
                            <h2 className="text-2xl font-bold text-[#181311] dark:text-white mb-4 leading-tight">
                                {currentTourStep.title}
                            </h2>

                            {/* Описание */}
                            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-6 px-2">
                                {currentTourStep.description}
                            </p>

                            {/* Интерактивная кнопка */}
                            {currentTourStep.interactive && currentTourStep.actionButton && (
                                <button
                                    onClick={() => handleAction(currentTourStep.actionButton.action)}
                                    className={`mb-6 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r ${currentTourStep.gradient} text-white font-bold text-lg hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 shadow-xl animate-pulse-slow`}
                                >
                                    {currentTourStep.actionButton.text}
                                </button>
                            )}

                            {/* Индикатор шагов */}
                            <div className="flex items-center justify-center gap-2 mb-6">
                                {tourSteps.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            triggerVibration(40);
                                            setCurrentStep(index);
                                        }}
                                        className={`h-2.5 rounded-full transition-all duration-300 ${index === currentStep
                                            ? `w-10 bg-gradient-to-r ${currentTourStep.gradient} shadow-md`
                                            : 'w-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                                            }`}
                                        aria-label={`Перейти к шагу ${index + 1}`}
                                    />
                                ))}
                            </div>

                            {/* Кнопки навигации */}
                            <div className="flex items-center justify-between gap-3">
                                {currentStep > 0 ? (
                                    <button
                                        onClick={handlePrevious}
                                        className="flex-1 py-3.5 px-5 rounded-2xl border-2 border-gray-300/60 dark:border-gray-600/60 backdrop-blur-sm bg-white/40 dark:bg-gray-800/40 text-gray-700 dark:text-gray-200 font-semibold hover:bg-white/60 dark:hover:bg-gray-800/60 hover:border-gray-400 dark:hover:border-gray-500 active:scale-95 transition-all duration-200 shadow-md"
                                    >
                                        ← Назад
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 py-3.5 px-5 rounded-2xl border-2 border-gray-300/60 dark:border-gray-600/60 backdrop-blur-sm bg-white/40 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 font-semibold hover:bg-white/60 dark:hover:bg-gray-800/60 active:scale-95 transition-all duration-200 shadow-md"
                                    >
                                        Пропустить
                                    </button>
                                )}

                                {currentStep < tourSteps.length - 1 ? (
                                    <button
                                        onClick={handleNext}
                                        className={`flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r ${currentTourStep.gradient} text-white font-semibold hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg`}
                                    >
                                        Далее →
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg"
                                    >
                                        ✓ Готово
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Кнопка закрытия */}
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800/80 hover:scale-110 active:scale-95 transition-all duration-200 shadow-md"
                            aria-label="Закрыть"
                        >
                            <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* CSS анимации */}
            <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 40px rgba(237, 116, 44, 0.8);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 60px rgba(237, 116, 44, 1);
            transform: scale(1.02);
          }
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }

        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          10%, 30% { transform: scale(0.9); }
          20%, 40% { transform: scale(1.1); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes rotate {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
        }

        @keyframes scale-up {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .animate-wiggle {
          animation: wiggle 1s ease-in-out infinite;
        }

        .animate-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }

        .animate-rotate {
          animation: rotate 3s ease-in-out infinite;
        }

        .animate-scale-up {
          animation: scale-up 1s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
        </>
    );
}

export default AppTour;
