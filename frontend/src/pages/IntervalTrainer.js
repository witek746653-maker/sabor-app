import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntervalTraining } from '../hooks/useIntervalTraining';
import { loadSelectedMenus, filterByCategory } from '../utils/menuDataLoader';
import SetupScreen from '../components/trainer/SetupScreen';
import TrainingCard from '../components/trainer/TrainingCard';
import FinishScreen from '../components/trainer/FinishScreen';
import trainerBg from '../assets/trainer-bg.webp';
import cardBg from '../assets/card-bg.webp';
import { useAuth } from '../contexts/AuthContext';
import GuestBlocker from '../components/GuestBlocker';


function IntervalTrainer() {
    const navigate = useNavigate();
    const { isGuest } = useAuth();

    if (isGuest) {
        return (
            <div className="min-h-screen aurora-bg p-8 flex flex-col items-center justify-center">
                <div className="w-full max-w-sm bg-white/10 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-2xl">
                    <GuestBlocker lines={5} message="Тренажер доступен только после авторизации" />
                    <button
                        onClick={() => navigate('/tools')}
                        className="w-full mt-6 py-4 rounded-2xl bg-white/5 text-white/60 font-bold border border-white/10 active:scale-95 transition-all text-xs uppercase tracking-widest"
                    >
                        Назад к инструментам
                    </button>
                </div>
            </div>
        );
    }

    const [screen, setScreen] = useState(() => {
        const saved = localStorage.getItem('trainer_screen');
        return (saved === 'loading' || !saved) ? 'setup' : saved;
    });
    const [sessionLang, setSessionLang] = useState(() => {
        return localStorage.getItem('trainer_session_lang') || 'RU';
    });
    const [lastConfig, setLastConfig] = useState(() => {
        const saved = localStorage.getItem('trainer_last_config');
        return saved ? JSON.parse(saved) : null;
    });
    const [modalType, setModalType] = useState(null); // save_settings | training_pause

    const {
        deck,
        initialDeckSize,
        currentIndex,
        stats,
        mistakes,
        initializeDeck,
        handleAnswer,
        isSessionComplete,
        finishSession,
        getSuccessRate,
        getProgressPercentage,
        getSessionTime,
        resetTraining
    } = useIntervalTraining();

    // Сохранение базового состояния страницы
    useEffect(() => {
        localStorage.setItem('trainer_screen', screen);
        localStorage.setItem('trainer_session_lang', sessionLang);
    }, [screen, sessionLang]);

    // Проверка завершения сессии (только если она реально началась)
    useEffect(() => {
        if (screen === 'training' && stats.startTime && isSessionComplete()) {
            finishSession();
            setScreen('finish');
        }
    }, [screen, isSessionComplete, finishSession, stats.startTime]);

    const handleStart = async (setupConfig) => {
        resetTraining(); // Очищаем старый прогресс перед новым стартом
        setScreen('loading');
        setLastConfig(setupConfig);

        const allDishes = await loadSelectedMenus(setupConfig.menus);
        let filtered = filterByCategory(allDishes, setupConfig.category);

        // Умная фильтрация по режимам
        if (setupConfig.mode === 'characteristics') {
            // В режиме характеристик показываем только вино
            filtered = filtered.filter(d => d.menu === 'Вино' || d.menu === 'Винная карта');
        } else if (setupConfig.mode === 'composition') {
            // В режиме состава пропускаем вино (у него нет ингредиентов)
            filtered = filtered.filter(d => d.menu !== 'Вино' && d.menu !== 'Винная карта');
        }

        const isEnglishMode = setupConfig.mode === 'english';
        const isEnglishMenuOnly = setupConfig.menus?.length === 1 && setupConfig.menus[0] === 'english';
        const lang = (isEnglishMode || isEnglishMenuOnly) ? 'EN' : 'RU';
        setSessionLang(lang);

        initializeDeck(filtered, setupConfig.count, setupConfig.mode, setupConfig);
        setScreen('training');
    };

    const handleCardAnswer = (difficulty) => {
        handleAnswer(difficulty, deck[currentIndex]);
    };

    const handleRestart = () => {
        resetTraining();
        setScreen('setup');
    };

    const handlePauseTraining = () => {
        setModalType('training_pause');
    };

    const handleExitToToolsRequest = () => {
        setModalType('save_settings');
    };

    const confirmSaveSettings = (shouldSave) => {
        setModalType(null);
        if (shouldSave) {
            localStorage.setItem('trainer_last_config', JSON.stringify(lastConfig));
        } else {
            localStorage.removeItem('trainer_last_config');
            setLastConfig(null);
        }
        // Очищаем временное состояние при полном выходе
        resetTraining();
        localStorage.removeItem('trainer_screen');
        localStorage.removeItem('trainer_session_lang');
        navigate('/tools');
    };

    const confirmViewProgress = () => {
        setModalType(null);
        finishSession();
        setScreen('finish');
    };

    const currentCard = screen === 'training' ? deck[currentIndex] : null;

    return (
        <>
            {screen === 'setup' && (
                <SetupScreen
                    onStart={handleStart}
                    onBack={handleExitToToolsRequest}
                    initialConfig={lastConfig}
                />
            )}

            {screen === 'loading' && (
                <div className="flex justify-center items-center h-screen text-xl text-[#19e66b]">
                    Загрузка...
                </div>
            )}

            {screen === 'training' && currentCard && (
                <TrainingCard
                    dish={currentCard}
                    onAnswer={handleCardAnswer}
                    onBack={handleRestart}
                    onExit={handlePauseTraining}
                    progress={{
                        current: initialDeckSize - deck.length + 1,
                        total: initialDeckSize
                    }}
                />
            )}

            {screen === 'finish' && (
                <FinishScreen
                    stats={stats}
                    mistakes={mistakes}
                    successRate={getSuccessRate()}
                    progressPercentage={getProgressPercentage()}
                    sessionTime={getSessionTime()}
                    onRestart={handleRestart}
                    onExit={handleExitToToolsRequest}
                    lang={sessionLang}
                />
            )}

            {/* Универсальная модалка выходов */}
            {modalType && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md"
                    style={{
                        backgroundImage: `linear-gradient(rgba(10, 24, 18, 0.45), rgba(10, 24, 18, 0.95)), url("${trainerBg}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    <div
                        className="w-full max-w-xs border border-[#19e66b]/30 rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in duration-300 relative overflow-hidden"
                        style={{
                            backgroundImage: `linear-gradient(rgba(10, 24, 18, 0.7), rgba(10, 24, 18, 0.85)), url("${cardBg}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    >
                        <div className="relative z-10">
                            <div className="flex justify-center mb-5">
                                <span className="material-symbols-outlined text-[#19e66b] text-6xl">
                                    {modalType === 'save_settings' ? 'settings_backup_restore' : 'analytics'}
                                </span>
                            </div>

                            <h3 className="text-xl font-black text-white text-center mb-2 tracking-tight uppercase">
                                {modalType === 'save_settings'
                                    ? (sessionLang === 'EN' ? 'Save Settings?' : 'Запомнить выбор?')
                                    : (sessionLang === 'EN' ? 'Exit Training?' : 'Выйти?')
                                }
                            </h3>

                            <p className="text-[13px] text-white/50 text-center mb-8 leading-relaxed">
                                {modalType === 'save_settings'
                                    ? (sessionLang === 'EN' ? 'Keep these filters for your next training session?' : 'Оставить текущие фильтры меню и категорий для следующего раза?')
                                    : (sessionLang === 'EN' ? 'Would you like to see your progress or continue training?' : 'Хотите посмотреть текущий прогресс или продолжить обучение?')
                                }
                            </p>

                            <div className="flex flex-col gap-3">
                                {modalType === 'save_settings' ? (
                                    <>
                                        <button
                                            onClick={() => confirmSaveSettings(true)}
                                            className="w-full h-14 bg-[#ff6b35] text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg shadow-[#ff6b35]/20 text-xs tracking-widest uppercase"
                                        >
                                            {sessionLang === 'EN' ? 'Save & Exit' : 'Запомнить и выйти'}
                                        </button>
                                        <button
                                            onClick={() => confirmSaveSettings(false)}
                                            className="w-full h-14 bg-white/5 text-white/80 font-bold rounded-2xl active:scale-95 transition-all border border-white/10 text-xs tracking-widest uppercase"
                                        >
                                            {sessionLang === 'EN' ? 'Forget & Exit' : 'Забыть и выйти'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={confirmViewProgress}
                                            className="w-full h-14 bg-[#ff6b35] text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg shadow-[#ff6b35]/20 text-xs tracking-widest uppercase"
                                        >
                                            {sessionLang === 'EN' ? 'View Progress' : 'Посмотреть прогресс'}
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={() => setModalType(null)}
                                    className="w-full h-12 text-white/40 font-bold hover:text-white transition-colors text-[11px] uppercase tracking-widest mt-2"
                                >
                                    {sessionLang === 'EN' ? 'Return to Training' : 'Вернуться к обучению'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default IntervalTrainer;
