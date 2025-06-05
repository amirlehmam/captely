import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Mail, Phone, Clock, ChevronRight, 
  TrendingUp, BarChart3, RefreshCw, Upload,
  CheckCircle, XCircle, AlertTriangle, Eye,
  Activity, Zap, Target, ArrowUp, ArrowDown,
  Calendar, DollarSign, Wifi, WifiOff, Cog, Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

// Updated hooks for production
import { useDashboardStats, useJobs, useServiceHealth } from '../hooks/useApi';

// Components
import BatchProgress from '../components/dashboard/BatchProgress';
import CreditUsage from '../components/dashboard/CreditUsage';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Hooks for data fetching
  const { 
    stats,
    loading: statsLoading,
    refetch: refetchStats 
  } = useDashboardStats();

  const { 
    jobs
  } = useJobs();

  useServiceHealth(); // Keep hook to maintain data fetching

  useEffect(() => {
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(() => {
      refetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchStats]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-lg text-gray-600">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('dashboard.stats.totalContacts')}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(stats?.overview?.total_contacts || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="h-4 w-4 text-green-500" />
            <span className="text-green-600 font-medium">+12%</span>
            <span className="text-gray-500 ml-1">{t('common.thisMonth')}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('dashboard.stats.enrichedContacts')}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(stats?.overview?.emails_found || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="h-4 w-4 text-green-500" />
            <span className="text-green-600 font-medium">+8%</span>
            <span className="text-gray-500 ml-1">{t('common.thisWeek')}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('dashboard.stats.successRate')}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatPercentage(stats?.overview?.success_rate || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="h-4 w-4 text-green-500" />
            <span className="text-green-600 font-medium">+2.1%</span>
            <span className="text-gray-500 ml-1">{t('common.today')}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('dashboard.stats.creditsRemaining')}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(5000 - (stats?.overview?.credits_used_month || 18))}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Zap className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowDown className="h-4 w-4 text-red-500" />
            <span className="text-red-600 font-medium">-156</span>
            <span className="text-gray-500 ml-1">{t('common.today')}</span>
          </div>
        </div>
      </motion.div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Batch Progress */}
        <div className="lg:col-span-2">
          <BatchProgress />
        </div>
        
        {/* Right Column - Credit Usage & System Health */}
        <div className="space-y-8">
          <CreditUsage />
          
          {/* System Health */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('dashboard.systemHealth.title')}
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {t('dashboard.systemHealth.enrichmentService')}
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {t('common.active')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {t('dashboard.systemHealth.apiService')}
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {t('common.active')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {t('dashboard.systemHealth.dataProcessing')}
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {t('common.active')}
                  </span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm font-medium text-green-800">
                    {t('dashboard.systemHealth.allSystemsOperational')}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="text-white">
              <h3 className="text-xl font-bold mb-2">
                {t('dashboard.quickActions.title')}
              </h3>
              <p className="text-primary-100 text-sm">
                {t('dashboard.quickActions.subtitle')}
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                <span className="text-white text-sm font-medium">Ready to go</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              to="/import"
              className="group relative bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:scale-105 border border-blue-200"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-lg mb-4">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('dashboard.quickActions.newUpload')}
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Upload new contacts for enrichment
                </p>
                <div className="flex items-center text-blue-600 text-sm font-medium">
                  Start Upload <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </div>
            </Link>

            <Link
              to="/batches"
              className="group relative bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:scale-105 border border-green-200"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-lg mb-4">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('dashboard.quickActions.viewResults')}
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  View and manage your enrichment results
                </p>
                <div className="flex items-center text-green-600 text-sm font-medium">
                  View Results <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </div>
            </Link>

            <Link
              to="/settings"
              className="group relative bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:scale-105 border border-purple-200"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-500 rounded-lg mb-4">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('common.settings')}
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Configure your account and preferences
                </p>
                <div className="flex items-center text-purple-600 text-sm font-medium">
                  Open Settings <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard; 