import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Language Context Provider - NEW
import { LanguageProvider } from './contexts/LanguageContext';

// Theme Context Provider - DARK MODE SUPPORT
import { ThemeProvider } from './contexts/ThemeContext';

// Credit Context Provider - PRODUCTION READY
import { CreditProvider } from './contexts/CreditContext';

// Notification Context Provider
import { NotificationProvider } from './contexts/NotificationContext';

// Error Boundary
import ErrorBoundary from './components/ErrorBoundary';

// Components & pages
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BatchesPage from './pages/Batches';
import BatchDetailPage from './pages/BatchDetail';
import ImportPage from './pages/Import';
import IntegrationsPage from './pages/Integrations';
import ApiTokensPage from './pages/ApiTokens';
import SettingsPage from './pages/Settings';
import BillingPage from './pages/Billing';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import ForgotPasswordPage from './pages/ForgotPassword';
import NotFoundPage from './pages/NotFound';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

// CRM Pages - New unified CRM system
import CRMPage from './pages/CRM';

function App() {
  console.log('🚀 App component is loading...');
  
  const hasToken = () =>
    Boolean(
      localStorage.getItem('captely_jwt') ||
      sessionStorage.getItem('captely_jwt')
    );

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasToken());

  console.log('🔐 Authentication status:', isAuthenticated);

  useEffect(() => {
    const onStorage = () => setIsAuthenticated(hasToken());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleLogin = () => {
    console.log('✅ Login successful');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    console.log('👋 Logging out');
    localStorage.removeItem('captely_jwt');
    sessionStorage.removeItem('captely_jwt');
    setIsAuthenticated(false);
  };

  console.log('📄 Rendering App with authentication:', isAuthenticated);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <CreditProvider>
            <Router>
              <Toaster position="top-right" />

          <Routes>
            {/* Legal pages - always accessible */}
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />

            {/* Public */}
            {!isAuthenticated && (
              <>
                <Route
                  path="/login"
                  element={<LoginPage onLogin={handleLogin} />}
                />
                <Route path="/signup" element={<SignupPage onLogin={handleLogin} />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            )}

            {/* Protected */}
            {isAuthenticated && (
              <>
                <Route element={
                  <NotificationProvider>
                    <Layout onLogout={handleLogout} />
                  </NotificationProvider>
                }>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/batches" element={<BatchesPage />} />
                  <Route path="/batches/:jobId" element={<BatchDetailPage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/api-tokens" element={<ApiTokensPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  
                  {/* CRM Routes */}
                  <Route path="/crm" element={<CRMPage />} />
                  
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/signup" element={<Navigate to="/" replace />} />
                <Route path="/forgot-password" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </Router>
      </CreditProvider>
    </LanguageProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
