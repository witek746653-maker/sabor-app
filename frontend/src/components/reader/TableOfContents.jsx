import React from 'react';
import { createPortal } from 'react-dom';
import { X, List } from 'lucide-react';
import { cn } from '../../utils/readerUtils';

export function TableOfContents({
    isOpen,
    onClose,
    headers,
    theme
}) {
    if (!isOpen) return null;

    const scrollToHeader = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Добавляем небольшой отступ сверху из-за шапки
            const yOffset = -80;
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
            onClose();
        }
    };

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* TOC Panel */}
            <div className={cn(
                "fixed bottom-0 left-0 right-0 z-[101] bg-reader-bg rounded-t-2xl shadow-lg animate-slide-down theme-transition border-t border-gray-200 dark:border-gray-800",
                theme
            )}>
                <div className="max-w-lg mx-auto p-4 pb-8 max-h-[80vh] overflow-y-auto">
                    {/* Handle bar */}
                    <div className="flex justify-center mb-4">
                        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6 sticky top-0 bg-inherit py-2 z-10">
                        <div className="flex items-center gap-2">
                            <List className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold text-foreground">Содержание</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-foreground transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Header List */}
                    <div className="space-y-1">
                        {headers.length > 0 ? (
                            headers.map((header, index) => (
                                <button
                                    key={`${header.id}-${index}`}
                                    onClick={() => scrollToHeader(header.id)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl transition-all hover:bg-primary/5 active:scale-[0.98]",
                                        header.level === 1 ? "font-bold text-base" :
                                            header.level === 2 ? "pl-6 text-sm font-medium" :
                                                "pl-10 text-xs text-gray-500"
                                    )}
                                >
                                    <span className="text-foreground">{header.text}</span>
                                </button>
                            ))
                        ) : (
                            <p className="text-center py-8 text-gray-500 italic">
                                В этой статье нет разделов
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
