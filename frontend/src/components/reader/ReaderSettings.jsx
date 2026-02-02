import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sun, Moon } from 'lucide-react';
import { cn } from '../../utils/readerUtils';

const Button = ({ children, onClick, className, variant, size, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
            "flex items-center justify-center rounded-md transition-colors",
            variant === 'ghost' ? "bg-transparent hover:bg-black/5 dark:hover:bg-white/5" : "bg-primary text-white",
            size === 'icon' ? "w-10 h-10" : "px-4 py-2",
            disabled && "opacity-50 cursor-not-allowed",
            className
        )}
    >
        {children}
    </button>
);

const fontSizeOrder = ['sm', 'base', 'lg', 'xl', '2xl'];

export function ReaderSettings({
    isOpen,
    onClose,
    theme,
    onThemeChange,
    fontSize,
    onFontSizeChange,
}) {
    const currentFontIndex = fontSizeOrder.indexOf(fontSize);

    const decreaseFontSize = () => {
        if (currentFontIndex > 0) {
            onFontSizeChange(fontSizeOrder[currentFontIndex - 1]);
        }
    };

    const increaseFontSize = () => {
        if (currentFontIndex < fontSizeOrder.length - 1) {
            onFontSizeChange(fontSizeOrder[currentFontIndex + 1]);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Settings panel */}
            <div className={cn(
                "fixed bottom-0 left-0 right-0 z-[101] bg-reader-bg rounded-t-2xl shadow-lg animate-slide-down theme-transition border-t border-gray-200 dark:border-gray-800",
                theme
            )}>
                <div className="max-w-lg mx-auto p-4 pb-8">
                    {/* Handle bar */}
                    <div className="flex justify-center mb-4">
                        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-foreground">Настройки чтения</h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-foreground"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Font size controls */}
                    <div className="mb-6">
                        <label className="text-sm font-medium text-gray-500 mb-3 block">
                            Размер шрифта
                        </label>
                        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                            <Button
                                variant="ghost"
                                onClick={decreaseFontSize}
                                disabled={currentFontIndex === 0}
                                className="h-10 w-14 text-lg font-serif"
                            >
                                A-
                            </Button>

                            <div className="flex-1 flex items-center justify-center gap-1">
                                {fontSizeOrder.map((size, index) => (
                                    <div
                                        key={size}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-colors",
                                            index <= currentFontIndex ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                                        )}
                                        style={index <= currentFontIndex ? { backgroundColor: 'hsl(var(--primary))' } : {}}
                                    />
                                ))}
                            </div>

                            <Button
                                variant="ghost"
                                onClick={increaseFontSize}
                                disabled={currentFontIndex === fontSizeOrder.length - 1}
                                className="h-10 w-14 text-xl font-serif"
                            >
                                A+
                            </Button>
                        </div>
                    </div>

                    {/* Theme selection */}
                    <div>
                        <label className="text-sm font-medium text-gray-500 mb-3 block">
                            Тема оформления
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => onThemeChange('light')}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                    theme === 'light'
                                        ? "border-primary bg-white shadow-sm"
                                        : "border-transparent bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                style={theme === 'light' ? { borderColor: 'hsl(var(--primary))' } : {}}
                            >
                                <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                                    <Sun className="h-5 w-5 text-gray-700" />
                                </div>
                                <span className="text-sm font-medium text-foreground">Светлая</span>
                            </button>

                            <button
                                onClick={() => onThemeChange('dark')}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                    theme === 'dark'
                                        ? "border-primary bg-gray-900"
                                        : "border-transparent bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                style={theme === 'dark' ? { borderColor: 'hsl(var(--primary))' } : {}}
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center shadow-sm">
                                    <Moon className="h-5 w-5 text-gray-200" />
                                </div>
                                <span className="text-sm font-medium text-foreground">Тёмная</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
