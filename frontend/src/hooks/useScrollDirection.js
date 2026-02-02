import { useState, useEffect } from 'react';

export function useScrollDirection({ threshold = 10 } = {}) {
    const [scrollDirection, setScrollDirection] = useState('up');
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        let lastScrollY = window.pageYOffset;
        let ticking = false;

        const updateScrollDirection = () => {
            const currentScrollY = window.pageYOffset;

            if (Math.abs(currentScrollY - lastScrollY) < threshold) {
                ticking = false;
                return;
            }

            const direction = currentScrollY > lastScrollY ? 'down' : 'up';

            if (direction !== scrollDirection && (currentScrollY > 0 || direction === 'up')) {
                setScrollDirection(direction);
            }

            setScrollY(currentScrollY);
            lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
            ticking = false;
        };

        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScrollDirection);
                ticking = true;
            }
        };

        window.addEventListener('scroll', onScroll);

        return () => window.removeEventListener('scroll', onScroll);
    }, [scrollDirection, threshold]);

    return { scrollDirection, scrollY };
}
