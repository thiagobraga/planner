import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { InboxPage } from './pages/InboxPage';
import { DailyIndexRedirect, DailyRoute } from './pages/DailyRoutes';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { getAppTitle } from './utils/environment';
import { safeNextPath } from './utils/safeNext';
import { OAuthConsentPage } from './pages/OAuthConsentPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';

const HabitsPage = lazy(() => import('./pages/HabitsPage').then((module) => ({ default: module.HabitsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const StyleguidePage = lazy(() => import('./pages/StyleguidePage').then((module) => ({ default: module.StyleguidePage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then((module) => ({ default: module.HelpPage })));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage').then((module) => ({ default: module.ChangelogPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AdminComparePage = lazy(() => import('./pages/admin/AdminComparePage').then((module) => ({ default: module.AdminComparePage })));
const CollectionsLayout = lazy(() => import('./pages/CollectionsLayout').then((module) => ({ default: module.CollectionsLayout })));
const CollectionsLanding = lazy(() => import('./pages/CollectionsLayout').then((module) => ({ default: module.CollectionsLanding })));
const CollectionsDetailRoute = lazy(() => import('./pages/CollectionsLayout').then((module) => ({ default: module.CollectionsDetailRoute })));

function RouteContent() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
      <Outlet />
    </Suspense>
  );
}

/** A signed-in visit to /login goes where the sign-in was meant to lead. */
function AfterLogin() {
  const [searchParams] = useSearchParams();
  return <Navigate to={safeNextPath(searchParams.get('next')) ?? '/daily'} replace />;
}

/** Sends a signed-out visitor to log in, then straight back here. */
function LoginFirst() {
  const location = useLocation();
  return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/login" element={isAuthenticated ? <AfterLogin /> : <LoginPage />} />
        <Route path="/oauth/consent" element={isAuthenticated ? <OAuthConsentPage /> : <LoginFirst />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/daily" replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/daily" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={isAuthenticated ? <Navigate to="/daily" replace /> : <ResetPasswordPage />} />
        <Route element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />}>
          <Route element={<RouteContent />}>
            <Route path="/" element={<Navigate to="/daily" replace />} />
            <Route path="/today" element={<Navigate to="/daily" replace />} />
            <Route path="/daily" element={<DailyIndexRedirect />} />
            <Route path="/daily/:view" element={<DailyRoute />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
            <Route path="/settings/:section" element={<SettingsPage />} />
            <Route path="/styleguide" element={isAdmin ? <StyleguidePage /> : <Navigate to="/daily" replace />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
            <Route element={<CollectionsLayout />}>
              <Route path="/collections" element={<CollectionsLanding />} />
              <Route path="/collection/:id" element={<CollectionsDetailRoute />} />
            </Route>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route
              path="/admin/dashboard"
              element={isAdmin ? <AdminDashboardPage /> : <Navigate to="/daily" replace />}
            />
            <Route
              path="/admin/users"
              element={isAdmin ? <AdminUsersPage /> : <Navigate to="/daily" replace />}
            />
            <Route
              path="/admin/compare"
              element={isAdmin ? <AdminComparePage /> : <Navigate to="/daily" replace />}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  useEffect(() => {
    const title = getAppTitle();
    document.title = title;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AppRoutes />
          <OfflineIndicator />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
