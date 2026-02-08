import React from 'react';
import trainerBg from '../../assets/trainer-bg.webp';
import cardBg from '../../assets/card-bg.webp';


function FinishScreen({ stats, mistakes, successRate, progressPercentage, sessionTime, onRestart, onExit, lang = 'RU' }) {
    const isEn = lang === 'EN';

    const texts = {
        title: isEn ? 'Training Results' : 'Итоги повторения',
        success: isEn ? 'Accuracy' : 'Качество',
        cards: isEn ? 'Cards' : 'Карточек',
        total: isEn ? 'Total' : 'Всего',
        time: isEn ? 'Time' : 'Время',
        session: isEn ? 'Session' : 'Сессия',
        progress: isEn ? 'Progress' : 'Прогресс',
        mastered: isEn ? 'Completed' : 'Прогресс',
        resultsTitle: isEn ? 'Results by Button' : 'Результаты по кнопкам',
        easy: isEn ? 'Easy' : 'Легко',
        normal: isEn ? 'Normal' : 'Нормально',
        hard: isEn ? 'Hard' : 'Сложно',
        reviewTitle: isEn ? 'Reviewing Mistakes' : 'Работа над ошибками',
        mistakesLabel: isEn ? 'mistakes' : 'ошибки',
        newTraining: isEn ? 'New Training' : 'Новая тренировка',
        exit: isEn ? 'Exit to Tools' : 'Выход'
    };

    return (
        <div
            className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto shadow-2xl overflow-hidden bg-[#0a1812] text-white font-display"
            style={{
                backgroundImage: `
                    linear-gradient(to bottom, rgba(13, 31, 23, 0.7) 0%, rgba(13, 31, 23, 0.95) 100%),
                    linear-gradient(to bottom, transparent 67%, #0d1f17 95%),
                    url("${trainerBg}"),
                    url("${cardBg}")

                `,
                backgroundSize: 'cover, 100% 100%, 100% 80vh, 300px',
                backgroundPosition: 'center, center, top center, center',
                backgroundRepeat: 'no-repeat, no-repeat, no-repeat, repeat',
                backgroundAttachment: 'fixed, fixed, scroll, fixed'
            }}
        >
            {/* Header */}
            <header className="flex items-center justify-center p-4 pb-2 sticky top-0 bg-[#0d1f17]/80 backdrop-blur-lg z-30">
                <h2 className="text-base font-bold leading-tight tracking-tight text-center">{texts.title}</h2>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col gap-8 px-5 pt-4 pb-48">
                {/* Success Circle - Shows Progress */}
                <section className="flex flex-col items-center justify-center">
                    <div className="relative flex items-center justify-center w-52 h-52">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" fill="none" r="42" stroke="#1a3329" strokeWidth="10"></circle>
                            <circle
                                cx="50"
                                cy="50"
                                fill="none"
                                r="42"
                                stroke="#19e66b"
                                strokeDasharray="263.89"
                                strokeDashoffset={263.89 - (263.89 * progressPercentage / 100)}
                                strokeLinecap="round"
                                strokeWidth="10"
                            ></circle>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-extrabold tracking-tight text-white">{progressPercentage}%</span>
                            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{texts.progress}</span>
                        </div>
                    </div>
                </section>

                {/* Stats Grid */}
                <section className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1 rounded-2xl p-3 bg-[#1a3329]/40 border border-[#19e66b]/10 backdrop-blur-md">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{texts.cards}</span>
                        <p className="text-xl font-bold">{stats.easy + stats.normal + stats.hard}</p>
                        <span className="text-[9px] text-white/30">{texts.total}</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-2xl p-3 bg-[#1a3329]/40 border border-[#19e66b]/10 backdrop-blur-md">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{texts.time}</span>
                        <p className="text-xl font-bold">{sessionTime}</p>
                        <span className="text-[9px] text-white/30">{texts.session}</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-2xl p-3 bg-[#1a3329]/40 border border-[#19e66b]/10 backdrop-blur-md">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{texts.success}</span>
                        <p className="text-xl font-bold text-[#19e66b]">{successRate}%</p>
                        <span className="text-[9px] text-white/30">{texts.mastered}</span>
                    </div>
                </section>

                {/* Results by Button */}
                <section className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest px-1">
                        {texts.resultsTitle}
                    </h3>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1a3329]/60 border-l-4 border-[#19e66b] backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[#19e66b]">sentiment_very_satisfied</span>
                                <span className="font-medium">{texts.easy}</span>
                            </div>
                            <span className="font-bold text-lg">{stats.easy}</span>
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1a3329]/60 border-l-4 border-[#ff9f0a] backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[#ff9f0a]">sentiment_neutral</span>
                                <span className="font-medium">{texts.normal}</span>
                            </div>
                            <span className="font-bold text-lg">{stats.normal}</span>
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1a3329]/60 border-l-4 border-[#ff453a] backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[#ff453a]">sentiment_very_dissatisfied</span>
                                <span className="font-medium">{texts.hard}</span>
                            </div>
                            <span className="font-bold text-lg">{stats.hard}</span>
                        </div>
                    </div>
                </section>

                {/* Mistakes Section */}
                {mistakes.length > 0 && (
                    <section className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest px-1">
                                {texts.reviewTitle}
                            </h3>
                            <span className="text-[10px] bg-[#ff453a]/20 text-[#ff453a] px-2 py-0.5 rounded-full font-bold">
                                {mistakes.length} {texts.mistakesLabel}
                            </span>
                        </div>
                        <div className="flex flex-col gap-3">
                            {mistakes.map((mistake, idx) => (
                                <div
                                    key={idx}
                                    className="flex gap-4 p-3 rounded-2xl bg-[#1a3329]/40 border border-white/5 items-center backdrop-blur-md"
                                >
                                    <div className="h-14 w-14 shrink-0 rounded-xl bg-gray-700 overflow-hidden relative">
                                        <img alt={isEn ? mistake.titleEn : mistake.title} className="h-full w-full object-cover" src={mistake.image} />
                                    </div>
                                    <div className="flex flex-col flex-1 gap-0.5">
                                        <p className="text-sm font-bold text-white">{isEn ? mistake.titleEn : mistake.title}</p>
                                        <p className="text-[12px] text-white/50 leading-snug italic">
                                            {mistake.missedInfo}
                                        </p>
                                    </div>
                                    <span className="material-symbols-outlined text-[#ff453a]/30">chevron_right</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {/* Bottom Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-5 pb-8 bg-[#0d1f17]/90 backdrop-blur-xl border-t border-white/5 z-40 max-w-md mx-auto">
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onRestart}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary h-14 px-5 hover:bg-[#14b856] active:scale-[0.98] transition-all shadow-lg shadow-primary/10"
                    >
                        <span className="text-background-dark text-base font-bold tracking-tight">{texts.newTraining}</span>
                        <span className="material-symbols-outlined text-background-dark text-[20px]">play_arrow</span>
                    </button>
                    <button
                        onClick={onExit}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 h-14 px-5 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all"
                    >
                        <span className="text-white/70 text-base font-medium tracking-tight">{texts.exit}</span>
                        <span className="material-symbols-outlined text-white/40 text-[20px]">logout</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FinishScreen;
