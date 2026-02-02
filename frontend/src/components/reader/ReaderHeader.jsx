import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Search,
    Heart,
    Share2,
    X,
    ChevronUp,
    ChevronDown,
    Settings,
    List
} from 'lucide-react';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { cn } from '../../utils/readerUtils';

// Простая кнопка-заглушка (в проекте используются обычные button с классами или свои компоненты)
const Button = ({ children, onClick, className, variant, size, disabled, 'aria-label': ariaLabel }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
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

const Input = ({ type, placeholder, value, onChange, onKeyDown, className, autoFocus }) => (
    <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className={cn(
            "w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary",
            className
        )}
    />
);

export function ReaderHeader({
    title,
    isBookmarked,
    onBack,
    onToggleBookmark,
    onShare,
    onSettingsClick,
    onOpenTOC,
    searchQuery,
    onSearchChange,
    currentSearchIndex,
    totalSearchResults,
    onSearchNext,
    onSearchPrevious,
    onClearSearch,
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { scrollDirection, scrollY } = useScrollDirection({ threshold: 20 });

    // Show header when at top, hide when scrolling down, show when scrolling up
    const shouldHide = scrollDirection === 'down' && scrollY > 100;

    const handleSearchToggle = () => {
        if (isSearchOpen) {
            onClearSearch();
        }
        setIsSearchOpen(!isSearchOpen);
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                onSearchPrevious();
            } else {
                onSearchNext();
            }
        } else if (e.key === 'Escape') {
            handleSearchToggle();
        }
    };

    // Scroll to active search result
    useEffect(() => {
        if (totalSearchResults > 0) {
            const activeElement = document.getElementById('active-search-result');
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentSearchIndex, totalSearchResults]);

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-40 bg-reader-header-bg theme-transition",
                "shadow-sm backdrop-blur-sm",
                "transform transition-transform duration-300 ease-out",
                shouldHide && "-translate-y-full"
            )}
            style={{ backgroundColor: 'hsl(var(--reader-header-bg))' }}
        >
            {/* Main header row */}
            <div className="flex items-center h-14 px-3 md:px-4">
                {/* Left: Back button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="shrink-0 text-foreground"
                    aria-label="Назад"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>

                {/* Center: Title */}
                <div className="flex-1 min-w-0 mx-3">
                    <h1 className="text-sm md:text-base font-medium truncate text-center text-foreground">
                        {title}
                    </h1>
                </div>

                {/* Right: Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSearchToggle}
                        className={cn(
                            "text-foreground",
                            isSearchOpen && "bg-black/5 dark:bg-white/5"
                        )}
                        aria-label="Поиск"
                    >
                        <Search className="h-5 w-5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleBookmark}
                        className="text-foreground"
                        aria-label={isBookmarked ? "Удалить из избранного" : "Добавить в избранное"}
                    >
                        {isBookmarked ? (
                            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                        ) : (
                            <Heart className="h-5 w-5" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenTOC}
                        className="text-foreground"
                        aria-label="Содержание"
                    >
                        <List className="h-5 w-5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onShare}
                        className="text-foreground"
                        aria-label="Поделиться"
                    >
                        <Share2 className="h-5 w-5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onSettingsClick}
                        className="text-foreground"
                        aria-label="Настройки"
                    >
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Search bar (expandable) */}
            <div
                className={cn(
                    "overflow-hidden transition-all duration-200 ease-out border-t border-gray-200 dark:border-gray-700",
                    isSearchOpen ? "max-h-14 opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <div className="flex items-center gap-2 px-3 py-2">
                    <div className="relative flex-1">
                        <Input
                            type="text"
                            placeholder="Поиск по статье..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="pr-16 h-9 text-sm"
                            autoFocus={isSearchOpen}
                        />
                        {totalSearchResults > 0 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                {currentSearchIndex + 1}/{totalSearchResults}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onSearchPrevious}
                            disabled={totalSearchResults === 0}
                            className="h-8 w-8"
                            aria-label="Предыдущее совпадение"
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onSearchNext}
                            disabled={totalSearchResults === 0}
                            className="h-8 w-8"
                            aria-label="Следующее совпадение"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSearchToggle}
                            className="h-8 w-8"
                            aria-label="Закрыть поиск"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
