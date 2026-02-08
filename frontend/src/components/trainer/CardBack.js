import React, { useState } from 'react';
import cardBg from '../../assets/card-bg.webp';


function CardBack({ dish, onAnswer }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const isDetailed = dish.mode === 'composition' || dish.mode === 'allergens';
    const isEn = dish.lang === 'EN';

    const handlePlay = (e) => {
        if (!dish.audioUrl || isPlaying) return;
        e.stopPropagation();

        const audio = new Audio(dish.audioUrl);
        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);

        audio.play().catch(() => setIsPlaying(false));
    };

    // Данные в зависимости от языка
    const title = isEn ? dish.titleEn : dish.title;
    const description = isEn ? dish.descriptionEn : dish.description;
    const section = isEn ? dish.sectionEn : dish.section;
    const ingredients = isEn ? dish.ingredientsEn : dish.ingredients;
    const allergens = isEn ? dish.allergensEn : dish.allergens;
    const contains = isEn ? dish.containsEn : dish.contains;

    // Тексты интерфейса
    const texts = {
        hard: isEn ? 'Hard' : 'Сложно',
        normal: isEn ? 'Normal' : 'Нормально',
        easy: isEn ? 'Easy' : 'Легко',
    };

    return (
        <div
            className="w-full flex flex-col h-full max-h-[85vh] bg-[#0d1f17] rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] border border-[#1a3329]/50 relative"
            style={{
                backgroundImage: `linear-gradient(rgba(10, 24, 18, 0.7), rgba(10, 24, 18, 0.85)), url("${cardBg}")`,
                backgroundSize: '300px',

                backgroundRepeat: 'repeat'
            }}
        >
            {/* Expanded Image Overlay */}
            {isExpanded && (
                <div
                    className="absolute inset-0 z-50 bg-[#0a1812] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200"
                    onClick={() => setIsExpanded(false)}
                >
                    <div className="relative w-full aspect-square max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                        <img src={dish.image} alt={title} className="w-full h-full object-cover" />
                        <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
            )}

            {isDetailed ? (
                // LAYOUT 2: COMPOSITION / ALLERGENS (Compact Header)
                <>
                    {/* Compact Header */}
                    <div className="flex items-center gap-4 p-6 shrink-0 z-10 border-b border-white/5">
                        <div
                            className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-white/10 shadow-lg cursor-zoom-in active:scale-95 transition-transform"
                            onClick={() => setIsExpanded(true)}
                        >
                            <img alt={title} className="w-full h-full object-cover" src={dish.image} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#19e66b]/60 mb-0.5">
                                {section}
                            </span>
                            <h3
                                onClick={handlePlay}
                                className={`font-black text-sm leading-tight text-white transition-all duration-300 ${dish.audioUrl ? 'cursor-pointer active:scale-95' : ''} ${isPlaying ? 'text-[#19e66b] scale-105' : ''}`}
                            >
                                {title}
                                {dish.audioUrl && (
                                    <span className={`material-symbols-outlined ml-1.5 text-xs align-middle transition-opacity ${isPlaying ? 'opacity-100 animate-pulse' : 'opacity-40'}`}>
                                        volume_up
                                    </span>
                                )}
                            </h3>
                        </div>
                    </div>

                    {/* Main Content: Perfectly Centered */}
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10">
                        {dish.mode === 'allergens' && (
                            <div className="flex flex-col items-center gap-4">
                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Особенности и аллергены</span>
                                <div className="flex flex-wrap justify-center gap-1.5 max-w-[300px]">
                                    {allergens.map((allergen, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-[#ff9f0a] shadow-lg shadow-black/20">
                                            <span className="material-symbols-outlined text-[14px]">warning</span>
                                            {allergen}
                                        </span>
                                    ))}
                                    {dish.tags.filter(tag => tag.includes('free') || tag.includes('без')).map((tag, idx) => (
                                        <span key={`tag-${idx}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-[#19e66b] shadow-lg shadow-black/20">
                                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {dish.mode === 'composition' && (
                            <div className="flex flex-col items-center gap-2 w-full max-w-[320px]">
                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">Подробный состав</span>

                                {contains && (
                                    <div
                                        className="text-[11px] text-white/80 leading-relaxed w-full px-4 mb-4 trainer-contains-content overflow-y-auto max-h-[180px]"
                                        dangerouslySetInnerHTML={{ __html: contains }}
                                    />
                                )}

                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {ingredients.map((ingredient, idx) => (
                                        <span key={idx} className="px-3 py-1.5 rounded-xl bg-[#1a3329]/30 border border-[#1a3329]/50 text-[10px] font-medium text-white/90 shadow-sm">
                                            {ingredient}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                // LAYOUT 1: DESCRIPTION / ENGLISH (Large Image)
                <>
                    {/* Image Section - 2/3 Height */}
                    <div
                        className="w-full h-2/3 bg-cover bg-center shrink-0 cursor-zoom-in"
                        onClick={() => setIsExpanded(true)}
                        style={{
                            backgroundImage: `url(${dish.image})`,
                            maskImage: 'linear-gradient(to top, transparent 0%, black 30%)',
                            WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 30%)'
                        }}
                    />

                    {/* Content Section - centered in bottom 1/3 */}
                    <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
                        <div className="flex-1 flex flex-col items-center justify-center text-center w-full min-h-0">
                            <span className="text-[9px] font-bold text-[#19e66b]/60 uppercase tracking-[0.2em] mb-2">
                                {section}
                            </span>

                            {dish.mode === 'description' && (
                                <p className={`font-bold text-white tracking-tight leading-tight uppercase px-2 drop-shadow-md ${description.length > 300 ? 'text-[9px]' :
                                    description.length > 200 ? 'text-[10px]' :
                                        description.length > 150 ? 'text-xs' :
                                            description.length > 80 ? 'text-sm' : 'text-base'
                                    }`}>
                                    {description}
                                </p>
                            )}

                            {dish.mode === 'english' && (
                                <div className="flex flex-col items-center gap-1 w-full">
                                    <h1
                                        onClick={handlePlay}
                                        className={`font-black text-white tracking-wider uppercase drop-shadow-xl transition-all duration-300 ${dish.audioUrl ? 'cursor-pointer active:scale-95' : ''} ${isPlaying ? 'text-[#19e66b] scale-105' : ''} ${dish.titleEn.length > 90 ? 'text-xs' :
                                            dish.titleEn.length > 65 ? 'text-sm' :
                                                dish.titleEn.length > 45 ? 'text-base' :
                                                    dish.titleEn.length > 30 ? 'text-lg' :
                                                        dish.titleEn.length > 15 ? 'text-xl' : 'text-2xl'
                                            }`}
                                    >
                                        {dish.titleEn}
                                        {dish.audioUrl && (
                                            <span className={`material-symbols-outlined ml-2 align-middle transition-opacity ${isPlaying ? 'opacity-100 animate-pulse' : 'opacity-40'}`}>
                                                volume_up
                                            </span>
                                        )}
                                    </h1>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Common Footer: Difficulty Buttons */}
            <div className="p-6 pt-0 shrink-0 z-10">
                <div className="w-full grid grid-cols-3 gap-3">
                    <button onClick={() => onAnswer('hard')} className="difficulty-btn h-16 rounded-2xl bg-[#ff4d4d] flex flex-col items-center justify-center gap-1.5 text-white shadow-[0_4px_20px_rgba(255,77,77,0.4)] active:scale-95 transition-all duration-200">
                        <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>sentiment_dissatisfied</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{texts.hard}</span>
                    </button>
                    <button onClick={() => onAnswer('normal')} className="difficulty-btn h-16 rounded-2xl bg-[#ff9f0a] flex flex-col items-center justify-center gap-1.5 text-white shadow-[0_4px_20px_rgba(255,159,10,0.4)] active:scale-95 transition-all duration-200">
                        <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>sentiment_neutral</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{texts.normal}</span>
                    </button>
                    <button onClick={() => onAnswer('easy')} className="difficulty-btn h-16 rounded-2xl bg-[#19e66b] flex flex-col items-center justify-center gap-1.5 text-white shadow-[0_4px_20px_rgba(25,230,107,0.4)] active:scale-95 transition-all duration-200">
                        <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>sentiment_very_satisfied</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{texts.easy}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CardBack;
