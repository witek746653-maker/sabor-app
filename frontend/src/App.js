import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import SentryContextTracker from './components/SentryContextTracker';
import StatusBanner from './components/StatusBanner';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import DishDetailPage from './pages/DishDetailPage';
import WineDetailPage from './pages/WineDetailPage';
import BarItemDetailPage from './pages/BarItemDetailPage';
import AdminLayout from './layouts/AdminLayout';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import DishesPage from './pages/admin/DishesPage';
import DishEditPage from './pages/admin/DishEditPage';
import UsersPage from './pages/admin/UsersPage';
import FeedbackMessagesPage from './pages/admin/FeedbackMessagesPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import DeployPage from './pages/admin/DeployPage';
import AdminHelpPage from './pages/admin/AdminHelpPage';
import WineMenuPage from './pages/WineMenuPage';
import WineCatalogPage from './pages/WineCatalogPage';
import ToolsPage from './pages/ToolsPage';
import FavoritesPage from './pages/FavoritesPage';
import './App.css';

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

function App() {
  return (
    // Error Boundary перехватывает все ошибки рендеринга React-компонентов
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="App">
            <div className="sabor-container">
              {/* Компонент для отслеживания контекста (страница, роль пользователя) */}
              <SentryContextTracker />
              {/* Индикатор статуса сервера/источника данных (виден и пользователю, и админу) */}
              <StatusBanner />
              <Routes>
                {/* Публичные маршруты */}
                <Route path="/" element={<HomePage />} />
                <Route path="/menu/:menuName" element={<MenuPage />} />
                <Route path="/dish/:id" element={<DishDetailPage />} />
                <Route path="/wine-menu" element={<WineMenuPage />} />
                <Route path="/wine-catalog" element={<WineCatalogPage />} />
                <Route path="/wine-catalog/:category" element={<WineCatalogPage />} />
                {/* Новые детальные страницы */}
                <Route path="/wine/:id" element={<WineDetailPage />} />
                <Route path="/bar/:id" element={<BarItemDetailPage />} />

                {/* Совместимость со старыми ссылками (старые файлы не используем, только редирект) */}
                <Route path="/wine-item/:id" element={<WineDetailPage />} />
                <Route path="/bar-menu" element={<Navigate to={`/menu/${encodeURIComponent('Барное меню')}`} replace />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />

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
                  <Route path="edit/:id" element={<DishEditPage />} />
                  <Route path="add" element={<DishEditPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="feedback" element={<FeedbackMessagesPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="deploy" element={<DeployPage />} />
                  <Route path="help" element={<AdminHelpPage />} />
                </Route>
              </Routes>
            </div>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

