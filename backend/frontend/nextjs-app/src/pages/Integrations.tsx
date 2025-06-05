import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, XCircle, ExternalLink, Link as LinkIcon, 
  RefreshCw, PlusCircle, Trash2, ArrowRight, Settings,
  Loader2, Shield, Zap, Globe, Database, Webhook, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
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
  const { isDark } = useTheme();
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
      
      // Mock API calls for integration configuration
      // In a real implementation, these would be actual API calls
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
      
      switch (selectedIntegration.id) {
        case 'hubspot':
          // await apiService.exportJobToHubSpot(configForm.apiKey);
          console.log('Simulating HubSpot connection with API key:', configForm.apiKey);
          break;
        case 'salesforce':
          // await apiService.exportToSalesforce(configForm.instanceUrl, configForm.apiKey);
          console.log('Simulating Salesforce connection with URL:', configForm.instanceUrl);
          break;
        case 'lemlist':
          // await apiService.exportToLemlist(configForm.apiKey);
          console.log('Simulating Lemlist connection with API key:', configForm.apiKey);
          break;
        case 'smartlead':
          // await apiService.exportToSmartlead(configForm.apiKey);
          console.log('Simulating Smartlead connection with API key:', configForm.apiKey);
          break;
        case 'outreach':
          // await apiService.exportToOutreach(configForm.apiKey);
          console.log('Simulating Outreach connection with API key:', configForm.apiKey);
          break;
        case 'zapier':
          // await apiService.registerZapierWebhook(configForm.webhookUrl);
          console.log('Simulating Zapier webhook registration:', configForm.webhookUrl);
          break;
        default:
          break;
      }

      setConnectedIntegrations(prev => new Set([...prev, selectedIntegration.id]));
      toast.success(`${selectedIntegration.name} connected successfully! 🎉`);
      setShowConfig(false);
      setConfigForm({ apiKey: '', instanceUrl: '', campaignId: '', webhookUrl: '' });
    } catch (error) {
      console.error('Connection failed:', error);
      toast.error('Failed to connect integration');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    const iconClassName = `w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`;
    
    switch (category) {
      case 'CRM': return <Database className={iconClassName} />;
      case 'Outreach': return <Globe className={iconClassName} />;
      case 'Automation': return <Zap className={iconClassName} />;
      default: return <Shield className={iconClassName} />;
    }
  };

  const filteredIntegrations = getFilteredIntegrations();

  return (
    <div className={`max-w-7xl mx-auto min-h-screen transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Enhanced Page Header with Dark Mode */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 relative overflow-hidden"
      >
        {/* Background Pattern */}
        <div className={`absolute inset-0 opacity-30 ${
          isDark ? 'bg-gradient-to-r from-purple-900/20 to-indigo-900/20' : 'bg-gradient-to-r from-purple-50 to-indigo-50'
        }`}>
          <div className="absolute inset-0" style={{
            backgroundImage: isDark 
              ? 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }} />
        </div>
        
        <div className="relative z-10 p-8 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center space-x-4 mb-4">
            <div className={`p-3 rounded-xl ${
              isDark 
                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25' 
                : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25'
            }`}>
              <LinkIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className={`text-4xl font-bold mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                🔗 Integrations Hub
              </h1>
              <div className="flex items-center space-x-2">
                <Zap className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                <span className={`text-lg font-medium ${
                  isDark ? 'text-purple-400' : 'text-purple-600'
                }`}>
                  Connect & Automate Your Workflow
                </span>
              </div>
            </div>
          </div>
          
          <p className={`text-lg leading-relaxed max-w-3xl ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Seamlessly connect Captely with your favorite CRM, outreach, and automation tools. 
            Export enriched data instantly and build powerful automated workflows.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <Database className={`h-4 w-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                CRM Sync
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Globe className={`h-4 w-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                Outreach Tools
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Webhook className={`h-4 w-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                API & Webhooks
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Stats Cards with Dark Mode */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border-emerald-700/50 hover:shadow-emerald-500/25' 
              : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-emerald-500/25'
          }`}
          style={{ willChange: 'transform, box-shadow' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-wide mb-2 ${
                isDark ? 'text-emerald-300' : 'text-green-700'
              }`}>
                Connected
              </p>
              <p className={`text-3xl font-bold ${
                isDark ? 'text-emerald-100' : 'text-green-900'
              }`}>
                {connectedIntegrations.size}
              </p>
              <div className="flex items-center mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  isDark 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  Active
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${
              isDark 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-emerald-500/10 text-emerald-600'
            }`}>
              <CheckCircle className="w-12 h-12" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-indigo-900/30 to-indigo-800/20 border-indigo-700/50 hover:shadow-indigo-500/25' 
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-indigo-500/25'
          }`}
          style={{ willChange: 'transform, box-shadow' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-wide mb-2 ${
                isDark ? 'text-indigo-300' : 'text-blue-700'
              }`}>
                Available
              </p>
              <p className={`text-3xl font-bold ${
                isDark ? 'text-indigo-100' : 'text-blue-900'
              }`}>
                {integrations.length - connectedIntegrations.size}
              </p>
              <div className="flex items-center mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  isDark 
                    ? 'bg-indigo-500/20 text-indigo-300' 
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  Ready
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${
              isDark 
                ? 'bg-indigo-500/20 text-indigo-400' 
                : 'bg-indigo-500/10 text-indigo-600'
            }`}>
              <PlusCircle className="w-12 h-12" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-purple-900/30 to-pink-800/20 border-purple-700/50 hover:shadow-purple-500/25' 
              : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-purple-500/25'
          }`}
          style={{ willChange: 'transform, box-shadow' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-wide mb-2 ${
                isDark ? 'text-purple-300' : 'text-purple-700'
              }`}>
                Synced Today
              </p>
              <p className={`text-3xl font-bold ${
                isDark ? 'text-purple-100' : 'text-purple-900'
              }`}>
                1,247
              </p>
              <div className="flex items-center mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  isDark 
                    ? 'bg-purple-500/20 text-purple-300' 
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  +12% today
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${
              isDark 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'bg-purple-500/10 text-purple-600'
            }`}>
              <RefreshCw className="w-12 h-12" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-cyan-900/30 to-teal-800/20 border-cyan-700/50 hover:shadow-cyan-500/25' 
              : 'bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 hover:shadow-cyan-500/25'
          }`}
          style={{ willChange: 'transform, box-shadow' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-wide mb-2 ${
                isDark ? 'text-cyan-300' : 'text-teal-700'
              }`}>
                API Calls
              </p>
              <p className={`text-3xl font-bold ${
                isDark ? 'text-cyan-100' : 'text-teal-900'
              }`}>
                24.5k
              </p>
              <div className="flex items-center mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  isDark 
                    ? 'bg-cyan-500/20 text-cyan-300' 
                    : 'bg-cyan-100 text-cyan-700'
                }`}>
                  99.9% uptime
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${
              isDark 
                ? 'bg-cyan-500/20 text-cyan-400' 
                : 'bg-cyan-500/10 text-cyan-600'
            }`}>
              <Webhook className="w-12 h-12" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Tabs with Dark Mode */}
      <div className={`border-b mb-8 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <nav className="flex space-x-8">
          {['all', 'connected', 'disconnected'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-semibold text-sm capitalize transition-all duration-200 ${
                activeTab === tab
                  ? isDark 
                    ? 'border-purple-500 text-purple-400 bg-purple-900/20 rounded-t-lg px-4'
                    : 'border-primary-500 text-primary-600 bg-primary-50 rounded-t-lg px-4'
                  : isDark
                    ? 'border-transparent text-gray-400 hover:text-purple-400 hover:border-purple-300'
                    : 'border-transparent text-gray-600 hover:text-primary-600 hover:border-primary-300'
              }`}
            >
              {tab === 'disconnected' ? '⚡ Available' : 
               tab === 'connected' ? '✅ Connected' : 
               '📊 All Integrations'}
            </button>
          ))}
        </nav>
      </div>

      {/* Enhanced Integrations Grid with Dark Mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredIntegrations.map((integration, index) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className={`rounded-2xl shadow-lg border transition-all duration-300 h-full flex flex-col ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 hover:shadow-gray-900/50' 
                  : 'bg-white border-gray-100 hover:shadow-xl'
              }`}
              style={{ willChange: 'transform, box-shadow' }}
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`text-4xl mr-4 p-2 rounded-xl ${
                      isDark ? 'bg-gray-700' : 'bg-gray-50'
                    }`}>
                      {integration.icon}
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {integration.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {getCategoryIcon(integration.category)}
                        <span className={`text-sm font-medium ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {integration.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    integration.status === 'connected' 
                      ? isDark 
                        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50'
                        : 'bg-green-100 text-green-800 border-green-200'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 border-gray-600'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>
                    {integration.status === 'connected' ? '✅ Connected' : '⏳ Available'}
                  </div>
                </div>
                
                <p className={`text-sm mb-4 leading-relaxed ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {integration.description}
                </p>

                {integration.status === 'connected' && (
                  <div className="space-y-2 text-sm">
                    <div className={`flex items-center ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <Clock className="w-4 h-4 mr-2" />
                      Last sync: 2 hours ago
                    </div>
                    <div className={`flex items-center ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <Shield className="w-4 h-4 mr-2" />
                      Connected securely
                    </div>
                  </div>
                )}
              </div>

              <div className={`px-6 py-4 border-t ${
                isDark 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-750 border-gray-700' 
                  : 'bg-gradient-to-r from-gray-50 to-white border-gray-100'
              }`}>
                {integration.status === 'connected' ? (
                  <div className="flex space-x-3">
                    <button className={`flex-1 inline-flex justify-center items-center px-3 py-2 border text-sm font-semibold rounded-xl transition-all duration-200 ${
                      isDark 
                        ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-purple-500' 
                        : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-primary-500'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2`}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </button>
                    <button 
                      onClick={() => handleDisconnect(integration.id)}
                      className={`flex-1 inline-flex justify-center items-center px-3 py-2 border text-sm font-semibold rounded-xl transition-all duration-200 ${
                        isDark 
                          ? 'border-red-600/50 text-red-400 bg-red-900/20 hover:bg-red-900/30 focus:ring-red-500' 
                          : 'border-red-200 text-red-700 bg-white hover:bg-red-50 focus:ring-red-500'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(integration)}
                    className="w-full inline-flex justify-center items-center px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105"
                    style={{ willChange: 'transform, box-shadow' }}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Connect Now
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Enhanced Configuration Modal with Dark Mode */}
      <AnimatePresence>
        {showConfig && selectedIntegration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50"
            style={{ 
              backdropFilter: 'blur(8px)',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              willChange: 'opacity'
            }}
            onClick={() => setShowConfig(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className={`rounded-2xl shadow-2xl max-w-md w-full p-6 border transition-all duration-300 ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
                  : 'bg-white border-gray-200 shadow-gray-500/50'
              }`}
              style={{ willChange: 'transform, opacity' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <span className={`text-3xl mr-3 p-2 rounded-xl ${
                    isDark ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    {selectedIntegration.icon}
                  </span>
                  <h2 className={`text-xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    Connect {selectedIntegration.name}
                  </h2>
                </div>
                <button
                  onClick={() => setShowConfig(false)}
                  className={`p-1 rounded-xl transition-all duration-200 ${
                    isDark 
                      ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {selectedIntegration.id === 'hubspot' && (
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      HubSpot API Key
                    </label>
                    <input
                      type="password"
                      value={configForm.apiKey}
                      onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 ${
                        isDark 
                          ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                          : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                      } focus:outline-none`}
                      placeholder="pk_••••••••••••••••"
                    />
                    <p className={`mt-2 text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Find your API key in HubSpot Settings → Integrations → API Key
                    </p>
                  </div>
                )}

                {selectedIntegration.id === 'salesforce' && (
                  <>
                    <div>
                      <label className={`block text-sm font-semibold mb-2 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Instance URL
                      </label>
                      <input
                        type="url"
                        value={configForm.instanceUrl}
                        onChange={(e) => setConfigForm({ ...configForm, instanceUrl: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 ${
                          isDark 
                            ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                            : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                        } focus:outline-none`}
                        placeholder="https://your-instance.salesforce.com"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-semibold mb-2 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Access Token
                      </label>
                      <input
                        type="password"
                        value={configForm.apiKey}
                        onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 ${
                          isDark 
                            ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                            : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                        } focus:outline-none`}
                        placeholder="00D••••••••••••••"
                      />
                    </div>
                  </>
                )}

                {(selectedIntegration.id === 'lemlist' || selectedIntegration.id === 'smartlead' || selectedIntegration.id === 'outreach') && (
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={configForm.apiKey}
                      onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 ${
                        isDark 
                          ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                          : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                      } focus:outline-none`}
                      placeholder={
                        selectedIntegration.id === 'lemlist' ? 'lml_••••••••••••••••' :
                        selectedIntegration.id === 'smartlead' ? 'sl_••••••••••••••••' :
                        'api_••••••••••••••••'
                      }
                    />
                    <p className={`mt-2 text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {selectedIntegration.id === 'lemlist' && 'Find your API key in Lemlist → Settings → Integrations'}
                      {selectedIntegration.id === 'smartlead' && 'Find your API key in Smartlead → Settings → API'}
                      {selectedIntegration.id === 'outreach' && 'Find your API key in Outreach → Settings → API'}
                    </p>
                  </div>
                )}

                {selectedIntegration.id === 'zapier' && (
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={configForm.webhookUrl}
                      onChange={(e) => setConfigForm({ ...configForm, webhookUrl: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 ${
                        isDark 
                          ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                          : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                      } focus:outline-none`}
                      placeholder="https://hooks.zapier.com/..."
                    />
                    <p className={`mt-2 text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Create a Zap with "Webhooks by Zapier" trigger to get this URL
                    </p>
                  </div>
                )}

                <div className={`mt-4 p-4 rounded-xl border ${
                  isDark 
                    ? 'bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-indigo-700/50' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                }`}>
                  <div className="flex items-start">
                    <Shield className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${
                      isDark ? 'text-indigo-400' : 'text-blue-600'
                    }`} />
                    <div className="text-sm">
                      <p className={`font-semibold mb-1 ${
                        isDark ? 'text-indigo-300' : 'text-blue-900'
                      }`}>
                        Secure Connection
                      </p>
                      <p className={isDark ? 'text-indigo-400' : 'text-blue-700'}>
                        Your credentials are encrypted and never stored in plain text. 
                        You can disconnect at any time.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowConfig(false)}
                    className={`flex-1 px-4 py-3 border rounded-xl font-semibold transition-all duration-200 ${
                      isDark 
                        ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-purple-500' 
                        : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-primary-500'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={loading || (
                      selectedIntegration.id === 'hubspot' ? !configForm.apiKey :
                      selectedIntegration.id === 'salesforce' ? !configForm.instanceUrl || !configForm.apiKey :
                      selectedIntegration.id === 'zapier' ? !configForm.webhookUrl :
                      !configForm.apiKey
                    )}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 font-semibold"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      '✨ Connect'
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