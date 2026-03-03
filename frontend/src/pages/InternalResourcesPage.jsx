import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, FileText, Share2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import GuestBlocker from '../components/GuestBlocker';

export default function InternalResourcesPage() {
    const navigate = useNavigate();
    const { isGuest, isAuthenticated } = useAuth();
    const toast = useToast();
    const guestBlocked = !isAuthenticated || isGuest;

    const resources = [
        {
            id: 'hostess',
            name: 'Инструкция для хостес',
            path: '/api/private/menus/hostess_instruction.pdf',
            description: 'Основные правила и регламенты работы'
        },
        {
            id: 'employees',
            name: 'Комплекс для сотрудников',
            path: '/api/private/menus/latest.pdf',
            description: 'Внутренние ресурсы и обучение'
        },
        {
            id: 'kbju',
            name: 'КБЖУ Блюд завтраков',
            path: '/api/private/menus/kbju_breakfast.pdf',
            description: 'Пищевая ценность блюд (загружено)'
        }
    ];

    const getPdfUrl = (path, disposition = 'attachment') => {
        const baseUrl = process.env.NODE_ENV === 'development' && window.location.port === '3000'
            ? 'http://localhost:5000'
            : window.location.origin;
        const params = new URLSearchParams();
        if (disposition) params.set('disposition', disposition);
        params.set('v', String(Date.now()));
        return `${baseUrl}${path}?${params.toString()}`;
    };

    const handleDownload = (resource) => {
        if (resource.isPlaceholder) {
            toast.info('Файл еще не загружен на сервер');
            return;
        }
        const link = document.createElement('a');
        link.href = getPdfUrl(resource.path);
        link.download = resource.name + '.pdf';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpen = (resource) => {
        if (resource.isPlaceholder) {
            toast.info('Файл еще не загружен на сервер');
            return;
        }
        window.open(getPdfUrl(resource.path, 'inline'), '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-20 font-display antialiased">
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-900 px-4 py-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Внутренние ресурсы</h1>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Файлы для скачивания</p>
                    </div>
                </div>
            </header>

            <main className="px-4 pt-6 max-w-2xl mx-auto">
                {guestBlocked ? (
                    <div className="p-4 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <GuestBlocker lines={5} message="Ресурсы доступны только сотрудникам после авторизации" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {resources.map((res) => (
                            <div
                                key={res.id}
                                className="bg-white dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="bg-primary/10 p-3 rounded-xl">
                                        <FileText className="text-primary" size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{res.name}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{res.description}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <button
                                        onClick={() => handleOpen(res)}
                                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm font-semibold"
                                    >
                                        <Share2 size={16} />
                                        <span>Открыть</span>
                                    </button>
                                    <button
                                        onClick={() => handleDownload(res)}
                                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors text-sm font-bold shadow-md shadow-primary/20"
                                    >
                                        <Download size={16} />
                                        <span>Скачать</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
