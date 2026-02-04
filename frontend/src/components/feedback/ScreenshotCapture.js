import React, { useState } from 'react';
import CropperFullScreen from './CropperFullScreen';
import styles from './FeedbackWidget.module.css';

/**
 * @param {{onAdd: (file: File) => void}} props
 */
export default function ScreenshotCapture({ onAdd }) {
  const [captureSrc, setCaptureSrc] = useState('');
  const [error, setError] = useState('');

  const canCapture = typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';

  const takeScreenshot = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;

      const dataUrl = canvas.toDataURL('image/png');
      setCaptureSrc(dataUrl);
    } catch (e) {
      setError('Скриншот недоступен');
    }
  };

  if (!canCapture) {
    return null;
  }

  return (
    <>
      <button className={styles.btn} type="button" onClick={takeScreenshot}>
        Скриншот
      </button>
      {error && <div className={styles.metaNote}>{error}</div>}
      {captureSrc && (
        <CropperFullScreen
          src={captureSrc}
          onCancel={() => setCaptureSrc('')}
          onDone={(file) => {
            onAdd(file);
            setCaptureSrc('');
          }}
        />
      )}
    </>
  );
}
