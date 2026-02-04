import { useEffect, useState } from 'react';

/**
 * useScrollIdle (idle = нет активного скролла)
 * @param {number} delayMs
 * @returns {boolean}
 */
export default function useScrollIdle(delayMs = 200) {
  const [isIdle, setIsIdle] = useState(true);

  useEffect(() => {
    let timeoutId = null;

    const handleScroll = () => {
      if (isIdle) setIsIdle(false);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsIdle(true), delayMs);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [delayMs, isIdle]);

  return isIdle;
}
