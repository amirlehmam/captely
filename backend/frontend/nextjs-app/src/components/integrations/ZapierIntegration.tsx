import React, { useState, useEffect } from 'react';
import { Link, Download, Upload, Activity, AlertCircle, CheckCircle, Clock, Trash2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

interface ZapierIntegrationProps {
  onStatusChange?: (connected: boolean) => void;
}

interface IntegrationStatus {
  connected: boolean;
  webhook_url?: string;
  zap_id?: string;
  webhook_url_masked?: string;
  connected_at?: string;
}

interface SyncLog {
  sync_type: string;
  operation: string;
  status: string;
  total_records: number;
  processed_records: number;
  failed_records: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

const ZapierIntegration: React.FC<ZapierIntegrationProps> = ({ onStatusChange }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  
  const [status, setStatus] = useState<IntegrationStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [zapId, setZapId] = useState('');

  useEffect(() => {
    checkIntegrationStatus();
  }, []);

  const checkIntegrationStatus = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/export/zapier/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      
      const data = await response.json();
      setStatus(data);
      onStatusChange?.(data.connected);
      
      if (data.connected) {
        loadSyncLogs();
      }
    } catch (error) {
      console.error('Failed to check Zapier status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const response = await fetch('/api/export/zapier/sync-logs?page=1&limit=10', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log('Sync logs endpoint not implemented yet');
        return;
      }
      
      const data = await response.json();
      setSyncLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to load sync logs:', error);
      setSyncLogs([]);
    }
  };

  const handleSetupWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast.error('Please enter your Zapier webhook URL');
      return;
    }

    if (!webhookUrl.startsWith('https://hooks.zapier.com/')) {
      toast.error('Please enter a valid Zapier webhook URL');
      return;
    }

    try {
      setActionLoading('setup');
      
      const response = await fetch('/api/export/zapier/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          webhook_url: webhookUrl.trim(),
          zap_id: zapId.trim() || undefined
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Setup failed: ${response.status}`);
      }
      
      await checkIntegrationStatus();
      setShowSetup(false);
      setWebhookUrl('');
      setZapId('');
      toast.success('🎉 Zapier webhook connected successfully!');
    } catch (error) {
      console.error('Setup error:', error);
      toast.error('Failed to connect Zapier webhook. Please check your URL.');
    } finally {
      setActionLoading(null);
    }
  };

  const testWebhook = async () => {
    try {
      setActionLoading('test');
      
      const response = await fetch('/api/export/zapier/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Test failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Webhook test successful! Zapier received the data.');
      } else {
        toast.error('Webhook test failed. Please check your Zap configuration.');
      }
      
      loadSyncLogs(); // Refresh logs
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Failed to test webhook');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Zapier? This will remove your webhook configuration.')) {
      return;
    }

    try {
      setActionLoading('disconnect');
      
      const response = await fetch('/api/export/zapier/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Disconnect failed: ${response.status}`);
      }
      
      setStatus({ connected: false });
      setSyncLogs([]);
      onStatusChange?.(false);
      toast.success('Zapier integration disconnected');
    } catch (error) {
      toast.error('Failed to disconnect Zapier');
      console.error('Disconnect error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (syncStatus: string) => {
    switch (syncStatus) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="animate-pulse space-y-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className="space-y-2">
              <div className={`h-4 w-32 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              <div className={`h-3 w-48 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
            <div className="w-6 h-6 bg-amber-600 rounded-sm"></div>
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Zapier
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {status.connected 
                ? `Connected to webhook ${status.webhook_url_masked}` 
                : 'Send enriched contacts to your workflows'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {status.connected ? (
            <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Connected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-gray-500">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">Not connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Connection Status & Actions */}
      {!status.connected ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className={`p-4 rounded-lg ${isDark ? 'bg-amber-900/20 border border-amber-700/50' : 'bg-amber-50 border border-amber-200'}`}>
            <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
              Connect to Zapier
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
              Connect your Zapier account to automatically send enriched contacts to your workflows and integrations.
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 mb-4">
              <li>• Send enriched contacts to any Zapier integration</li>
              <li>• Trigger workflows automatically</li>
              <li>• Support for 5000+ apps and services</li>
              <li>• Real-time data delivery</li>
            </ul>
          </div>

          {!showSetup ? (
            <button
              onClick={() => setShowSetup(true)}
              className="w-full flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-3 rounded-lg font-medium transition-colors"
            >
              <Link className="w-4 h-4" />
              <span>Setup Webhook</span>
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div className={`p-4 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Setup Zapier Webhook
                </h4>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Create a new Zap in Zapier with a "Catch Hook" trigger, then paste the webhook URL here.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Webhook URL *
                    </label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Zap ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={zapId}
                      onChange={(e) => setZapId(e.target.value)}
                      placeholder="Enter your Zap ID for easier identification"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={handleSetupWebhook}
                    disabled={actionLoading === 'setup' || !webhookUrl.trim()}
                    className="flex-1 flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {actionLoading === 'setup' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4" />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowSetup(false);
                      setWebhookUrl('');
                      setZapId('');
                    }}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      isDark 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Connection Info */}
          <div className={`p-4 rounded-lg ${isDark ? 'bg-green-900/20 border border-green-700/50' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-100">
                  Connected to Zapier
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Webhook: {status.webhook_url_masked} • {status.zap_id ? `Zap ID: ${status.zap_id} • ` : ''}Connected: {formatDate(status.connected_at)}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading === 'disconnect'}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Disconnect Zapier"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={testWebhook}
              disabled={actionLoading === 'test'}
              className={`flex items-center justify-center space-x-2 p-4 rounded-lg border transition-colors ${
                isDark 
                  ? 'border-gray-600 hover:border-amber-500 hover:bg-amber-900/20' 
                  : 'border-gray-300 hover:border-amber-500 hover:bg-amber-50'
              }`}
            >
              {actionLoading === 'test' ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-amber-500" />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    Test Webhook
                  </span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`flex items-center justify-center space-x-2 p-4 rounded-lg border transition-colors ${
                isDark 
                  ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-900/20' 
                  : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              <Activity className="w-4 h-4 text-blue-500" />
              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                {showLogs ? 'Hide' : 'Show'} Webhook History
              </span>
            </button>
          </div>

          {/* Sync Logs */}
          <AnimatePresence>
            {showLogs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Recent Webhook Activity
                </h4>
                
                {syncLogs.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    No webhook activity yet. Export contacts to trigger webhooks.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {syncLogs.map((log, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(log.status)}
                            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {log.sync_type === 'webhook' ? 'Webhook' : 'Export'} {log.operation}
                            </span>
                          </div>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {formatDate(log.started_at)}
                          </span>
                        </div>
                        
                        {log.status === 'completed' && (
                          <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {log.processed_records} of {log.total_records} records sent
                            {log.failed_records > 0 && ` (${log.failed_records} failed)`}
                          </div>
                        )}
                        
                        {log.error_message && (
                          <div className="text-xs text-red-500 mt-1">
                            {log.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export default ZapierIntegration; 