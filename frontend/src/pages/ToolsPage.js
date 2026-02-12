import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useVisibility } from '../contexts/VisibilityContext';
import { getToolsRegistry } from '../services/api';

function ToolsPage() {
    const navigate = useNavigate();
    const { isGuest } = useAuth();
    const toast = useToast();
    const { isVisible } = useVisibility();
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTools = async () => {
            try {
                const data = await getToolsRegistry();
                // Filter out the legacy wine generator and keep only enabled tools
                const enabledTools = data.filter(t => t.enabled && t.id !== 'wine-list-generator');

                // Manual injection of Wine List Generator
                if (!enabledTools.find(t => t.id === 'wine-list-builder')) {
                    enabledTools.push({
                        id: 'wine-list-builder',
                        title: 'Генератор списка вин',
                        description: 'Создай свой список вин',
                        type: 'generator',
                        url: '/wine-list-builder',
                        enabled: true,
                        openMode: 'self'
                    });
                }

                // Внедрение Базы данных официанта
                if (!enabledTools.find(t => t.id === 'waiter-database')) {
                    enabledTools.push({
                        id: 'waiter-database',
                        title: 'База данных официанта',
                        description: 'Полная информация о блюдах в одном месте',
                        type: 'database',
                        url: '/menus/waiter-database.html',
                        enabled: true,
                        openMode: 'new_tab'
                    });
                }

                // Внедрение Интервального тренинга
                if (!enabledTools.find(t => t.id === 'interval-trainer')) {
                    enabledTools.push({
                        id: 'interval-trainer',
                        title: 'Интервальный тренинг',
                        description: 'Изучение меню с интервальным повторением',
                        type: 'trainer',
                        url: '/interval-trainer',
                        enabled: true,
                        openMode: 'self'
                    });
                }

                setTools(enabledTools);
            } catch (error) {
                console.error('Ошибка загрузки инструментов:', error);
                toast.error('Не удалось загрузить список инструментов');
            } finally {
                setLoading(false);
            }
        };
        fetchTools();
    }, [toast]);

    const handleToolClick = (tool) => {
        if (isGuest) {
            toast.warning('Раздел доступен только после входа', {
                title: '🔒 Требуется вход',
                action: {
                    label: 'Войти',
                    onClick: () => navigate('/', { state: { showLogin: true } })
                }
            });
            return;
        }
        if (tool.openMode === 'new_tab') {
            // В режиме разработки (порт 3000) инструменты нужно открывать на порту бэкенда (5000)
            // Исключение: файлы из папки public/ (например, /menus/, /trainer/)
            let toolUrl = tool.url;
            if (window.location.port === '3000' && toolUrl.startsWith('/') && !toolUrl.startsWith('/menus/') && !toolUrl.startsWith('/trainer/')) {
                toolUrl = `http://localhost:5000${toolUrl}`;
            }
            window.open(toolUrl, '_blank', 'noopener,noreferrer');
        } else {
            // Для внутренних React-инструментов (если будут) используем navigate
            navigate(tool.url);
        }
    };

    const getIcon = (type) => {
        if (type === 'generator') return 'manufacturing';
        if (type === 'database') return 'database';
        if (type === 'trainer') return 'fitness_center';
        return 'build';
    };

    if (loading) {
        return (
            <div className="aurora-bg min-h-screen flex items-center justify-center">
                <div className="text-primary text-xl font-bold font-display">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen aurora-bg font-display antialiased">
            <header className="sticky top-0 z-50 flex items-center bg-white/95 dark:bg-[#181311]/95 backdrop-blur-sm p-4 pb-2 justify-between border-b border-orange-100/50 dark:border-gray-800 shadow-sm">
                <button
                    onClick={() => navigate('/info')}
                    className="text-[#181311] dark:text-white flex size-10 items-center justify-center rounded-full hover:bg-orange-50 dark:hover:bg-white/5"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-[#181311] dark:text-white text-lg font-bold text-center flex-1">Инструменты</h1>
                <div className="w-10"></div>
            </header>

            <main className="p-4">
                {tools.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <span className="material-symbols-outlined text-6xl opacity-20 block mb-4">construction</span>
                        <p>Инструменты пока недоступны</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {tools.filter(tool => {
                            if (tool.id === 'waiter-trainer') {
                                return isVisible({ scope: 'featureAction', target: 'tool.waiterTrainer' });
                            }
                            return true;
                        }).map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => handleToolClick(tool)}
                                className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#1b1412] p-5 shadow-md shadow-orange-900/5 border border-orange-100/50 dark:border-gray-800 text-left active:scale-[0.98] transition-all"
                            >
                                <div className="flex flex-col h-full justify-between gap-4">
                                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined text-3xl">{getIcon(tool.type)}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-[#181311] dark:text-white leading-tight mb-1">
                                            {tool.title}
                                        </h3>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                                            {tool.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default ToolsPage;
