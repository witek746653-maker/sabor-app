import React, { useRef, useState } from 'react';
import ScreenshotCapture from './ScreenshotCapture';
import { compressImage } from '../../utils/compressImage';
import styles from './FeedbackWidget.module.css';

/**
 * @typedef {Object} FeedbackAttachment
 * @property {string} id
 * @property {File} file
 * @property {string} previewUrl
 * @property {'file'|'screenshot'} source
 */

/**
 * @param {{
 *  attachments: FeedbackAttachment[],
 *  onChange: (items: FeedbackAttachment[]) => void
 * }} props
 */
export default function AttachmentPicker({ attachments, onChange }) {
  const inputRef = useRef(null);
  const [reshootId, setReshootId] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  const addFiles = async (files, source) => {
    setIsCompressing(true);
    try {
      const list = Array.from(files || []);

      const processed = await Promise.all(
        list.map(async (file) => {
          // Если файл > 1MB, пробуем сжать
          if (file.size > 1024 * 1024) {
            return await compressImage(file);
          }
          return file;
        })
      );

      // Проверка размера (теперь проверяем уже после сжатия, 10МБ - за глаза)
      const tooBig = processed.find(f => f.size > 10 * 1024 * 1024);
      if (tooBig) {
        alert(`Файл "${tooBig.name}" всё еще слишком большой (>10MB) даже после сжатия.`);
        return;
      }

      const next = processed.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        source,
      }));
      onChange([...attachments, ...next]);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleAttach = (e) => {
    if (!e.target.files?.length) return;
    addFiles(e.target.files, 'file');
    e.target.value = '';
  };

  const handleRemove = (id) => {
    const item = attachments.find((a) => a.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onChange(attachments.filter((a) => a.id !== id));
  };

  const handleScreenshotAdd = (file) => {
    if (reshootId) {
      const prev = attachments.find((a) => a.id === reshootId);
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      const next = attachments.map((a) =>
        a.id === reshootId
          ? { ...a, file, previewUrl: URL.createObjectURL(file), source: 'screenshot' }
          : a
      );
      onChange(next);
      setReshootId('');
      return;
    }
    addFiles([file], 'screenshot');
  };

  const canCapture = typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';

  return (
    <div className={styles.attachmentsBlock}>
      <div className={styles.attachmentButtons}>
        <button
          className={styles.btn}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isCompressing}
        >
          {isCompressing ? 'Сжатие...' : 'Прикрепить'}
        </button>
        <ScreenshotCapture
          onAdd={handleScreenshotAdd}
          disabled={isCompressing}
        />
        {!canCapture && (
          <div className={styles.mobileHint}>
            {isCompressing ? 'Обработка изображения...' : 'Можно прикрепить скриншот из галереи'}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleAttach}
          hidden
        />
      </div>
      {reshootId && <div className={styles.metaNote}>Нажмите “Скриншот”, чтобы переснять</div>}

      {attachments.length > 0 && (
        <div className={styles.attachmentList}>
          {attachments.map((item) => (
            <div key={item.id} className={styles.attachmentItem}>
              <img src={item.previewUrl} alt="" className={styles.attachmentPreview} />
              <div className={styles.attachmentActions}>
                <button
                  type="button"
                  className={styles.miniButton}
                  onClick={() => handleRemove(item.id)}
                >
                  Удалить
                </button>
                {item.source === 'screenshot' && (
                  <button
                    type="button"
                    className={styles.miniButton}
                    onClick={() => setReshootId(item.id)}
                  >
                    Переснять
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
