import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BookOpen, Clock, ArrowRight, Search, X } from 'lucide-react';
import { cn } from '../utils/readerUtils';

// Вспомогательный компонент карточки статьи
const ArticleCard = ({ article, onClick }) => {
    return (
        <button
            onClick={() => onClick(article.key)}
            className="group relative flex flex-col w-full text-left bg-white dark:bg-surface-dark rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all active:scale-[0.98] hover:shadow-md border border-gray-100 dark:border-gray-800"
        >
            <div className="relative h-40 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {article.image ? (
                    <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/articles/placeholder.jpg';
                            e.target.classList.add('opacity-40', 'grayscale');
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                        <BookOpen size={48} />
                    </div>
                )}
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-wider">
                    {article.category || 'Статья'}
                </div>
            </div>

            <div className="p-4 flex flex-col flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2">
                    {article.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
                    {article.description || 'Нажмите, чтобы прочитать подробнее...'}
                </p>

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400 uppercase tracking-tight">
                        <div className="flex items-center gap-1">
                            <Clock size={10} />
                            <span>{article.readingTime || '5 мин'}</span>
                        </div>
                        {article.wordCount && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span>{article.wordCount} слов</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-[hsl(var(--primary))] font-semibold text-xs">
                        <span>Читать</span>
                        <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                    </div>
                </div>
            </div>
        </button>
    );
};

export default function ArticlesListPage() {
    const navigate = useNavigate();
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Состояния для поиска и фильтров
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Все');

    useEffect(() => {
        const fetchManifest = async () => {
            try {
                const response = await fetch('/content/manifest.json');
                const data = await response.json();
                setArticles(data.articles || []);
            } catch (error) {
                console.error('Error loading articles manifest:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchManifest();
    }, []);

    // Получаем уникальные категории для фильтров
    const categories = useMemo(() => {
        const cats = articles.map(a => a.category || 'Статья');
        return ['Все', ...new Set(cats)];
    }, [articles]);

    // Логика фильтрации
    const filteredArticles = useMemo(() => {
        return articles.filter(article => {
            const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'Все' || article.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [articles, searchQuery, selectedCategory]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-900 px-4 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">Гайды/Инструкции/Памятки</h1>
                </div>

                {/* Поисковая строка */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Поиск по названию..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-white/5 border-none rounded-xl py-3 pl-10 pr-10 text-sm focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Фильтры по категориям */}
                <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
                                selectedCategory === cat
                                    ? "bg-primary border-primary text-white shadow-sm shadow-primary/20"
                                    : "bg-white dark:bg-black/20 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            <main className="px-4 pt-6">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-64 bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {filteredArticles.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredArticles.map((article) => (
                                    <ArticleCard
                                        key={article.key}
                                        article={article}
                                        onClick={(key) => navigate(`/article/${key}`)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center animate-fade-in">
                                <div className="bg-gray-100 dark:bg-gray-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="h-8 w-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ничего не нашли</h3>
                                <p className="text-gray-500 text-sm max-w-[240px] mx-auto mt-2">
                                    Попробуйте изменить запрос или выбрать другую категорию
                                </p>
                                <button
                                    onClick={() => { setSearchQuery(''); setSelectedCategory('Все'); }}
                                    className="mt-6 text-primary font-bold text-sm underline"
                                >
                                    Сбросить фильтры
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
