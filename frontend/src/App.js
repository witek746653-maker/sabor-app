import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { VisibilityProvider, useVisibility } from './contexts/VisibilityContext';
import ErrorBoundary from './components/ErrorBoundary';
import SentryContextTracker from './components/SentryContextTracker';
import StatusBanner from './components/StatusBanner';
import FeedbackWidget from './components/feedback/FeedbackWidget';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import DishDetailPage from './pages/DishDetailPage';
import WineDetailPage from './pages/WineDetailPage';
import BarItemDetailPage from './pages/BarItemDetailPage';
import AdminLayout from './layouts/AdminLayout';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import DishesPage from './pages/admin/DishesPage';
import AdminDishEditPage from './pages/admin/DishEditPage';
import DishEditPage from './pages/DishEditPage';
import UsersPage from './pages/admin/UsersPage';
import FeedbackMessagesPage from './pages/admin/FeedbackMessagesPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import DeployPage from './pages/admin/DeployPage';
import AdminHelpPage from './pages/admin/AdminHelpPage';
import VisibilityPage from './pages/admin/VisibilityPage';
import MediaLikesPage from './pages/admin/MediaLikesPage';
import WineMenuPage from './pages/WineMenuPage';
import WineCatalogPage from './pages/WineCatalogPage';
import InfoPage from './pages/InfoPage';
import FavoritesPage from './pages/FavoritesPage';
import ArtGalleryPage from './pages/ArtGalleryPage';
import ArtDetailPage from './pages/ArtDetailPage';
import SearchPage from './pages/SearchPage';
import MediaPage from './pages/MediaPage';
import ArticlesListPage from './pages/ArticlesListPage';
import ArticleReaderPage from './pages/ArticleReaderPage';
import ToolsPage from './pages/ToolsPage';
import WineListBuilderPage from './pages/WineListBuilder/WineListBuilderPage';
import './App.css';
import { useFavorites } from './contexts/FavoritesContext';

// Компонент-защитник для админ-маршрутов
function AdminRoute({ children }) {
  const { isAuthenticated, currentUser, checking, isGuest } = useAuth();

  if (checking) {
    return (
      <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl font-bold">Проверка...</div>
      </div>
    );
  }

  // Гости и неавторизованные пользователи не могут заходить в админ-панель
  if (!isAuthenticated || isGuest || currentUser?.role !== 'администратор') {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

function VisibilityRoute({ scope, target, fallbackTo = '/', linkedMenuItemTarget = null, children }) {
  const { isVisible } = useVisibility();

  const routeAllowed = isVisible({ scope, target });
  const menuAllowed = linkedMenuItemTarget
    ? isVisible({ scope: 'menuItem', target: linkedMenuItemTarget })
    : true;

  if (!routeAllowed || !menuAllowed) {
    if (fallbackTo === null) {
      return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex items-center justify-center">
          <div className="text-text-secondary-light dark:text-text-secondary-dark text-base">
            Этот раздел скрыт настройками видимости.
          </div>
        </div>
      );
    }
    return <Navigate to={fallbackTo} replace />;
  }

  return children;
}

function FavoritesSyncOnRouteChange() {
  const location = useLocation();
  const { refreshFavorites } = useFavorites();

  React.useEffect(() => {
    refreshFavorites();
  }, [location.pathname, location.search, refreshFavorites]);

  return null;
}

function App() {
  return (
    // Error Boundary перехватывает все ошибки рендеринга React-компонентов
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <FavoritesProvider>
            <VisibilityProvider>
              <ToastProvider>
                <Router>
                  <div className="App">
                    <div className="sabor-container">
                      {/* Компонент для отслеживания контекста (страница, роль пользователя) */}
                      <SentryContextTracker />
                      {/* Индикатор статуса сервера/источника данных (виден и пользователю, и админу) */}
                      <StatusBanner />
                      <FeedbackWidget />
                      <FavoritesSyncOnRouteChange />
                      <Routes>
                        {/* Публичные маршруты */}
                        <Route
                          path="/"
                          element={
                            <VisibilityRoute
                              scope="route"
                              target="/"
                              linkedMenuItemTarget="footer.menu"
                              fallbackTo={null}
                            >
                              <HomePage />
                            </VisibilityRoute>
                          }
                        />
                        <Route path="/menu/:menuName" element={<MenuPage />} />
                        <Route path="/dish/:id" element={<DishDetailPage />} />
                        <Route path="/tea" element={<MenuPage mode="tea" />} />
                        <Route path="/tea/:id" element={<DishDetailPage mode="tea" />} />
                        <Route path="/tea/:id/edit" element={<DishEditPage mode="tea" />} />
                        <Route
                          path="/wine-menu"
                          element={
                            <VisibilityRoute scope="route" target="/wine-menu">
                              <WineMenuPage />
                            </VisibilityRoute>
                          }
                        />
                        <Route
                          path="/wine-catalog"
                          element={
                            <VisibilityRoute scope="route" target="/wine-catalog">
                              <WineCatalogPage />
                            </VisibilityRoute>
                          }
                        />
                        <Route
                          path="/wine-catalog/:category"
                          element={
                            <VisibilityRoute scope="route" target="/wine-catalog">
                              <WineCatalogPage />
                            </VisibilityRoute>
                          }
                        />
                        {/* Новые детальные страницы */}
                        <Route
                          path="/wine/:id"
                          element={
                            <VisibilityRoute scope="route" target="/wine/:id">
                              <WineDetailPage />
                            </VisibilityRoute>
                          }
                        />
                        <Route
                          path="/bar/:id"
                          element={
                            <VisibilityRoute scope="route" target="/bar/:id">
                              <BarItemDetailPage />
                            </VisibilityRoute>
                          }
                        />

                        {/* Совместимость со старыми ссылками (старые файлы не используем, только редирект) */}
                        <Route path="/wine-item/:id" element={<WineDetailPage />} />
                        <Route path="/bar-menu" element={<Navigate to={`/menu/${encodeURIComponent('Барное меню')}`} replace />} />
                        <Route
                          path="/info"
                          element={
                            <VisibilityRoute
                              scope="route"
                              target="/info"
                              linkedMenuItemTarget="footer.tools"
                            >
                              <InfoPage />
                            </VisibilityRoute>
                          }
                        />
                        <Route path="/media" element={<MediaPage />} />
                        <Route
                          path="/favorites"
                          element={
                            <VisibilityRoute
                              scope="route"
                              target="/favorites"
                              linkedMenuItemTarget="footer.favorites"
                            >
                              <FavoritesPage />
                            </VisibilityRoute>
                          }
                        />
                        <Route
                          path="/search"
                          element={
                            <VisibilityRoute
                              scope="route"
                              target="/search"
                              linkedMenuItemTarget="footer.search"
                              fallbackTo={null}
                            >
                              <SearchPage />
                            </VisibilityRoute>
                          }
                        />
                        {/* Галерея картин */}
                        <Route path="/art-gallery" element={<ArtGalleryPage />} />
                        <Route path="/art/:id" element={<ArtDetailPage />} />

                        {/* Раздел статей/журнала */}
                        <Route path="/useful" element={<ArticlesListPage />} />
                        <Route path="/article/:articleKey" element={<ArticleReaderPage />} />
                        <Route path="/tools" element={<ToolsPage />} />
                        <Route path="/wine-list-builder" element={<WineListBuilderPage />} />

                        {/* Страница входа в админ-панель */}
                        <Route path="/admin/login" element={<AdminLoginPage />} />

                        {/* Админ-маршруты с защитой и layout */}
                        <Route
                          path="/admin"
                          element={
                            <AdminRoute>
                              <AdminLayout />
                            </AdminRoute>
                          }
                        >
                          {/* Вложенные маршруты отображаются в центральной области AdminLayout */}
                          <Route index element={<Navigate to="kitchen" replace />} />
                          <Route path="kitchen" element={<DishesPage mode="kitchen" />} />
                          <Route path="wine" element={<DishesPage mode="wine" />} />
                          <Route path="bar" element={<DishesPage mode="bar" />} />
                          <Route path="tea" element={<DishesPage mode="tea" />} />
                          <Route path="edit/:id" element={<AdminDishEditPage />} />
                          <Route path="add" element={<AdminDishEditPage />} />
                          <Route path="users" element={<UsersPage />} />
                          <Route path="feedback" element={<FeedbackMessagesPage />} />
                          <Route path="notifications" element={<NotificationsPage />} />
                          <Route path="media" element={<MediaLikesPage />} />
                          <Route path="deploy" element={<DeployPage />} />
                          <Route path="visibility" element={<VisibilityPage />} />
                          <Route path="help" element={<AdminHelpPage />} />
                        </Route>
                      </Routes>
                    </div>
                  </div>
                </Router>
              </ToastProvider>
            </VisibilityProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

