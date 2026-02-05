import React, { useState } from 'react';

const INITIAL_STATE = {
    name: '',
    country: '',
    type: 'red',
    tasteProfile: [],
    bottles: 1,
    grape: '',
    region: ''
};

export default function WineForm({ onAdd }) {
    const [formData, setFormData] = useState(INITIAL_STATE);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleTaste = (tag) => {
        const currentTags = formData.tasteProfile;
        if (currentTags.includes(tag)) {
            handleChange('tasteProfile', currentTags.filter(t => t !== tag));
        } else {
            handleChange('tasteProfile', [...currentTags, tag]);
        }
    };

    const handleSubmit = () => {
        if (!formData.name) return; // Simple validation
        onAdd({
            id: Date.now(),
            ...formData
        });
        setFormData(INITIAL_STATE); // Reset
    };

    const handleReset = () => {
        setFormData(INITIAL_STATE);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Добавить вино</h2>
                <button
                    onClick={handleReset}
                    className="text-sm text-primary font-medium hover:text-primary/80 transition-colors"
                >
                    Сбросить
                </button>
            </div>

            <div className="bg-surface-dark/50 dark:bg-surface-dark/30 rounded-2xl border border-border-dark p-5 space-y-5 shadow-lg">

                {/* Name and Bottles */}
                <div className="flex gap-4">
                    <div className="space-y-2 flex-[3]">
                        <label className="text-sm font-medium text-white/80 ml-1">Название вина</label>
                        <input
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full rounded-xl bg-surface-dark border-border-dark text-white placeholder-white/40 focus:ring-primary focus:border-primary p-4 text-base transition-shadow focus:shadow-[0_0_0_2px_rgba(212,17,147,0.2)]"
                            placeholder="Пример: Château Margaux 2015"
                        />
                    </div>
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium text-white/80 ml-1">Бутылки</label>
                        <input
                            type="number"
                            min="1"
                            value={formData.bottles}
                            onChange={(e) => handleChange('bottles', parseInt(e.target.value) || 1)}
                            className="w-full rounded-xl bg-surface-dark border-border-dark text-white placeholder-white/40 focus:ring-primary focus:border-primary p-4 text-base text-center font-bold"
                        />
                    </div>
                </div>

                {/* Country */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80 ml-1">Страна</label>
                    <div className="relative">
                        <select
                            value={formData.country}
                            onChange={(e) => handleChange('country', e.target.value)}
                            className="w-full appearance-none rounded-xl bg-surface-dark border-border-dark text-white p-4 pr-10 text-base focus:ring-primary focus:border-primary transition-shadow focus:shadow-[0_0_0_2px_rgba(212,17,147,0.2)]"
                        >
                            <option value="" disabled>Выберите страну...</option>
                            <option value="Франция">Франция 🇫🇷</option>
                            <option value="Италия">Италия 🇮🇹</option>
                            <option value="Испания">Испания 🇪🇸</option>
                            <option value="США">США 🇺🇸</option>
                            <option value="Германия">Германия 🇩🇪</option>
                            <option value="Португалия">Португалия 🇵🇹</option>
                            <option value="Новая Зеландия">Новая Зеландия 🇳🇿</option>
                            <option value="Аргентина">Аргентина 🇦🇷</option>
                            <option value="Чили">Чили 🇨🇱</option>
                            <option value="Австрия">Австрия 🇦🇹</option>
                            <option value="Россия">Россия 🇷🇺</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none">expand_more</span>
                    </div>
                </div>

                {/* Type */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80 ml-1">Тип</label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'red', label: 'Красное', icon: 'circle', bg: 'bg-primary' },
                            { id: 'white', label: 'Белое', icon: 'wine_bar', bg: 'bg-chip-bg' },
                            { id: 'rose', label: 'Розе', icon: 'local_florist', bg: 'bg-chip-bg' },
                            { id: 'sparkling', label: 'Игр.', icon: 'shutter_speed', bg: 'bg-chip-bg' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => handleChange('type', type.id)}
                                className={`flex h-10 shrink-0 items-center gap-x-2 rounded-xl px-4 transition-all ${formData.type === type.id
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-chip-bg text-white/80 border border-transparent hover:border-border-dark'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{type.icon}</span>
                                <span className="text-sm font-medium">{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Taste Profile */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80 ml-1">Профиль вкуса</label>
                    <div className="flex flex-wrap gap-2">
                        {['Сухое', 'Сладкое', 'Дубовое', 'Фруктовое', 'Танинное'].map(tag => {
                            const isActive = formData.tasteProfile.includes(tag);
                            return (
                                <button
                                    key={tag}
                                    onClick={() => toggleTaste(tag)}
                                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-transform active:scale-95 ${isActive
                                            ? 'bg-primary/20 border border-primary text-primary'
                                            : 'bg-chip-bg border border-transparent text-white/70 hover:text-white hover:border-border-dark'
                                        }`}
                                >
                                    {tag}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Grape / Region (Optional additional fields, keeping KISS) */}

                <div className="pt-2">
                    <button
                        onClick={handleSubmit}
                        className="w-full h-14 rounded-xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 hover:bg-primary/90"
                    >
                        <span className="material-symbols-outlined text-2xl">add_circle</span>
                        Добавить в список
                    </button>
                </div>

            </div>
        </div>
    );
}
