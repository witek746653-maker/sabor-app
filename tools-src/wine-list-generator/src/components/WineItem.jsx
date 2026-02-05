import React from 'react';
import Counter from './Counter';

export default function WineItem({ wine, onEdit, onDelete, onUpdate }) {
    const typeColors = {
        red: { bg: 'bg-red-500', text: 'Red' },
        white: { bg: 'bg-yellow-200', text: 'White' },
        rose: { bg: 'bg-pink-400', text: 'Rose' },
        sparkling: { bg: 'bg-blue-300', text: 'Sparkling' }
    };

    const typeInfo = typeColors[wine.type] || typeColors.red;

    return (
        <div className="group relative bg-surface-dark rounded-2xl p-5 border border-border-dark/50 hover:border-primary/50 transition-all shadow-sm hover:shadow-lg hover:shadow-primary/5">
            <div className="absolute right-4 top-4 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={() => onEdit(wine)}
                    className="p-2 rounded-lg text-white/50 hover:text-primary hover:bg-white/5 transition-colors"
                    title="Редактировать"
                >
                    <span className="material-symbols-outlined text-xl">edit</span>
                </button>
                <button
                    onClick={() => onDelete(wine.id)}
                    className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Удалить"
                >
                    <span className="material-symbols-outlined text-xl">delete</span>
                </button>
            </div>

            <div className="flex flex-col gap-3 h-full justify-between">
                <div className="pr-16">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-chip-bg px-2.5 py-1 text-xs font-medium text-pink-200 mb-2 border border-border-dark">
                        <span className={`size-1.5 rounded-full ${typeInfo.bg}`}></span>
                        {typeInfo.text}
                    </span>
                    <h3 className="text-xl font-bold text-white leading-tight">{wine.name}</h3>

                    <div className="flex flex-col gap-1.5 mt-3">
                        <div className="flex items-center gap-2 text-white/70">
                            <span className="material-symbols-outlined text-lg text-primary">public</span>
                            <span className="text-sm">{wine.country}</span>
                        </div>
                        {wine.grape && (
                            <div className="flex items-center gap-2 text-white/70">
                                <span className="material-symbols-outlined text-lg text-primary">grass</span>
                                <span className="text-sm">{wine.grape}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
                    <div className="flex flex-wrap gap-2">
                        {wine.tasteProfile && wine.tasteProfile.map(tag => (
                            <span key={tag} className="text-xs font-medium uppercase tracking-wider text-white/40 border border-white/10 rounded px-2 py-1">
                                {tag}
                            </span>
                        ))}
                    </div>

                    <Counter
                        value={wine.bottles || 0}
                        onChange={(val) => onUpdate(wine.id, { ...wine, bottles: val })}
                    />
                </div>
            </div>
        </div>
    );
}
