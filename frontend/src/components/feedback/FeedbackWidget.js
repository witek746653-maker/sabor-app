import React, { useEffect, useRef, useState } from 'react';
import FeedbackEdgeTab from './FeedbackEdgeTab';
import FeedbackSheet from './FeedbackSheet';
import AttachmentPicker from './AttachmentPicker';
import useScrollIdle from '../../hooks/useScrollIdle';
import useSafeAreaInsets from '../../hooks/useSafeAreaInsets';
import { sendReport } from '../../services/api';
import styles from './FeedbackWidget.module.css';

const STRINGS = {
  title: 'Сообщить о проблеме',
  typeLabel: 'Тип обращения',
  types: [
    { id: 'bug', label: 'Не работает' },
    { id: 'error', label: 'Ошибка текста' },
    { id: 'wrong', label: 'Работает неправильно' },
    { id: 'idea', label: 'Улучшение' },
    { id: 'question', label: 'Вопрос' },
  ],
  messageLabel: 'Что не так?',
  attachLabel: 'Вложения',
  send: 'Отправить',
  sending: 'Отправка...',
  success: 'Спасибо! Сообщение отправлено.',
  error: 'Не удалось отправить. Повторить?',
  offlineSaved: 'Оффлайн: сообщение сохранено и отправится при сети.',
};

const QUEUE_KEY = 'sabor.feedback.queue.v1';
const MAX_QUEUE = 5;
const MAX_OFFLINE_ATTACHMENT_MB = 2;

/**
 * @typedef {Object} FeedbackAttachment
 * @property {string} id
 * @property {File} file
 * @property {string} previewUrl
 * @property {'file'|'screenshot'} source
 */

/**
 * @typedef {Object} FeedbackPayload
 * @property {string} message
 * @property {string[]} tags
 * @property {string} url
 * @property {string} ts
 * @property {string} userAgent
 * @property {{w:number,h:number}} viewport
 * @property {File[]} attachments
 * @property {string=} build
 */

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveQueue(items) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(0, MAX_QUEUE)));
  } catch {
    // ignore
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, name) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('bug');

  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [showTab, setShowTab] = useState(false);
  const isIdle = useScrollIdle(220);
  const safe = useSafeAreaInsets();
  const flushRef = useRef(false);
  const historyAddedRef = useRef(false);
  const closeByPopRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setShowTab(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onPop = () => {
      closeByPopRef.current = true;
      setOpen(false);
    };
    window.history.pushState({ feedback: true }, '');
    historyAddedRef.current = true;
    window.addEventListener('popstate', onPop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('popstate', onPop);
      if (historyAddedRef.current && !closeByPopRef.current) {
        window.history.back();
      }
      historyAddedRef.current = false;
      closeByPopRef.current = false;
    };
  }, [open]);

  const canShowTab = showTab && isIdle && !open;

  const buildPayload = () => {
    // Пытаемся найти имя пользователя в разных глобальных переменных
    const userName = window.USER_DATA?.name ||
      window.__USER__?.name ||
      window.currentUser?.name ||
      'Гость';

    return {
      message: message.trim(),
      type,
      name: userName,
      url: decodeURIComponent(window.location.href), // Отправляем уже красивую ссылку
      ts: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      attachments: attachments.map((a) => a.file),
      build: process.env.REACT_APP_BUILD_VERSION || undefined,
    };
  };

  const clearForm = () => {
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setMessage('');
    setType('bug');
    setAttachments([]);
  };

  const enqueueOffline = async (payload) => {
    const queue = loadQueue();
    const files = payload.attachments || [];
    for (const file of files) {
      const maxBytes = MAX_OFFLINE_ATTACHMENT_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        throw new Error('Слишком большой файл для оффлайн-очереди');
      }
    }
    const attachmentsData = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type,
        dataUrl: await fileToDataUrl(file),
      }))
    );
    queue.unshift({ payload: { ...payload, attachments: [] }, attachmentsData });
    saveQueue(queue.slice(0, MAX_QUEUE));
  };

  const flushQueue = async () => {
    if (flushRef.current) return;
    if (!navigator.onLine) return;
    const queue = loadQueue();
    if (queue.length === 0) return;
    flushRef.current = true;
    try {
      for (const item of queue) {
        const files = (item.attachmentsData || []).map((a) => dataUrlToFile(a.dataUrl, a.name));
        await sendReport({ ...item.payload, attachments: files });
      }
      saveQueue([]);
    } catch {
      // оставляем
    } finally {
      flushRef.current = false;
    }
  };

  useEffect(() => {
    const onOnline = () => flushQueue();
    window.addEventListener('online', onOnline);
    flushQueue();
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Введите сообщение');
      return;
    }
    setError('');
    setStatus('sending');
    const payload = buildPayload();

    try {
      if (!navigator.onLine) {
        await enqueueOffline(payload);
        setStatus('success');
        setError(STRINGS.offlineSaved);
        clearForm();
        return;
      }
      await sendReport(payload);
      setStatus('success');
      clearForm();
      setTimeout(() => {
        setOpen(false);
        setTimeout(() => setStatus('idle'), 500);
      }, 2000);
    } catch (e) {
      setStatus('error');
      setError(STRINGS.error);
    }
  };

  return (
    <>
      <FeedbackEdgeTab
        onOpen={() => setOpen(true)}
        visible={canShowTab}
        safeRight={safe.right}
      />
      {open && (
        <FeedbackSheet open={open} onClose={() => setOpen(false)} safeBottom={safe.bottom}>
          <div className={styles.sheetBody}>
            <div className={styles.label}>{STRINGS.typeLabel}</div>
            <div className={styles.typeSelector}>
              {STRINGS.types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.typeBtn} ${type === t.id ? styles.typeBtnActive : ''}`}
                  onClick={() => setType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className={styles.label}>{STRINGS.messageLabel}</label>
            <textarea
              className={styles.textarea}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Опишите подробнее..."
            />

            <div className={styles.metaNote}>{STRINGS.attachLabel}</div>
            <AttachmentPicker attachments={attachments} onChange={setAttachments} />

            <div className={styles.metaNote}>Технические данные</div>
            <div className={styles.contextBlock}>
              <div className={styles.contextItem}>
                <span className={styles.contextLabel}>Страница:</span>
                <span className={styles.contextValue}>{decodeURIComponent(window.location.pathname)}</span>
              </div>
              <div className={styles.contextItem}>
                <span className={styles.contextLabel}>Устройство:</span>
                <span className={styles.contextValue}>
                  {navigator.platform}, {window.innerWidth}x{window.innerHeight}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.stickyFooter}>
            <button
              className={styles.submitButton}
              type="button"
              onClick={handleSubmit}
              disabled={status === 'sending'}
              aria-label="Отправить сообщение"
            >
              {status === 'sending' ? STRINGS.sending : STRINGS.send}
            </button>
            {status === 'success' && !error && <div className={styles.statusMessage}>{STRINGS.success}</div>}
            {(status === 'error' || error) && <div className={styles.statusMessage}>{error}</div>}
          </div>
        </FeedbackSheet>
      )}
    </>
  );
}
