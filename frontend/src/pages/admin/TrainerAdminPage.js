import React, { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { getAdminVisibilityConfig, updateVisibilityLive } from '../../services/visibilityConfig';
import { normalizeVisibilityConfig } from '../../utils/visibilityResolver';
import { loadMenuData, getCategories } from '../../utils/menuDataLoader';

/**
 * TrainerAdminPage - Специализированная страница управления тренажером.
 * Создано на основе макета code.html с интеграцией в систему видимости.
 */
function TrainerAdminPage() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({ rules: [], features: {} });
    const [searchQuery, setSearchQuery] = useState('');
    const [allCategories, setAllCategories] = useState([]);

    const MENU_OPTIONS = [
        { id: 'kitchen', icon: 'restaurant_menu', label: 'Основное меню' },
        { id: 'breakfast', icon: 'bakery_dining', label: 'Завтраки' },
        { id: 'wine', icon: 'wine_bar', label: 'Винная карта' },
        { id: 'english', icon: 'translate', label: 'English' },
        { id: 'bar', icon: 'local_bar', label: 'Барное меню' },
        { id: 'tea', icon: 'emoji_food_beverage', label: 'Чай' },
    ];

    const MODE_OPTIONS = [
        { id: 'description', icon: 'auto_awesome', label: 'Красочное описание', subtitle: 'Описать блюдо гостю', color: 'emerald' },
        { id: 'allergens', icon: 'warning', label: 'Аллергены', subtitle: 'Тестирование на знание состава', color: 'orange' },
        { id: 'composition', icon: 'inventory_2', label: 'Состав', subtitle: 'Ингредиенты блюд', color: 'blue' },
        { id: 'english', icon: 'translate', label: 'English Mode', subtitle: 'Названия и описания на EN', color: 'blue' },
        { id: 'vocabulary', icon: 'menu_book', label: 'Лексика и факты', subtitle: 'Полезные фразы из English Menu', color: 'emerald' },
    ];

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const data = await getAdminVisibilityConfig();
                const raw = data.published?.config || {};
                const pub = normalizeVisibilityConfig(raw);
                setConfig(pub);

                const menus = ['kitchen', 'breakfast', 'wine', 'bar', 'tea'];
                const cats = new Set();
                for (const m of menus) {
                    try {
                        const items = await loadMenuData(m);
                        getCategories(items).forEach(c => {
                            if (c !== 'Все') cats.add(c);
                        });
                    } catch (e) { /* ignore */ }
                }
                setAllCategories(Array.from(cats).sort());
            } catch (err) {
                toast.error('Ошибка при загрузке данных');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [toast]);

    const isTargetEnabled = (scope, target) => {
        const rule = config.rules.find(r => r.scope === scope && r.target === target);
        return !rule || rule.action !== 'deny' || rule.enabled === false;
    };

    const toggleTarget = (scope, target) => {
        setConfig(prev => {
            const existingIdx = prev.rules.findIndex(r => r.scope === scope && r.target === target);
            const newRules = [...prev.rules];

            if (existingIdx >= 0) {
                const rule = newRules[existingIdx];
                if (rule.action === 'deny') {
                    newRules.splice(existingIdx, 1);
                } else {
                    newRules[existingIdx] = {
                        id: rule.id,
                        scope: rule.scope,
                        target: rule.target,
                        action: 'deny',
                        enabled: true,
                        when: { everyone: true, isAdmin: true }
                    };

                }
            } else {
                newRules.push({
                    id: `trainer-hide-${target}-${Date.now()}`,
                    scope,
                    target,
                    action: 'deny',
                    enabled: true,
                    when: { everyone: true, isAdmin: true }
                });


            }
            return { ...prev, rules: newRules };
        });
    };

    const updateFeature = (key, value) => {
        setConfig(prev => ({
            ...prev,
            features: { ...(prev.features || {}), [key]: value }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateVisibilityLive(config);
            toast.success('Настройки тренажера сохранены');
        } catch (err) {
            toast.error('Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    };

    const filteredCategories = allCategories.filter(cat =>
        cat.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleReset = () => {
        setConfig(prev => ({
            ...prev,
            rules: prev.rules.filter(r => !r.target.startsWith('trainer.'))
        }));
        toast.info('Настройки сброшены: все элементы включены. Нажми «Сохранить».');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-primary text-lg font-bold animate-pulse">Загрузка настроек...</div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-8 pb-32">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Управление тренажером</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Настройка меню, разделов и режимов</p>
                </div>
                <button
                    onClick={handleReset}
                    className="text-sm font-semibold text-emerald-600 dark:text-primary hover:opacity-80"
                >
                    Сбросить
                </button>
            </div>

            {/* Меню */}
            <section>
                <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 px-1">Управление Меню</h2>
                <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-border-dark divide-y divide-gray-100 dark:divide-border-dark">
                    {MENU_OPTIONS.map(menu => {
                        const enabled = isTargetEnabled('menuItem', `trainer.menu.${menu.id}`);
                        return (
                            <div key={menu.id} onClick={() => toggleTarget('menuItem', `trainer.menu.${menu.id}`)} className="flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-[#244732] flex items-center justify-center text-emerald-600 dark:text-white">
                                        <span className="material-symbols-outlined">{menu.icon}</span>
                                    </div>
                                    <span className="font-medium text-base text-gray-900 dark:text-white">{menu.label}</span>
                                </div>
                                <div className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                    <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Разделы */}
            <section>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Видимость разделов</h2>
                    <span className="text-xs text-primary font-medium cursor-pointer" onClick={() => setConfig(prev => ({ ...prev, rules: prev.rules.filter(r => !(r.scope === 'menuSection' && r.target.startsWith('trainer.cat.'))) }))}>
                        Выбрать все
                    </span>
                </div>
                <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-border-dark flex flex-col">
                    <div className="p-3 border-b border-gray-100 dark:border-border-dark bg-gray-50 dark:bg-black/20">
                        <input type="text" className="block w-full pl-3 pr-3 py-2 border-none rounded-lg bg-white dark:bg-[#112117] text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary sm:text-sm" placeholder="Найти раздел..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-border-dark max-h-60 overflow-y-auto">
                        {filteredCategories.map(cat => {
                            const enabled = isTargetEnabled('menuSection', `trainer.cat.${cat}`);
                            return (
                                <label key={cat} className="flex items-center px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                    <input type="checkbox" checked={enabled} onChange={() => toggleTarget('menuSection', `trainer.cat.${cat}`)} className="form-checkbox h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary dark:bg-gray-700" />
                                    <span className={`ml-3 text-sm font-medium ${!enabled ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{cat}</span>
                                    {!enabled && <span className="ml-auto text-xs text-gray-500">Скрыто</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Режимы */}
            <section>
                <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 px-1">Режимы обучения</h2>
                <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-border-dark divide-y divide-gray-100 dark:divide-border-dark">
                    {MODE_OPTIONS.map(mode => {
                        const enabled = isTargetEnabled('featureAction', `trainer.mode.${mode.id}`);
                        const iconColorClass = mode.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : mode.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600';
                        return (
                            <div key={mode.id} onClick={() => toggleTarget('featureAction', `trainer.mode.${mode.id}`)} className="flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColorClass}`}><span className="material-symbols-outlined">{mode.icon}</span></div>
                                    <div className="flex flex-col"><span className="font-medium text-base text-gray-900 dark:text-white">{mode.label}</span><span className="text-xs text-gray-500">{mode.subtitle}</span></div>
                                </div>
                                <div className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                    <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>


            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-background-dark via-white/95 dark:via-background-dark/95 to-transparent z-40">
                <div className="max-w-2xl mx-auto w-full">
                    <button disabled={saving} onClick={handleSave} className="w-full bg-primary hover:bg-emerald-400 text-black font-bold py-4 px-6 rounded-xl shadow-lg transform transition active:scale-[0.98] flex items-center justify-center gap-2">
                        {saving ? <span className="animate-spin material-symbols-outlined text-xl">sync</span> : <span className="material-symbols-outlined text-xl">save</span>}
                        {saving ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TrainerAdminPage;
