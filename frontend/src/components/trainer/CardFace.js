import React from 'react';
import { generateQuestion } from '../../utils/menuDataLoader';

function CardFace({ dish, onShowAnswer, progress }) {
    const question = generateQuestion(dish, dish.mode, dish.lang);
    const firstThreeWords = dish.title.split(' ').slice(0, 3).join(' ');
    const isEn = dish.lang === 'EN';

    return (
        <div
            className="w-full flex flex-col h-full max-h-[85vh] bg-[#0d1f17] rounded-[2rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] border border-[#1a3329]/50 overflow-hidden transform transition-transform"
            style={{
                backgroundImage: `linear-gradient(rgba(10, 24, 18, 0.7), rgba(10, 24, 18, 0.85)), url("/card-bg.webp")`,
                backgroundSize: '300px',
                backgroundRepeat: 'repeat'
            }}
        >
            {/* Image Section */}
            <div
                className="w-full h-2/3 bg-cover bg-center"
                style={{
                    backgroundImage: `url(${dish.image})`,
                    maskImage: 'linear-gradient(to top, transparent 0%, black 30%)',
                    WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 30%)'
                }}
            />

            {/* Content Section */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                <h1 className="text-2xl font-bold text-center tracking-tight text-white px-2">
                    {question}
                </h1>

                {dish.mode === 'description' && (
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
