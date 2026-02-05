import React, { useState, useEffect } from 'react';
import Counter from './Counter';

export default function EditModal({ wine, isOpen, onClose, onSave }) {
    const [formData, setFormData] = useState({ ...wine });

    useEffect(() => {
        if (wine) {
            setFormData({ ...wine });
        }
    }, [wine]);

    if (!isOpen || !wine) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleTaste = (tag) => {
        const currentTags = formData.tasteProfile || [];
        if (currentTags.includes(tag)) {
            handleChange('tasteProfile', currentTags.filter(t => t !== tag));
        } else {
            handleChange('tasteProfile', [...currentTags, tag]);
        }
    };

    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex justify-center items-end" role="dialog">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative w-full max-w-md bg-background-dark rounded-t-[2rem] shadow-[0_-8px_30px_rgba(0,0,0,0.5)] h-[85vh] flex flex-col border-t border-white/5 animate-slide-up">

                {/* Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                {/* Header */}
                <div className="px-6 pb-4 pt-2 flex items-center justify-between border-b border-border-dark/30">
                    <h2 className="text-xl font-bold text-white">Редактировать позицию</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-white/60 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
                    <div className="flex gap-4">
                        <div className="space-y-2 flex-[3]">
                            <label className="text-sm font-medium text-white/80 ml-1">Название вина</label>
                            <input
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full rounded-xl bg-surface-dark border-border-dark text-white placeholder-white/40 focus:ring-primary focus:border-primary p-4 text-base font-semibold shadow-sm"
                            />
                        </div>
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-white/80 ml-1">Бутылки</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.bottles}
                                onChange={(e) => handleChange('bottles', parseInt(e.target.value) || 0)}
                                className="w-full rounded-xl bg-surface-dark border-border-dark text-white placeholder-white/40 focus:ring-primary focus:border-primary p-4 text-base text-center font-bold shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80 ml-1">Страна</label>
                        <div className="relative">
                            <select
                                value={formData.country}
                                onChange={(e) => handleChange('country', e.target.value)}
                                className="w-full appearance-none rounded-xl bg-surface-dark border-border-dark text-white p-4 pr-10 text-base font-medium focus:ring-primary focus:border-primary shadow-sm"
                            >
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80 ml-1">Тип</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'red', label: 'Красное', icon: 'circle' },
                                { id: 'white', label: 'Белое', icon: 'wine_bar' },
                                { id: 'rose', label: 'Розе', icon: 'local_florist' },
                                { id: 'sparkling', label: 'Игристое', icon: 'shutter_speed' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => handleChange('type', type.id)}
                                    className={`flex h-12 items-center justify-center gap-x-2 rounded-xl transition-all ${formData.type === type.id
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'bg-surface-dark border border-white/5 text-white/60 hover:bg-surface-dark/80'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{type.icon}</span>
                                    <span className="text-sm font-bold">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80 ml-1">Профиль вкуса</label>
                        <div className="flex flex-wrap gap-2">
                            {['Сухое', 'Минеральное', 'Сладкое', 'Дубовое', 'Фруктовое', 'Танинное', 'Легкое', 'Кислотное'].map(tag => {
                                const isActive = (formData.tasteProfile || []).includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTaste(tag)}
                                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                                                ? 'bg-primary/20 border border-primary text-primary font-bold'
                                                : 'bg-surface-dark border border-white/5 text-white/50 hover:text-white hover:border-white/20'
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="h-20"></div>
                </div>

                {/* Footer */}
                <div className="p-4 pb-8 border-t border-border-dark/50 bg-background-dark">
                    <button
                        onClick={handleSave}
                        className="w-full h-12 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform"
                    >
                        Сохранить изменения
                    </button>
                </div>

            </div>
        </div>
    );
}
