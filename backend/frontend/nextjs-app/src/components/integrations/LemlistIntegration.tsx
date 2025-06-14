import React, { useState, useEffect } from 'react';
import { Key, Download, Upload, Activity, AlertCircle, CheckCircle, Clock, Trash2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

interface LemlistIntegrationProps {
  onStatusChange?: (connected: boolean) => void;
}

interface IntegrationStatus {
  connected: boolean;
  account_id?: string;
  api_key_last_4?: string;
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

const LemlistIntegration: React.FC<LemlistIntegrationProps> = ({ onStatusChange }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  
  const [status, setStatus] = useState<IntegrationStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    checkIntegrationStatus();
  }, []);

  const checkIntegrationStatus = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/export/lemlist/status', {
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
      console.error('Failed to check Lemlist status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const response = await fetch('/api/export/lemlist/sync-logs?page=1&limit=10', {
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

  const handleSetupApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your Lemlist API key');
      return;
    }

    try {
      setActionLoading('setup');
      
      const response = await fetch('/api/export/lemlist/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ api_key: apiKey.trim() })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Setup failed: ${response.status}`);
      }
      
      await checkIntegrationStatus();
      setShowSetup(false);
      setApiKey('');
      toast.success('🎉 Lemlist connected successfully!');
    } catch (error) {
      console.error('Setup error:', error);
      toast.error('Failed to connect Lemlist. Please check your API key.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImport = async () => {
    try {
      setActionLoading('import');
      
      const response = await fetch('/api/export/lemlist/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if import requires redirect to enrichment  
      if (data.redirect === 'enrichment' && data.job_id) {
        toast.success(`Successfully imported ${data.imported_count} leads from Lemlist!`);
        // Navigate to import page which will trigger enrichment dialog
        window.location.href = `/import?lemlist_job=${data.job_id}&imported=${data.imported_count}`;
      } else {
        toast.success(`Successfully imported ${data.imported_count || 0} leads from Lemlist!`);
        loadSyncLogs(); // Refresh logs
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to start import from Lemlist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Lemlist? This will remove access to your Lemlist data.')) {
      return;
    }

    try {
      setActionLoading('disconnect');
      
      const response = await fetch('/api/export/lemlist/disconnect', {
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
      toast.success('Lemlist integration disconnected');
    } catch (error) {
      toast.error('Failed to disconnect Lemlist');
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
          <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <div className="w-6 h-6 bg-purple-600 rounded-sm"></div>
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Lemlist
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {status.connected 
                ? `Connected to account ${status.account_id}` 
                : 'Sync your leads with Lemlist campaigns'
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
          <div className={`p-4 rounded-lg ${isDark ? 'bg-purple-900/20 border border-purple-700/50' : 'bg-purple-50 border border-purple-200'}`}>
            <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
              Connect to Lemlist
            </h4>
            <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
              Connect your Lemlist account to import leads for enrichment and export enriched data back to Lemlist.
            </p>
            <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1 mb-4">
              <li>• Import leads from Lemlist campaigns for enrichment</li>
              <li>• Export enriched contacts back to Lemlist</li>
              <li>• Add contacts to specific campaigns</li>
              <li>• Track sync history and status</li>
            </ul>
          </div>

          {!showSetup ? (
            <button
              onClick={() => setShowSetup(true)}
              className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-3 rounded-lg font-medium transition-colors"
            >
              <Key className="w-4 h-4" />
              <span>Connect with API Key</span>
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div className={`p-4 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Enter your Lemlist API Key
                </h4>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  You can find your API key in your Lemlist account settings under API & Webhooks.
                </p>
                
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Lemlist API key..."
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                      isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={handleSetupApiKey}
                    disabled={actionLoading === 'setup' || !apiKey.trim()}
                    className="flex-1 flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {actionLoading === 'setup' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowSetup(false);
                      setApiKey('');
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
                  Connected to Lemlist
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Account: {status.account_id} • API Key: ****{status.api_key_last_4} • Connected: {formatDate(status.connected_at)}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading === 'disconnect'}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Disconnect Lemlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleImport}
              disabled={actionLoading === 'import'}
              className={`flex items-center justify-center space-x-2 p-4 rounded-lg border transition-colors ${
                isDark 
                  ? 'border-gray-600 hover:border-purple-500 hover:bg-purple-900/20' 
                  : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
              }`}
            >
              {actionLoading === 'import' ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-purple-500" />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    Import from Lemlist
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
                {showLogs ? 'Hide' : 'Show'} Sync History
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
                  Recent Sync Activity
                </h4>
                
                {syncLogs.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    No sync activity yet. Start by importing or exporting leads.
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
                              {log.sync_type === 'import' ? 'Import' : 'Export'} {log.operation}
                            </span>
                          </div>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {formatDate(log.started_at)}
                          </span>
                        </div>
                        
                        {log.status === 'completed' && (
                          <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {log.processed_records} of {log.total_records} records processed
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

export default LemlistIntegration; 