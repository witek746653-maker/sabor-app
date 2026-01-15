import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// Инициализируем Sentry ПЕРЕД рендером приложения
import { initSentry } from './utils/sentry';
import { register as registerServiceWorker } from './serviceWorkerRegistration';

// Инициализируем автоматический сбор ошибок
initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: регистрируем service worker в production (после сборки)
registerServiceWorker();
