import { useState, useEffect } from 'react';

export function useReadingProgress(ref) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const updateProgress = () => {
            if (!ref.current) return;

            const element = ref.current;
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

            // Вычисляем процент прокрутки всей страницы, так как контент может быть длинным
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight;
            const scrolled = window.scrollY;

            if (fullHeight <= windowHeight) {
                setProgress(100);
            } else {
                const percentage = (scrolled / (fullHeight - windowHeight)) * 100;
                setProgress(Math.min(100, Math.max(0, percentage)));
            }
        };

        window.addEventListener('scroll', updateProgress);
        window.addEventListener('resize', updateProgress);

        // Начальный расчет
        updateProgress();

        return () => {
            window.removeEventListener('scroll', updateProgress);
            window.removeEventListener('resize', updateProgress);
        };
    }, [ref]);

    return progress;
}
