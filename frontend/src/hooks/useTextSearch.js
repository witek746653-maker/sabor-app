import { useState, useMemo, useCallback } from 'react';

export function useTextSearch(text) {
    const [query, setQuery] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    const totalResults = useMemo(() => {
        if (!query || query.length < 2) return 0;
        const regex = new RegExp(query, 'gi');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }, [query, text]);

    const goToNext = useCallback(() => {
        if (totalResults > 0) {
            setCurrentIndex((prev) => (prev + 1) % totalResults);
        }
    }, [totalResults]);

    const goToPrevious = useCallback(() => {
        if (totalResults > 0) {
            setCurrentIndex((prev) => (prev - 1 + totalResults) % totalResults);
        }
    }, [totalResults]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setCurrentIndex(0);
    }, []);

    return {
        query,
        setQuery,
        currentIndex,
        totalResults,
        goToNext,
        goToPrevious,
        clearSearch
    };
}
