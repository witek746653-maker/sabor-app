import { useState, useCallback, useEffect } from 'react';

/**
 * Проверяет наличие данных для конкретного режима
 */
const hasDataForMode = (dish, mode) => {
    switch (mode) {
        case 'description': return !!dish.description?.trim();
        case 'allergens': return dish.allergens?.length > 0;
        case 'composition': return dish.ingredients?.length > 0 || !!dish.contains?.trim();
        case 'english': return !!dish.titleEn?.trim();
        default: return true;
    }
};

/**
 * Определяет, что пользователь забыл (для списка ошибок)
 */
const getMissedInfo = (card, lang = 'RU') => {
    if (lang === 'EN') {
        switch (card.mode) {
            case 'allergens':
                return `Forgot: ${card.allergens.slice(0, 2).join(', ')}`;
            case 'composition':
                return `Forgot: ${card.ingredients.slice(0, 2).join(', ')}`;
            case 'description':
                return 'Forgot description';
            case 'english':
                return 'Forgot English name';
            default:
                return 'Needs review';
        }
    }

    switch (card.mode) {
        case 'allergens':
            return `Забыли: ${card.allergens.slice(0, 2).join(', ')}`;
        case 'composition':
            return `Забыли: ${card.ingredients.slice(0, 2).join(', ')}`;
        case 'description':
            return 'Забыли описание';
        case 'english':
            return 'Забыли английское название';
        default:
            return 'Требует повторения';
    }
};

/**
 * Hook для управления логикой интервального повторения
 */
export const useIntervalTraining = () => {
    const [deck, setDeck] = useState(() => {
        const saved = localStorage.getItem('trainer_deck');
        return saved ? JSON.parse(saved) : [];
    });
    const [initialDeckSize, setInitialDeckSize] = useState(() => {
        const saved = localStorage.getItem('trainer_initial_size');
        return saved ? parseInt(saved) : 0;
    });
    const [currentIndex, setCurrentIndex] = useState(() => {
        const saved = localStorage.getItem('trainer_current_index');
        return saved ? parseInt(saved) : 0;
    });
    const [stats, setStats] = useState(() => {
        const saved = localStorage.getItem('trainer_stats');
        return saved ? JSON.parse(saved) : {
            easy: 0,
            normal: 0,
            hard: 0,
            startTime: null,
            endTime: null
        };
    });
    const [mistakes, setMistakes] = useState(() => {
        const saved = localStorage.getItem('trainer_mistakes');
        return saved ? JSON.parse(saved) : [];
    });

    // Сохранение состояния при изменениях
    useEffect(() => {
        localStorage.setItem('trainer_deck', JSON.stringify(deck));
        localStorage.setItem('trainer_initial_size', initialDeckSize.toString());
        localStorage.setItem('trainer_current_index', currentIndex.toString());
        localStorage.setItem('trainer_stats', JSON.stringify(stats));
        localStorage.setItem('trainer_mistakes', JSON.stringify(mistakes));
    }, [deck, initialDeckSize, currentIndex, stats, mistakes]);

    /**
     * Инициализирует колоду карточек
     */
    const initializeDeck = useCallback((dishes, count, mode, setupConfig = {}) => {
        const isEnglishMode = mode === 'english';
        const isEnglishMenuOnly = setupConfig.menus?.length === 1 && setupConfig.menus[0] === 'english';
        const sessionLang = (isEnglishMode || isEnglishMenuOnly) ? 'EN' : 'RU';

        let filteredDishes = [];
        if (mode === 'mix') {
            filteredDishes = dishes.filter(d =>
                hasDataForMode(d, 'description') ||
                hasDataForMode(d, 'allergens') ||
                hasDataForMode(d, 'composition')
            );
        } else {
            filteredDishes = dishes.filter(d => hasDataForMode(d, mode));
        }

        const shuffled = [...filteredDishes].sort(() => Math.random() - 0.5);
        const actualCount = count === 'all' ? shuffled.length : count;
        const selected = shuffled.slice(0, actualCount);

        const deckWithModes = selected.map(dish => {
            let finalMode = mode;
            if (mode === 'mix') {
                const availableModes = ['description', 'allergens', 'composition'].filter(m => hasDataForMode(dish, m));
                finalMode = availableModes[Math.floor(Math.random() * availableModes.length)];
            }

            return {
                ...dish,
                mode: finalMode,
                lang: sessionLang,
                attempts: 0,
                nextAppearance: 0
            };
        });

        setDeck(deckWithModes);
        setInitialDeckSize(deckWithModes.length);
        setCurrentIndex(0);
        setStats({
            easy: 0,
            normal: 0,
            hard: 0,
            startTime: Date.now(),
            endTime: null
        });
        setMistakes([]);
    }, []);

    /**
     * Обрабатывает ответ пользователя
     */
    const handleAnswer = useCallback((difficulty, currentCard) => {
        setStats(prev => ({
            ...prev,
            [difficulty]: prev[difficulty] + 1
        }));

        setDeck(prevDeck => {
            const newDeck = [...prevDeck];

            if (difficulty === 'easy') {
                newDeck.splice(currentIndex, 1);
            } else {
                const deckSize = newDeck.length;
                let interval;

                if (difficulty === 'normal') {
                    interval = Math.floor(Math.random() * 5) + Math.min(8, Math.floor(deckSize * 0.4));
                } else { // hard
                    interval = Math.floor(Math.random() * 4) + Math.min(5, Math.floor(deckSize * 0.25));

                    setMistakes(prev => {
                        const exists = prev.find(m => m.id === currentCard.id);
                        if (!exists) {
                            return [...prev, {
                                ...currentCard,
                                missedInfo: getMissedInfo(currentCard, currentCard.lang)
                            }];
                        }
                        return prev;
                    });
                }

                // Перемещаем карточку вглубь колоды
                const card = newDeck.splice(currentIndex, 1)[0];
                card.attempts += 1;
                const insertPosition = Math.min(currentIndex + interval, newDeck.length);
                newDeck.splice(insertPosition, 0, card);
            }

            return newDeck;
        });
    }, [currentIndex]);

    const nextCard = useCallback(() => {
        if (currentIndex < deck.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, deck.length]);

    const isSessionComplete = useCallback(() => {
        return deck.length === 0;
    }, [deck.length]);

    const finishSession = useCallback(() => {
        setStats(prev => ({
            ...prev,
            endTime: Date.now()
        }));
    }, []);

    const getSuccessRate = useCallback(() => {
        const total = stats.easy + stats.normal + stats.hard;
        if (total === 0) return 0;
        // Качество ответов: (Easy * 100 + Normal * 50) / Total
        return Math.round(((stats.easy * 100 + stats.normal * 50) / (total * 100)) * 100);
    }, [stats]);

    const getProgressPercentage = useCallback(() => {
        if (initialDeckSize === 0) return 0;
        const completed = initialDeckSize - deck.length;
        return Math.round((completed / initialDeckSize) * 100);
    }, [initialDeckSize, deck.length]);

    const getSessionTime = useCallback(() => {
        if (!stats.startTime) return '00:00';
        const endTime = stats.endTime || Date.now();
        const duration = Math.floor((endTime - stats.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, [stats]);

    const resetTraining = useCallback(() => {
        setDeck([]);
        setInitialDeckSize(0);
        setCurrentIndex(0);
        setStats({
            easy: 0,
            normal: 0,
            hard: 0,
            startTime: null,
            endTime: null
        });
        setMistakes([]);
        localStorage.removeItem('trainer_deck');
        localStorage.removeItem('trainer_initial_size');
        localStorage.removeItem('trainer_current_index');
        localStorage.removeItem('trainer_stats');
        localStorage.removeItem('trainer_mistakes');
    }, []);

    return {
        deck,
        initialDeckSize,
        currentIndex,
        stats,
        mistakes,
        initializeDeck,
        handleAnswer,
        nextCard,
        isSessionComplete,
        finishSession,
        getSuccessRate,
        getProgressPercentage,
        getSessionTime,
        resetTraining
    };
};
