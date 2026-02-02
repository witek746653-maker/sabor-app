import React, { forwardRef } from 'react';
import { cn } from '../../utils/readerUtils';

export const ArticleContent = forwardRef(({ htmlContent, fontSize, className, searchQuery, searchIndex }, ref) => {
    const fontSizeClass = `font-size-${fontSize}`;

    // Функция для подсветки результатов поиска
    const getHighlightedContent = () => {
        if (!searchQuery || searchQuery.length < 2) return htmlContent;

        try {
            const regex = new RegExp(`(${searchQuery})`, 'gi');
            let matchCount = 0;

            // Разбиваем HTML на части: теги и текст между ними
            const parts = htmlContent.split(/(<[^>]+>)/g);

            const highlightedParts = parts.map(part => {
                if (!part) return '';
                if (part.startsWith('<')) return part;

                return part.replace(regex, (match) => {
                    const isCurrent = matchCount === searchIndex;
                    const id = isCurrent ? 'id="active-search-result"' : '';
                    const className = isCurrent ? 'bg-primary text-white shadow-sm' : 'bg-primary/20';
                    matchCount++;
                    return `<mark ${id} class="${className} rounded-sm px-0.5">${match}</mark>`;
                });
            });

            return highlightedParts.join('');
        } catch (e) {
            console.error('Highlight error:', e);
            return htmlContent;
        }
    };

    const highlightedHtml = getHighlightedContent();

    return (
        <article
            ref={ref}
            className={cn(
                "reader-content theme-transition",
                "px-4 md:px-6 lg:px-8",
                "max-w-reader mx-auto",
                fontSizeClass,
                className
            )}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
    );
});

ArticleContent.displayName = 'ArticleContent';
