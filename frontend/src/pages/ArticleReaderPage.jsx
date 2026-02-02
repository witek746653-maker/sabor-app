import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { ReadingProgressBar } from '../components/reader/ReadingProgressBar';
import { ReaderHeader } from '../components/reader/ReaderHeader';
import { ReaderSettings } from '../components/reader/ReaderSettings';
import { ArticleContent } from '../components/reader/ArticleContent';
import { ArticleSkeleton } from '../components/reader/ArticleSkeleton';
import { ArticleError } from '../components/reader/ArticleError';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { useTextSearch } from '../hooks/useTextSearch';
import { useToast } from '../contexts/ToastContext'; // Используем существующий контекст проекта
import { ArrowUp, Clock } from 'lucide-react';
import { TableOfContents } from '../components/reader/TableOfContents';
import '../reader.css';

export default function ArticleReaderPage() {
    const { articleKey } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    // States
    const [articleData, setArticleData] = useState(null);
    const [rawMarkdown, setRawMarkdown] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [loadingState, setLoadingState] = useState('loading'); // loading, success, error
    const [errorHeader, setErrorHeader] = useState('');
    const [manifestUpdate, setManifestUpdate] = useState(null);
    const [fileDate, setFileDate] = useState(null);

    // Settings
    const [fontSize, setFontSize] = useState(() => localStorage.getItem('reader-font-size') || 'base');
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('reader-theme');
        return (saved && saved !== 'sepia') ? saved : 'light';
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isTOCOpen, setIsTOCOpen] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [headers, setHeaders] = useState([]);

    // Функция для извлечения заголовков для оглавления
    const extractHeaders = (html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const headerElements = doc.querySelectorAll('h1, h2, h3');

        return Array.from(headerElements).map((el, index) => {
            const id = el.id || `header-${index}`;
            // Убеждаемся, что у заголовка в HTML есть ID для перехода
            el.id = id;
            return {
                id,
                text: el.innerText,
                level: parseInt(el.tagName.substring(1))
            };
        });
    };

    // Refs & Hooks
    const contentRef = useRef(null);
    const progress = useReadingProgress(contentRef);
    const {
        query,
        setQuery,
        currentIndex,
        totalResults,
        goToNext,
        goToPrevious,
        clearSearch
    } = useTextSearch(rawMarkdown);

    // Load article
    useEffect(() => {
        const fetchArticle = async () => {
            setLoadingState('loading');
            try {
                // 1. Get manifest
                const manifestResponse = await fetch('/content/manifest.json');
                if (!manifestResponse.ok) throw new Error('Не удалось загрузить манифест статей');
                const manifest = await manifestResponse.json();
                setManifestUpdate(manifest.updated_at);

                const article = manifest.articles.find(a => a.key === articleKey);
                if (!article) throw new Error('Статья не найдена');

                setArticleData(article);

                // 2. Fetch markdown content
                const mdResponse = await fetch(article.url);
                if (!mdResponse.ok) throw new Error('Не удалось загрузить текст статьи');

                // Пытаемся получить реальную дату изменения файла от сервера
                const lastModified = mdResponse.headers.get('Last-Modified');
                if (lastModified) {
                    setFileDate(lastModified);
                }

                const mdText = await mdResponse.text();

                setRawMarkdown(mdText);

                // 3. Parse markdown to HTML
                const html = marked.parse(mdText);

                // 4. Extract headers and ensure they have IDs
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const headerElements = doc.querySelectorAll('h1, h2, h3');
                const extractedHeaders = Array.from(headerElements).map((el, index) => {
                    const id = el.id || `header-${index}`;
                    el.id = id;
                    return {
                        id,
                        text: el.innerText,
                        level: parseInt(el.tagName.substring(1))
                    };
                });

                setHeaders(extractedHeaders);
                setHtmlContent(doc.body.innerHTML);

                setLoadingState('success');
            } catch (err) {
                console.error('Reader error:', err);
                setErrorHeader(err.message);
                setLoadingState('error');
            }
        };

        fetchArticle();
    }, [articleKey]);

    // Handle settings persistence
    useEffect(() => {
        localStorage.setItem('reader-font-size', fontSize);
        localStorage.setItem('reader-theme', theme);

        // Очищаем старые темы
        document.body.classList.remove('light', 'dark', 'sepia');
        document.documentElement.classList.remove('light', 'dark');

        // Добавляем новую тему
        document.body.classList.add(theme);

        // Для Tailwind/Sabor глобальных стилей добавляем на html
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.add('light');
        }

        return () => {
            document.body.classList.remove('light', 'dark', 'sepia');
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        };
    }, [fontSize, theme]);

    // Load bookmark status
    useEffect(() => {
        if (!articleKey) return;
        const saved = localStorage.getItem('article-favorites');
        if (saved) {
            const favorites = JSON.parse(saved);
            setIsBookmarked(favorites.includes(articleKey));
        }
    }, [articleKey]);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: articleData?.title || 'Статья Sabor',
                    url: window.location.href,
                });
            } catch (err) {
                console.log('Share cancelled or failed');
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Теперь вы можете отправить её друзьям", {
                title: "Ссылка скопирована",
            });
        }
    };

    const handleToggleBookmark = () => {
        const nextState = !isBookmarked;
        setIsBookmarked(nextState);

        // Persist to localStorage
        const saved = localStorage.getItem('article-favorites');
        let favorites = saved ? JSON.parse(saved) : [];

        if (nextState) {
            if (!favorites.includes(articleKey)) {
                favorites.push(articleKey);
            }
        } else {
            favorites = favorites.filter(id => id !== articleKey);
        }

        localStorage.setItem('article-favorites', JSON.stringify(favorites));

        toast.info(articleData?.title, {
            title: nextState ? "Добавлено в избранное" : "Удалено из избранного",
        });
    };

    return (
        <div className={`min-h-screen theme-transition bg-reader-bg ${theme} font-size-${fontSize}`}>
            <ReadingProgressBar progress={progress} />

            <ReaderHeader
                title={articleData?.title || 'Чтение статьи'}
                isBookmarked={isBookmarked}
                onBack={() => navigate(-1)}
                onToggleBookmark={handleToggleBookmark}
                onShare={handleShare}
                onSettingsClick={() => setIsSettingsOpen(true)}
                onOpenTOC={() => setIsTOCOpen(true)}
                searchQuery={query}
                onSearchChange={setQuery}
                currentSearchIndex={currentIndex}
                totalSearchResults={totalResults}
                onSearchNext={goToNext}
                onSearchPrevious={goToPrevious}
                onClearSearch={clearSearch}
            />

            <main className="pt-20 pb-20">
                {loadingState === 'loading' && <ArticleSkeleton />}

                {loadingState === 'error' && (
                    <ArticleError
                        message={errorHeader}
                        onRetry={() => window.location.reload()}
                    />
                )}

                {loadingState === 'success' && (
                    <div className="flex flex-col">
                        {/* Мета-информация статьи */}
                        <div className="max-w-reader mx-auto w-full px-6 mb-8">
                            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-[#896f61] dark:text-gray-500 border-b border-gray-100 dark:border-gray-900 pb-4">
                                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                                    {articleData?.category || 'Статья'}
                                </span>
                                {(fileDate || manifestUpdate) && (
                                    <span className="px-2 py-0.5 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 rounded-md bg-white/50 dark:bg-black/50">
                                        Обновлено: {new Date(fileDate || manifestUpdate).toLocaleDateString('ru-RU')}
                                    </span>
                                )}
                                <span className="flex items-center gap-1 opacity-50">
                                    <Clock className="h-3 w-3" />
                                    {articleData?.readingTime || '5 мин'}
                                </span>
                                {articleData?.wordCount && (
                                    <>
                                        <span className="opacity-30">•</span>
                                        <span>{articleData.wordCount} слов</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <ArticleContent
                            ref={contentRef}
                            htmlContent={htmlContent}
                            fontSize={fontSize}
                            searchQuery={query}
                            searchIndex={currentIndex}
                        />

                        {/* Технический 'принт' (метаданные) */}
                        <div className="max-w-reader mx-auto w-full px-6 mt-16 pb-12">
                            <div className="pt-8 border-t border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-end gap-2 text-[10px] font-mono uppercase tracking-widest">
                                <div className="opacity-50 text-right">
                                    <span className="text-primary font-bold">Синхронизировано:</span> {new Date().toLocaleDateString('ru-RU')} {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="opacity-50 text-right">
                                    <span className="text-primary font-bold">Обновлено:</span> {new Date(fileDate || manifestUpdate || Date.now()).toLocaleDateString('ru-RU', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                                </div>
                            </div>
                        </div>

                        {/* Кнопка "В начало" */}
                        <div className="max-w-reader mx-auto w-full px-6 mt-8 mb-8 flex justify-center">
                            <button
                                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-all active:scale-[0.98]"
                            >
                                <ArrowUp className="h-5 w-5" />
                                <span>В начало</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <ReaderSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                theme={theme}
                onThemeChange={setTheme}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
            />

            <TableOfContents
                isOpen={isTOCOpen}
                onClose={() => setIsTOCOpen(false)}
                headers={headers}
                theme={theme}
            />
        </div>
    );
}
