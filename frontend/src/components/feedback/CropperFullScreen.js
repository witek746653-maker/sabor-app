import React, { useEffect, useRef, useState } from 'react';
import styles from './FeedbackWidget.module.css';
import { cropImageToFile } from '../../utils/cropImageToFile';

/**
 * @param {{
 *  src: string,
 *  onCancel: () => void,
 *  onDone: (file: File) => void
 * }} props
 */
export default function CropperFullScreen({ src, onCancel, onDone }) {
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [display, setDisplay] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (!imgRef.current) return;
      const box = imgRef.current.getBoundingClientRect();
      setDisplay({ w: box.width, h: box.height });
      if (!ready) return;
      setRect((r) => ({
        x: Math.min(r.x, Math.max(0, box.width - r.w)),
        y: Math.min(r.y, Math.max(0, box.height - r.h)),
        w: Math.min(r.w, box.width),
        h: Math.min(r.h, box.height),
      }));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [ready]);

  const initRect = () => {
    if (!imgRef.current) return;
    const box = imgRef.current.getBoundingClientRect();
    const w = Math.max(120, box.width * 0.7);
    const h = Math.max(120, box.height * 0.7);
    setRect({
      x: Math.max(0, (box.width - w) / 2),
      y: Math.max(0, (box.height - h) / 2),
      w,
      h,
    });
    setDisplay({ w: box.width, h: box.height });
    setReady(true);
  };

  const clampRect = (next) => {
    const minSize = 120;
    const w = Math.max(minSize, Math.min(next.w, display.w));
    const h = Math.max(minSize, Math.min(next.h, display.h));
    const x = Math.min(Math.max(0, next.x), Math.max(0, display.w - w));
    const y = Math.min(Math.max(0, next.y), Math.max(0, display.h - h));
    return { x, y, w, h };
  };

  const startDrag = (type, e) => {
    e.preventDefault();
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...rect },
    };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
  };

  const onDragMove = (e) => {
    if (!dragRef.current) return;
    const { type, startX, startY, startRect } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let next = { ...startRect };

    if (type === 'move') {
      next.x = startRect.x + dx;
      next.y = startRect.y + dy;
      setRect(clampRect(next));
      return;
    }

    if (type.includes('e')) next.w = startRect.w + dx;
    if (type.includes('s')) next.h = startRect.h + dy;
    if (type.includes('w')) {
      next.x = startRect.x + dx;
      next.w = startRect.w - dx;
    }
    if (type.includes('n')) {
      next.y = startRect.y + dy;
      next.h = startRect.h - dy;
    }

    setRect(clampRect(next));
  };

  const endDrag = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
  };

  const handleDone = async () => {
    const img = imgRef.current;
    if (!img || !display.w || !display.h) return;
    const scaleX = img.naturalWidth / display.w;
    const scaleY = img.naturalHeight / display.h;
    const crop = {
      x: Math.round(rect.x * scaleX),
      y: Math.round(rect.y * scaleY),
      w: Math.round(rect.w * scaleX),
      h: Math.round(rect.h * scaleY),
    };
    const file = await cropImageToFile(img, crop, `screenshot-${Date.now()}.png`);
    onDone(file);
  };

  return (
    <div className={styles.cropperOverlay} role="dialog" aria-modal="true">
      <div className={styles.cropperHeader}>Выделите область</div>
      <div className={styles.cropperCanvasArea} ref={containerRef}>
        <img
          ref={imgRef}
          src={src}
          alt=""
          className={styles.cropperImage}
          onLoad={initRect}
        />
        {ready && (
          <div
            className={styles.cropRect}
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            onPointerDown={(e) => startDrag('move', e)}
          >
            {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((pos) => {
              const stylesMap = {
                nw: { left: 0, top: 0 },
                n: { left: '50%', top: 0 },
                ne: { right: 0, top: 0 },
                e: { right: 0, top: '50%' },
                se: { right: 0, bottom: 0 },
                s: { left: '50%', bottom: 0 },
                sw: { left: 0, bottom: 0 },
                w: { left: 0, top: '50%' },
              };
              return (
                <span
                  key={pos}
                  className={styles.cropHandle}
                  style={stylesMap[pos]}
                  onPointerDown={(e) => startDrag(pos, e)}
                />
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.cropperFooter}>
        <button className={`${styles.cropperButton} ${styles.cropperCancel}`} onClick={onCancel} type="button">
          Отмена
        </button>
        <button className={`${styles.cropperButton} ${styles.cropperDone}`} onClick={handleDone} type="button">
          Готово
        </button>
      </div>
    </div>
  );
}
