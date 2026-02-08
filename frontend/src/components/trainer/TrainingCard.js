import React, { useState, useEffect } from 'react';
import CardFace from './CardFace';
import CardBack from './CardBack';

function TrainingCard({ dish, onAnswer, onBack, onExit, progress }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEntering, setIsEntering] = useState(true);

    const handleShowAnswer = () => {
        setIsFlipped(true);
    };

    const handleAnswer = (difficulty) => {
        onAnswer(difficulty);
        setIsFlipped(false);
    };

    // Анимация при смене карточки
    useEffect(() => {
        setIsEntering(true);
        setIsFlipped(false);
        const timer = setTimeout(() => setIsEntering(false), 50);
        return () => clearTimeout(timer);
    }, [dish.id]);

    return (
        <div
            className="relative flex h-screen w-full flex-col overflow-hidden max-w-md mx-auto border-x border-[#1a3329]/50 shadow-2xl bg-[#0a1812]"
            style={{
                backgroundImage: `linear-gradient(rgba(10, 24, 18, 0.4), rgba(10, 24, 18, 0.6)), url("/trainer-bg.webp")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            {/* Header */}
            <header className="sticky top-0 z-20 bg-[#0a1812] dark:bg-[#0a1812] pt-safe-top">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center rounded-full w-10 h-10 -ml-2 text-[#19e66b]/60 active:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back_ios_new</span>
                    </button>
                    <div className="flex flex-col items-center">
                        <h2 className="text-sm font-bold tracking-widest text-[#19e66b] uppercase">
                            {dish.lang === 'EN' ? 'Training' : 'Тренировка'}
                        </h2>
                        <p className="text-[10px] font-bold text-[#19e66b]/40">{progress.current} / {progress.total}</p>
                    </div>
                    <button
                        onClick={onExit}
                        className="flex items-center justify-center rounded-full w-10 h-10 -mr-2 text-[#19e66b]/60 active:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
                    </button>
                </div>
                <div className="px-0 w-full h-1.5 bg-[#1a3329]/30">
                    <div
                        className="h-full bg-[#19e66b] shadow-[0_0_15px_rgba(25,230,107,0.8)] rounded-r-full transition-all duration-500"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                </div>
            </header>

            {/* Card Content */}
            <main className="flex-1 flex flex-col px-4 pt-2 pb-4 items-center justify-start overflow-hidden">
                <div className="w-full h-full relative">
                    {/* Front Side */}
                    <div
                        className={`absolute inset-0 transition-all duration-500 ease-in-out`}
                        style={{
                            // Вхождение справа -> Центр -> Уход влево
                            transform: isFlipped ? 'translateX(-120%)' : (isEntering ? 'translateX(120%)' : 'translateX(0)'),
                            opacity: isFlipped || isEntering ? 0 : 1,
                            zIndex: isFlipped ? 0 : 1,
                            transitionProperty: isEntering && !isFlipped ? 'none' : 'all' // Мгновенный прыжок в позицию ожидания справа
                        }}
                    >
                        <CardFace
                            dish={dish}
                            onShowAnswer={handleShowAnswer}
                            progress={progress}
                        />
                    </div>

                    {/* Back Side */}
                    <div
                        className={`absolute inset-0 transition-all duration-500 ease-in-out`}
                        style={{
                            // Вхождение справа -> Центр -> Уход влево
                            transform: isFlipped ? 'translateX(0)' : (isEntering ? 'translateX(-120%)' : 'translateX(120%)'),
                            opacity: isFlipped ? 1 : 0,
                            zIndex: isFlipped ? 1 : 0,
                            transitionProperty: !isFlipped && !isEntering ? 'none' : 'all' // Мгновенный прыжок в позицию ожидания справа
                        }}
                    >
                        <CardBack
                            dish={dish}
                            onAnswer={handleAnswer}
                        />
                    </div>
                </div>
            </main>

            {/* Bottom hint */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 text-[#19e66b]/40 text-[10px] font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {isFlipped ? 'bolt' : 'swipe'}
                </span>
                {isFlipped ? 'Tap a button to continue' : 'Листайте для смены карточки'}
            </div>

        </div>
    );
}

export default TrainingCard;
