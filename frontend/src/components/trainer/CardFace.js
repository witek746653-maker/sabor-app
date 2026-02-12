import React, { useEffect } from 'react';
import { generateQuestion } from '../../utils/menuDataLoader';
import cardBg from '../../assets/card-bg.webp';


function CardFace({ dish, onShowAnswer, progress }) {
    const [showHint, setShowHint] = React.useState(false);
    const question = generateQuestion(dish, dish.mode, dish.lang);
    const firstThreeWords = dish.title?.split(' ').slice(0, 3).join(' ');
    const isEn = dish.lang === 'EN';

    // Автовоспроизведение аудио при открытии
    useEffect(() => {
        if (dish.audioFront) {
            const audio = new Audio(dish.audioFront);
            audio.play().catch(e => console.warn("Autoplay blocked:", e));
        }
        setShowHint(false); // Сбрасываем подсказку при смене карточки
    }, [dish.id, dish.audioFront]);

    return (
        <div
            className="w-full flex flex-col h-full max-h-[85vh] bg-[#0d1f17] rounded-[2rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] border border-[#1a3329]/50 overflow-hidden transform transition-transform"
            style={{
                backgroundImage: `linear-gradient(rgba(10, 24, 18, 0.7), rgba(10, 24, 18, 0.85)), url("${cardBg}")`,
                backgroundSize: '300px',
                backgroundRepeat: 'repeat'
            }}
        >
            {/* Image Section */}
            {(dish.image || dish.imageFront) ? (
                <div
                    className={`w-full h-2/3 bg-center ${dish.menu === 'Винная карта' ||
                        dish.menu === 'Вино' ||
                        dish.section?.includes('Пиво')
                        ? 'bg-contain bg-no-repeat' : 'bg-cover'
                        }`}
                    style={{
                        backgroundImage: `url(${dish.imageFront || dish.image})`,
                        maskImage: 'linear-gradient(to top, transparent 0%, black 30%)',
                        WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 30%)'
                    }}
                />
            ) : (
                <div className="w-full h-1/3 flex items-center justify-center bg-[#1a3329]/10">
                    <span className="material-symbols-outlined text-[#19e66b]/10 text-8xl">quiz</span>
                </div>
            )}

            {/* Content Section */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 relative">
                {dish.mode !== 'qa' && (
                    <p className="text-[10px] font-bold text-[#19e66b]/40 uppercase tracking-[0.2em]">{question}</p>
                )}
                <h1 className={`${dish.mode === 'qa' ? 'text-xl' : 'text-2xl'} font-bold text-center tracking-tight text-white px-2`}>
                    {dish.mode === 'qa' ? dish.title : question}
                </h1>

                {/* Hint Logic */}
                {dish.hint && (
                    <div className="flex flex-col items-center gap-2">
                        {!showHint ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowHint(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-white/30 text-[10px] font-bold uppercase tracking-widest border border-white/10 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">lightbulb</span>
                                Подсказка
                            </button>
                        ) : (
                            <div
                                className="px-4 py-2 rounded-2xl bg-[#19e66b]/10 border border-[#19e66b]/20 text-[#19e66b] text-xs font-medium text-center animate-in fade-in zoom-in duration-300 trainer-qa-content"
                                dangerouslySetInnerHTML={{ __html: dish.hint }}
                            />
                        )}
                    </div>
                )}

                {dish.mode === 'description' && firstThreeWords && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a3329]/30 text-[#19e66b]/80 text-sm font-medium border border-[#1a3329]/50">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lightbulb</span>
                        {firstThreeWords}...
                    </div>
                )}
            </div>

            {/* Button Section */}
            <div className="p-6 pt-0">
                <button
                    onClick={onShowAnswer}
                    className="w-full bg-[#ff6b35] hover:bg-[#ff8555] text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-[#ff6b35]/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    {isEn ? 'Show answer' : 'Показать ответ'}
                </button>
            </div>
        </div>
    );
}

export default CardFace;
