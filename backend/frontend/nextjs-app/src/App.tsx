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
import ApiTokensPage from './pages/ApiTokens';
import SettingsPage from './pages/Settings';
import BillingPage from './pages/Billing';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import NotFoundPage from './pages/NotFound';

// CRM Pages - We'll create placeholder components for now
const ContactsPage = React.lazy(() => import('./pages/crm/Contacts'));
const ActivitiesPage = React.lazy(() => import('./pages/crm/Activities'));
const CampaignsPage = React.lazy(() => import('./pages/crm/Campaigns'));

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
            <Route path="/signup" element={<SignupPage onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}

        {/* Protected */}
        {isAuthenticated && (
          <>
            <Route element={<Layout onLogout={handleLogout} />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/api-tokens" element={<ApiTokensPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/billing" element={<BillingPage />} />
              
              {/* CRM Routes */}
              <Route path="/crm/contacts" element={
                <React.Suspense fallback={<div>Loading...</div>}>
                  <ContactsPage />
                </React.Suspense>
              } />
              <Route path="/crm/activities" element={
                <React.Suspense fallback={<div>Loading...</div>}>
                  <ActivitiesPage />
                </React.Suspense>
              } />
              <Route path="/crm/campaigns" element={
                <React.Suspense fallback={<div>Loading...</div>}>
                  <CampaignsPage />
                </React.Suspense>
              } />
              
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
