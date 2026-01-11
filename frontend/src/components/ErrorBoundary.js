import React from 'react';
import * as Sentry from '@sentry/react';

/**
 * Error Boundary - это специальный компонент React, который перехватывает ошибки,
 * возникающие при рендеринге дочерних компонентов.
 * 
 * Без Error Boundary, любая ошибка в компоненте приведет к полному падению всего приложения.
 * Error Boundary позволяет "поймать" ошибку и показать пользователю fallback UI,
 * при этом остальная часть приложения продолжит работать.
 */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    // Состояние для хранения информации об ошибке
    this.state = { hasError: false, error: null };
  }

  // Этот метод вызывается, когда в дочернем компоненте происходит ошибка
  static getDerivedStateFromError(error) {
    // Обновляем состояние, чтобы показать fallback UI
    return { hasError: true, error };
  }

  // Этот метод вызывается после того, как ошибка была обработана
  componentDidCatch(error, errorInfo) {
    // Логируем ошибку в Sentry (если включен)
    // errorInfo содержит дополнительную информацию об ошибке (например, componentStack)
    if (window.Sentry) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
    
    // Также логируем в консоль для разработки
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    // Если есть ошибка, показываем fallback UI
    if (this.state.hasError) {
      // Можно показать красивый экран с ошибкой, но пользователю не нужно видеть технические детали
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f5f5f5',
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#333' }}>
            Что-то пошло не так
          </h1>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }}>
            Произошла ошибка при загрузке страницы. Мы уже работаем над исправлением.
          </p>
          <button
            onClick={() => {
              // Обновляем страницу, чтобы попробовать загрузить её заново
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Обновить страницу
          </button>
        </div>
      );
    }

    // Если ошибки нет, рендерим дочерние компоненты как обычно
    return this.props.children;
  }
}

export default ErrorBoundary;
