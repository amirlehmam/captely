import React, { useState } from 'react';
import apiService from '../services/api';

const DebugNotifications: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testNotificationAPI = async () => {
    setLoading(true);
    try {
      console.log('🧪 DEBUG: Testing notification API...');
      console.log('🧪 DEBUG: Is authenticated:', apiService.isAuthenticated());
      console.log('🧪 DEBUG: JWT token exists:', !!localStorage.getItem('captely_jwt'));
      
      const response = await apiService.getNotifications();
      console.log('🧪 DEBUG: Response received:', response);
      setResult({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('🧪 DEBUG: Error occurred:', error);
      setResult({
        success: false,
        error: {
          name: error.name,
          message: error.message,
          status: error.status,
          stack: error.stack
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const testDirectFetch = async () => {
    setLoading(true);
    try {
      console.log('🧪 DEBUG: Testing direct fetch...');
      const token = localStorage.getItem('captely_jwt');
      
      const response = await fetch('/api/notifications/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });
      
      console.log('🧪 DEBUG: Direct fetch response status:', response.status);
      console.log('🧪 DEBUG: Direct fetch response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('🧪 DEBUG: Direct fetch data:', data);
      
      setResult({
        success: response.ok,
        directFetch: true,
        status: response.status,
        data: data,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('🧪 DEBUG: Direct fetch error:', error);
      setResult({
        success: false,
        directFetch: true,
        error: {
          name: error.name,
          message: error.message
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 Notification API Debug Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={testNotificationAPI} disabled={loading}>
          Test Notification API (via ApiService)
        </button>
        <button onClick={testDirectFetch} disabled={loading} style={{ marginLeft: '10px' }}>
          Test Direct Fetch
        </button>
      </div>

      {loading && <p>⏳ Loading...</p>}

      {result && (
        <div style={{ 
          background: '#f5f5f5', 
          border: '1px solid #ddd', 
          padding: '20px',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <h3>{result.success ? '✅ Success' : '❌ Error'}</h3>
          <pre style={{ 
            background: '#fff', 
            border: '1px solid #ccc', 
            padding: '10px',
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '30px', fontSize: '12px', color: '#666' }}>
        <h4>Current Environment Info:</h4>
        <ul>
          <li>Origin: {window.location.origin}</li>
          <li>Pathname: {window.location.pathname}</li>
          <li>Authenticated: {apiService.isAuthenticated() ? 'Yes' : 'No'}</li>
          <li>JWT Token: {localStorage.getItem('captely_jwt') ? 'Present' : 'Missing'}</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugNotifications; 