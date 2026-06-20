import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { InboxPage } from './pages/InboxPage';
import { TodayPage } from './pages/TodayPage';
import { HabitsPage } from './pages/HabitsPage';
import { MonthlyPage } from './pages/MonthlyPage';
import { StyleguidePage } from './pages/StyleguidePage';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/monthly" element={<MonthlyPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/styleguide" element={<StyleguidePage />} />
          <Route path="/project/:id" element={<InboxPage />} />
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
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
