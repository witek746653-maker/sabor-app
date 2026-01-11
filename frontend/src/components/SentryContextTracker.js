import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { setUserContext, setTags, setContext } from '../utils/sentry';

/**
 * Компонент для автоматического отслеживания контекста в Sentry
 * 
 * Этот компонент отслеживает:
 * - Текущую страницу (URL)
 * - Роль пользователя (guest, официант, администратор)
 * - Действия пользователя (навигация)
 * 
 * Всё это автоматически добавляется к каждой отправляемой ошибке,
 * чтобы вы могли понять, где и у кого произошла ошибка.
 */
function SentryContextTracker() {
  const location = useLocation();
  const { currentUser, isAuthenticated } = useAuth();

  // Обновляем контекст при изменении страницы или пользователя
  useEffect(() => {
    // Устанавливаем контекст пользователя
    if (currentUser && isAuthenticated) {
      setUserContext(currentUser);
    } else {
      // Если пользователь не авторизован, устанавливаем роль "guest"
      setUserContext({ role: 'guest' });
    }
  }, [currentUser, isAuthenticated]);

  // Обновляем теги и контекст при изменении маршрута
  useEffect(() => {
    // Получаем имя страницы из пути
    const pathname = location.pathname;
    const pathParts = pathname.split('/').filter(Boolean);
    const pageName = pathParts[0] || 'home';
    
    // Устанавливаем теги для фильтрации ошибок в Sentry
    setTags({
      page: pageName,
      route: pathname,
    });
    
    // Устанавливаем дополнительный контекст
    setContext('navigation', {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      page: pageName,
    });
  }, [location]);

  // Этот компонент ничего не рендерит (null)
  // Он только отслеживает изменения и обновляет контекст Sentry
  return null;
}

export default SentryContextTracker;
