import { useEffect, useState } from 'react';

/**
 * useSafeAreaInsets (safe-area от iOS)
 * @returns {{top:number,right:number,bottom:number,left:number}}
 */
export default function useSafeAreaInsets() {
  const [insets, setInsets] = useState({ top: 0, right: 0, bottom: 0, left: 0 });

  useEffect(() => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position: absolute',
      'left: 0',
      'top: 0',
      'padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      'visibility: hidden',
      'pointer-events: none',
    ].join(';');
    document.body.appendChild(el);

    const read = () => {
      const style = getComputedStyle(el);
      const toNum = (v) => parseFloat(v || '0') || 0;
      setInsets({
        top: toNum(style.paddingTop),
        right: toNum(style.paddingRight),
        bottom: toNum(style.paddingBottom),
        left: toNum(style.paddingLeft),
      });
    };

    read();
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('resize', read);
      document.body.removeChild(el);
    };
  }, []);

  return insets;
}
