import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, XCircle, ExternalLink, Link as LinkIcon, 
  RefreshCw, PlusCircle, Trash2, ArrowRight, Settings,
  Loader2, Shield, Zap, Globe, Database, Webhook, Clock,
  Plus, AlertCircle, Smartphone, Search, Filter, Download, Upload, Copy,
  Calendar, Users, Key
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import apiService from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import HubSpotIntegration from '../components/integrations/HubSpotIntegration';
import LemlistIntegration from '../components/integrations/LemlistIntegration';
import ZapierIntegration from '../components/integrations/ZapierIntegration';
import { integrationStatsService, IntegrationStats } from '../services/integrationStatsService';

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
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('all');
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<IntegrationStats>({
    connected: 0,
    available: 5,
    syncedToday: 0,
    syncedTodayGrowth: 0,
    apiCalls: 0,
    uptime: 99.9,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchIntegrationConfigs();
    fetchStats();
  }, []);

  useEffect(() => {
    // Update stats when integrations change
    setStats(prev => ({
      ...prev,
      connected: connectedIntegrations.size,
      available: integrations.length - connectedIntegrations.size,
    }));
  }, [connectedIntegrations]);

  const fetchIntegrationConfigs = async () => {
    try {
      // This would fetch user's saved integration configs
      // For now, we'll simulate some connected integrations
      setConnectedIntegrations(new Set(['hubspot', 'zapier']));
    } catch (error) {
      console.error('Failed to fetch integrations');
    }
  };

  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const realStats = await integrationStatsService.getIntegrationStats();
      setStats(realStats);
    } catch (error) {
      console.error('Failed to fetch integration stats:', error);
      // Keep default stats if fetch fails
    } finally {
      setIsLoadingStats(false);
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
    } ${isMobile ? 'px-4' : ''}`}>
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
        
        <div className={`relative z-10 ${isMobile ? 'p-4' : 'p-8'} rounded-2xl backdrop-blur-sm`}>
          <div className={`flex items-center ${isMobile ? 'flex-col text-center' : 'space-x-4'} mb-4`}>
            <div className={`p-3 rounded-xl ${
              isDark 
                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25' 
                : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25'
            } ${isMobile ? 'mb-4' : ''}`}>
              <LinkIcon className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-white`} />
            </div>
            <div>
              <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Integrations Hub
        </h1>
              <div className={`flex items-center ${isMobile ? 'justify-center' : ''} space-x-2`}>
                <Zap className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                <span className={`${isMobile ? 'text-base' : 'text-lg'} font-medium ${
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
      <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-4 gap-6'} mb-8`}>
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
                {isLoadingStats ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
                  </div>
                ) : (
                  stats.connected
                )}
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
                {isLoadingStats ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
                  </div>
                ) : (
                  stats.available
                )}
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
                {isLoadingStats ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                  </div>
                ) : (
                  integrationStatsService.formatNumber(stats.syncedToday)
                )}
              </p>
              <div className="flex items-center mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  isDark 
                    ? 'bg-purple-500/20 text-purple-300' 
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {isLoadingStats ? (
                    <div className="animate-pulse">
                      <div className="h-3 bg-purple-300 dark:bg-purple-600 rounded w-12"></div>
                    </div>
                  ) : (
                    `${integrationStatsService.formatGrowth(stats.syncedTodayGrowth)} today`
                  )}
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
                {isLoadingStats ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                  </div>
                ) : (
                  integrationStatsService.formatNumber(stats.apiCalls)
                )}
              </p>
              <div className="flex items-center mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  isDark 
                    ? 'bg-cyan-500/20 text-cyan-300' 
                    : 'bg-cyan-100 text-cyan-700'
                }`}>
                  {isLoadingStats ? (
                    <div className="animate-pulse">
                      <div className="h-3 bg-cyan-300 dark:bg-cyan-600 rounded w-16"></div>
                    </div>
                  ) : (
                    `${stats.uptime}% uptime`
                  )}
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
      <div className="space-y-8">
        <div>
          <div className="mb-6">
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              🔗 Available Integrations
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Connect with your favorite tools and platforms
            </p>
          </div>
          
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'}`}>
            {/* HubSpot Integration Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`rounded-2xl shadow-lg border transition-all duration-300 overflow-hidden ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 hover:shadow-gray-900/50' 
                  : 'bg-white border-gray-100 hover:shadow-xl'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                      <div className="w-6 h-6 bg-orange-600 rounded-sm"></div>
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        HubSpot CRM
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Database className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          CRM
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    connectedIntegrations.has('hubspot')
                      ? isDark 
                        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50'
                        : 'bg-green-100 text-green-800 border-green-200'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 border-gray-600'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>
                    {connectedIntegrations.has('hubspot') ? '✅ Connected' : '⏳ Available'}
                  </div>
                </div>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Push enriched contacts directly to HubSpot CRM
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-t border-gray-200 dark:border-gray-700">
                <HubSpotIntegration onStatusChange={(connected) => {
                  if (connected) {
                    setConnectedIntegrations(prev => new Set([...prev, 'hubspot']));
                  } else {
                    setConnectedIntegrations(prev => {
                      const newSet = new Set(prev);
                      newSet.delete('hubspot');
                      return newSet;
                    });
                  }
                }} />
              </div>
            </motion.div>

            {/* Lemlist Integration Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className={`rounded-2xl shadow-lg border transition-all duration-300 overflow-hidden ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 hover:shadow-gray-900/50' 
                  : 'bg-white border-gray-100 hover:shadow-xl'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <div className="w-6 h-6 bg-purple-600 rounded-sm"></div>
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Lemlist
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Globe className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Outreach
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    connectedIntegrations.has('lemlist')
                      ? isDark 
                        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50'
                        : 'bg-green-100 text-green-800 border-green-200'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 border-gray-600'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>
                    {connectedIntegrations.has('lemlist') ? '✅ Connected' : '⏳ Available'}
                  </div>
                </div>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Add contacts to your cold email campaigns
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-t border-gray-200 dark:border-gray-700">
                <LemlistIntegration onStatusChange={(connected) => {
                  if (connected) {
                    setConnectedIntegrations(prev => new Set([...prev, 'lemlist']));
                  } else {
                    setConnectedIntegrations(prev => {
                      const newSet = new Set(prev);
                      newSet.delete('lemlist');
                      return newSet;
                    });
                  }
                }} />
              </div>
            </motion.div>

            {/* Zapier Integration Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className={`rounded-2xl shadow-lg border transition-all duration-300 overflow-hidden ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 hover:shadow-gray-900/50' 
                  : 'bg-white border-gray-100 hover:shadow-xl'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                      <div className="w-6 h-6 bg-amber-600 rounded-sm"></div>
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Zapier
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Zap className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Automation
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    connectedIntegrations.has('zapier')
                      ? isDark 
                        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50'
                        : 'bg-green-100 text-green-800 border-green-200'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 border-gray-600'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>
                    {connectedIntegrations.has('zapier') ? '✅ Connected' : '⏳ Available'}
                  </div>
                </div>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Connect to 5,000+ apps through webhooks
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-t border-gray-200 dark:border-gray-700">
                <ZapierIntegration onStatusChange={(connected) => {
                  if (connected) {
                    setConnectedIntegrations(prev => new Set([...prev, 'zapier']));
                  } else {
                    setConnectedIntegrations(prev => {
                      const newSet = new Set(prev);
                      newSet.delete('zapier');
                      return newSet;
                    });
                  }
                }} />
              </div>
            </motion.div>

            {/* Coming Soon Integrations */}
            <AnimatePresence>
              {filteredIntegrations.filter(int => !['hubspot', 'lemlist', 'zapier'].includes(int.id)).map((integration, index) => (
                <motion.div
                  key={integration.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: (index + 3) * 0.1 }}
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
                        isDark
                          ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      }`}>
                        🚧 Coming Soon
                      </div>
                    </div>
                    
                    <p className={`text-sm mb-4 leading-relaxed ${
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {integration.description}
                    </p>
                  </div>

                  <div className={`px-6 py-4 border-t ${
                    isDark 
                      ? 'bg-gradient-to-r from-gray-800 to-gray-750 border-gray-700' 
                      : 'bg-gradient-to-r from-gray-50 to-white border-gray-100'
                  }`}>
                    <button
                      disabled
                      className={`w-full inline-flex justify-center items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        isDark 
                          ? 'bg-gray-700 text-gray-500 border border-gray-600 cursor-not-allowed' 
                          : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Coming Soon
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>


    </div>
  );
};

export default IntegrationsPage;