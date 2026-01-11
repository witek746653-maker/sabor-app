import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import SentryContextTracker from './components/SentryContextTracker';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import DishDetailPage from './pages/DishDetailPage';
import AdminLayout from './layouts/AdminLayout';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import DishesPage from './pages/admin/DishesPage';
import DishEditPage from './pages/admin/DishEditPage';
import UsersPage from './pages/admin/UsersPage';
import FeedbackMessagesPage from './pages/admin/FeedbackMessagesPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import WineMenuPage from './pages/WineMenuPage';
import WineCatalogPage from './pages/WineCatalogPage';
import WineItemPage from './pages/WineItemPage';
import BarMenuPage from './pages/BarMenuPage';
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
          {/* Компонент для отслеживания контекста (страница, роль пользователя) */}
          <SentryContextTracker />
          <div className="App">
            <Routes>
              {/* Публичные маршруты */}
              <Route path="/" element={<HomePage />} />
              <Route path="/menu/:menuName" element={<MenuPage />} />
              <Route path="/dish/:id" element={<DishDetailPage />} />
              <Route path="/wine-menu" element={<WineMenuPage />} />
              <Route path="/wine-catalog" element={<WineCatalogPage />} />
              <Route path="/wine-catalog/:category" element={<WineCatalogPage />} />
              <Route path="/wine-item/:id" element={<WineItemPage />} />
              <Route path="/bar-menu" element={<BarMenuPage />} />
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
                <Route index element={<DishesPage />} />
                <Route path="edit/:id" element={<DishEditPage />} />
                <Route path="add" element={<DishEditPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="feedback" element={<FeedbackMessagesPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
              </Route>
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

