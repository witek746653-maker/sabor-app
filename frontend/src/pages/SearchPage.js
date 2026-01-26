import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalSearch from '../components/GlobalSearch';

/**
 * Страница глобального поиска.
 *
 * Термин **маршрут (route)**: это адрес внутри приложения, например `/search`.
 * Здесь мы показываем поиск как отдельную страницу, чтобы он открывался с 1 клика
 * с любого экрана (особенно удобно на мобильном).
 */
export default function SearchPage() {
  const navigate = useNavigate();

  return (
    <GlobalSearch
      isOpen={true}
      // "Закрыть" возвращает туда, откуда пользователь пришёл.
      onClose={() => navigate(-1)}
    />
  );
}

