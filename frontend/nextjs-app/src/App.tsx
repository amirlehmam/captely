import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Components
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BatchesPage from './pages/Batches';
import ImportPage from './pages/Import';
import IntegrationsPage from './pages/Integrations';
import SettingsPage from './pages/Settings';
import BillingPage from './pages/Billing';
import LoginPage from './pages/Login';
import NotFoundPage from './pages/NotFound';

function App() {
  // Mock authentication state
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // Handle login
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route 
          path="/login" 
          element={<LoginPage onLogin={handleLogin} />} 
        />
        
        {isAuthenticated ? (
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/batches" element={<BatchesPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        ) : (
          <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
        )}
      </Routes>
    </Router>
  );
}

export default App;