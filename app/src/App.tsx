import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LoginPage } from './pages/LoginPage';
import { InboxPage } from './pages/InboxPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { DailyPage } from './pages/DailyPage';
import { HabitsPage } from './pages/HabitsPage';
import { MonthlyPage } from './pages/MonthlyPage';
import { SettingsPage } from './pages/SettingsPage';
import { StyleguidePage } from './pages/StyleguidePage';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/daily" replace /> : <LoginPage />} />
        <Route element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<Navigate to="/daily" replace />} />
          <Route path="/today" element={<Navigate to="/daily" replace />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/monthly" element={<MonthlyPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/styleguide" element={<StyleguidePage />} />
          <Route path="/project/:id" element={<ProjectsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <OfflineIndicator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
