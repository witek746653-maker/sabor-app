import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BookOpen, Clock, ArrowRight } from 'lucide-react';
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

    useEffect(() => {
        // Загружаем манифест
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-900 px-4 py-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">Статьи и гайды</h1>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {articles.map((article) => (
                            <ArticleCard
                                key={article.key}
                                article={article}
                                onClick={(key) => navigate(`/article/${key}`)}
                            />
                        ))}

                        {articles.length === 0 && (
                            <div className="col-span-full py-20 text-center">
                                <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                                <p className="text-gray-500">Статей пока нет, но они скоро появятся!</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
