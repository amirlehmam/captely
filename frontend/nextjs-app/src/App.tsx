// src/App.tsx
import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Components & pages
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BatchesPage from './pages/Batches';
import ImportPage from './pages/Import';
import IntegrationsPage from './pages/Integrations';
import SettingsPage from './pages/Settings';
import BillingPage from './pages/Billing';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import NotFoundPage from './pages/NotFound';

function App() {
  // Helper to read the JWT
  const hasToken = () =>
    Boolean(
      localStorage.getItem('captely_jwt') ||
      sessionStorage.getItem('captely_jwt')
    );

  // Real auth state derived from storage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasToken());

  // Keep auth state in sync if someone calls localStorage directly
  useEffect(() => {
    const onStorage = () => setIsAuthenticated(hasToken());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Called by LoginPage once it’s stored the JWT
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  // (Optional) you might wire a logout in your Layout
  const handleLogout = () => {
    localStorage.removeItem('captely_jwt');
    sessionStorage.removeItem('captely_jwt');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Toaster position="top-right" />

      <Routes>
        {/* Public */}
        {!isAuthenticated && (
          <>
            <Route
              path="/login"
              element={<LoginPage onLogin={handleLogin} />}
            />
            <Route
              path="/signup"
              element={<SignupPage />}
            />
            {/* Redirect anything else to login */}
            <Route
              path="*"
              element={<Navigate to="/login" replace />}
            />
          </>
        )}

        {/* Protected */}
        {isAuthenticated && (
          <>
            {/* All protected routes share the Layout */}
            <Route element={<Layout onLogout={handleLogout} />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            {/* If someone hits /login or /signup while logged in, send them home */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
