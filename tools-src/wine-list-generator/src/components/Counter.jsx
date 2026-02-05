import React from 'react';

export default function Counter({ value, onChange, min = 0 }) {
    const increment = () => onChange(value + 1);
    const decrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    return (
        <div className="flex items-center bg-chip-bg/50 border border-border-dark rounded-xl p-1 shrink-0">
            <button
                onClick={decrement}
                className="size-8 flex items-center justify-center text-white/60 hover:text-primary transition-colors"
                type="button"
            >
                <span className="material-symbols-outlined text-lg">remove</span>
            </button>
            <div className="px-3 min-w-[2.5rem] text-center">
                <span className="text-sm font-bold text-white">{value}</span>
                <span className="text-[9px] block text-white/40 -mt-1 uppercase">бут.</span>
            </div>
            <button
                onClick={increment}
                className="size-8 flex items-center justify-center text-white/60 hover:text-primary transition-colors"
                type="button"
            >
                <span className="material-symbols-outlined text-lg">add</span>
            </button>
        </div>
    );
}
