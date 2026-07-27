import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { OfflineIndicator } from './components/OfflineIndicator';
import { UpdateToast } from './components/UpdateToast';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { InboxPage } from './pages/InboxPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { CollectionsIndexPage } from './pages/CollectionsIndexPage';
import { DailyPage } from './pages/DailyPage';
import { HabitsPage } from './pages/HabitsPage';
import { MonthlyPage } from './pages/MonthlyPage';
import { SettingsPage } from './pages/SettingsPage';
import { StyleguidePage } from './pages/StyleguidePage';
import { HelpPage } from './pages/HelpPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { I18nProvider } from './i18n/I18nContext';

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/daily" replace /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/daily" replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/daily" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={isAuthenticated ? <Navigate to="/daily" replace /> : <ResetPasswordPage />} />
        <Route element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<Navigate to="/daily" replace />} />
          <Route path="/today" element={<Navigate to="/daily" replace />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/monthly" element={<MonthlyPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/styleguide" element={<StyleguidePage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/collections" element={<CollectionsIndexPage />} />
          <Route path="/collection/:id" element={<CollectionsPage />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route
            path="/admin/dashboard"
            element={isAdmin ? <AdminDashboardPage /> : <Navigate to="/daily" replace />}
          />
          <Route
            path="/admin/users"
            element={isAdmin ? <AdminUsersPage /> : <Navigate to="/daily" replace />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AppRoutes />
          <OfflineIndicator />
          <UpdateToast />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
