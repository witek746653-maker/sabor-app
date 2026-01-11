import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// Инициализируем Sentry ПЕРЕД рендером приложения
import { initSentry } from './utils/sentry';

// Инициализируем автоматический сбор ошибок
initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

