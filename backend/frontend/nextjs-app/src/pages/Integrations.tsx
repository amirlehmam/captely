import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, XCircle, ExternalLink, Link as LinkIcon, 
  RefreshCw, PlusCircle, Trash2, ArrowRight, Settings,
  Loader2, Shield, Zap, Globe, Database, Webhook, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface Integration {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  status: 'connected' | 'disconnected';
  lastSync?: string;
  connectedBy?: string;
  connectedAt?: string;
  apiKey?: string;
  config?: any;
}

const integrations: Integration[] = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: '🟠',
    description: 'Push enriched contacts directly to HubSpot CRM',
    category: 'CRM',
    status: 'disconnected',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    description: 'Sync leads with the world\'s #1 CRM platform',
    category: 'CRM',
    status: 'disconnected',
  },
  {
    id: 'lemlist',
    name: 'Lemlist',
    icon: '📧',
    description: 'Add contacts to your cold email campaigns',
    category: 'Outreach',
    status: 'disconnected',
  },
  {
    id: 'smartlead',
    name: 'Smartlead',
    icon: '🚀',
    description: 'Scale your outreach with AI-powered sequences',
    category: 'Outreach',
    status: 'disconnected',
  },
  {
    id: 'outreach',
    name: 'Outreach',
    icon: '📤',
    description: 'Enterprise sales engagement platform',
    category: 'Outreach',
    status: 'disconnected',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    icon: '⚡',
    description: 'Connect to 5,000+ apps through webhooks',
    category: 'Automation',
    status: 'disconnected',
  },
];

const IntegrationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());
  const [configForm, setConfigForm] = useState({
    apiKey: '',
    instanceUrl: '',
    campaignId: '',
    webhookUrl: ''
  });

  useEffect(() => {
    fetchIntegrationConfigs();
  }, []);

  const fetchIntegrationConfigs = async () => {
    try {
      // This would fetch user's saved integration configs
      // For now, we'll simulate some connected integrations
      setConnectedIntegrations(new Set(['hubspot', 'zapier']));
    } catch (error) {
      console.error('Failed to fetch integrations');
    }
  };

  const getFilteredIntegrations = () => {
    const integrationsWithStatus = integrations.map(int => ({
      ...int,
      status: (connectedIntegrations.has(int.id) ? 'connected' : 'disconnected') as 'connected' | 'disconnected'
    }));

    switch (activeTab) {
      case 'connected':
        return integrationsWithStatus.filter(int => int.status === 'connected');
      case 'disconnected':
        return integrationsWithStatus.filter(int => int.status === 'disconnected');
      default:
        return integrationsWithStatus;
    }
  };

  const handleConnect = async (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowConfig(true);
  };

  const handleDisconnect = async (integrationId: string) => {
    if (confirm('Are you sure you want to disconnect this integration?')) {
      try {
        setLoading(true);
        // API call to disconnect
        setConnectedIntegrations(prev => {
          const newSet = new Set(prev);
          newSet.delete(integrationId);
          return newSet;
        });
        toast.success('Integration disconnected successfully');
      } catch (error) {
        toast.error('Failed to disconnect integration');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedIntegration) return;

    try {
      setLoading(true);
      
      // Here we would make actual API calls based on the integration
      switch (selectedIntegration.id) {
        case 'hubspot':
          // await apiService.saveIntegrationConfig('hubspot', { apiKey: configForm.apiKey });
          break;
        case 'salesforce':
          // await apiService.saveIntegrationConfig('salesforce', { 
          //   instanceUrl: configForm.instanceUrl,
          //   accessToken: configForm.apiKey 
          // });
          break;
        case 'zapier':
          // await apiService.registerZapierWebhook(configForm.webhookUrl);
          break;
      }

      setConnectedIntegrations(prev => new Set([...prev, selectedIntegration.id]));
      toast.success(`${selectedIntegration.name} connected successfully!`);
      setShowConfig(false);
      setConfigForm({ apiKey: '', instanceUrl: '', campaignId: '', webhookUrl: '' });
    } catch (error) {
      toast.error('Failed to connect integration');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'CRM': return <Database className="w-5 h-5" />;
      case 'Outreach': return <Globe className="w-5 h-5" />;
      case 'Automation': return <Zap className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const filteredIntegrations = getFilteredIntegrations();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Integrations
        </h1>
        <p className="text-gray-600">
          Connect Captely with your favorite tools and automate your workflow
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Connected</p>
              <p className="text-3xl font-bold text-green-900 mt-1">
                {connectedIntegrations.size}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Available</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">
                {integrations.length - connectedIntegrations.size}
              </p>
            </div>
            <PlusCircle className="w-12 h-12 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Synced Today</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">
                1,247
              </p>
            </div>
            <RefreshCw className="w-12 h-12 text-purple-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide">API Calls</p>
              <p className="text-3xl font-bold text-teal-900 mt-1">
                24.5k
              </p>
            </div>
            <Webhook className="w-12 h-12 text-teal-500" />
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8">
          {['all', 'connected', 'disconnected'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                py-3 px-1 border-b-2 font-semibold text-sm capitalize transition-all duration-200
                ${activeTab === tab
                  ? 'border-primary-500 text-primary-600 bg-primary-50 rounded-t-lg px-4'
                  : 'border-transparent text-gray-600 hover:text-primary-600 hover:border-primary-300'
                }
              `}
            >
              {tab === 'disconnected' ? 'Available' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredIntegrations.map((integration, index) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300 h-full flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="text-4xl mr-4 p-2 bg-gray-50 rounded-lg">{integration.icon}</div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {integration.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {getCategoryIcon(integration.category)}
                        <span className="text-sm font-medium text-gray-600">
                          {integration.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    integration.status === 'connected' 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>
                    {integration.status}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4">
                  {integration.description}
                </p>

                {integration.status === 'connected' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      Last sync: 2 hours ago
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Shield className="w-4 h-4 mr-2" />
                      Connected securely
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
                {integration.status === 'connected' ? (
                  <div className="flex space-x-3">
                    <button className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-200 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </button>
                    <button 
                      onClick={() => handleDisconnect(integration.id)}
                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-red-200 text-sm font-semibold rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(integration)}
                    className="w-full inline-flex justify-center items-center px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-semibold transition-all duration-200"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Connect
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Configuration Modal */}
      <AnimatePresence>
        {showConfig && selectedIntegration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowConfig(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <span className="text-3xl mr-3 p-2 bg-gray-50 rounded-lg">{selectedIntegration.icon}</span>
                  <h2 className="text-xl font-bold text-gray-900">
                    Connect {selectedIntegration.name}
                  </h2>
                </div>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all duration-200"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {selectedIntegration.id === 'hubspot' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      HubSpot API Key
                    </label>
                    <input
                      type="password"
                      value={configForm.apiKey}
                      onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                      placeholder="pk_••••••••••••••••"
                    />
                    <p className="mt-2 text-sm text-gray-600">
                      Find your API key in HubSpot Settings → Integrations → API Key
                    </p>
                  </div>
                )}

                {selectedIntegration.id === 'salesforce' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Instance URL
                      </label>
                      <input
                        type="url"
                        value={configForm.instanceUrl}
                        onChange={(e) => setConfigForm({ ...configForm, instanceUrl: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="https://your-instance.salesforce.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Access Token
                      </label>
                      <input
                        type="password"
                        value={configForm.apiKey}
                        onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="00D••••••••••••••"
                      />
                    </div>
                  </>
                )}

                {selectedIntegration.id === 'zapier' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={configForm.webhookUrl}
                      onChange={(e) => setConfigForm({ ...configForm, webhookUrl: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                      placeholder="https://hooks.zapier.com/..."
                    />
                    <p className="mt-2 text-sm text-gray-600">
                      Create a Zap with "Webhooks by Zapier" trigger to get this URL
                    </p>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowConfig(false)}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 font-semibold"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntegrationsPage;