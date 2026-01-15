// Service Worker — это "фоновый помощник" для PWA:
// он позволяет приложению работать "как приложение" (кэш, офлайн, установка).
// Это стандартный файл из шаблона Create React App, с короткими комментариями.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/
    )
);

export function register() {
  // Service Worker обычно работает только по HTTPS (или на localhost).
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
  if (publicUrl.origin !== window.location.origin) return;

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      // В localhost проверяем, что SW существует
      checkValidServiceWorker(swUrl);
      navigator.serviceWorker.ready.then(() => {
        // eslint-disable-next-line no-console
        console.log('Service worker готов (localhost).');
      });
    } else {
      registerValidSW(swUrl);
    }
  });
}

function registerValidSW(swUrl) {
  navigator.serviceWorker
    .register(swUrl)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Service worker зарегистрирован.');
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Ошибка регистрации service worker:', error);
    });
}

function checkValidServiceWorker(swUrl) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      // eslint-disable-next-line no-console
      console.log('Нет интернета. Приложение работает в офлайн-режиме, если было закэшировано.');
    });
}

