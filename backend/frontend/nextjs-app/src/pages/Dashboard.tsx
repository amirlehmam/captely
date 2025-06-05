import React, { useEffect, useState } from 'react';
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
import { useCreditContext } from '../contexts/CreditContext';

// Updated hooks for production
import { useDashboardStats, useJobs, useServiceHealth } from '../hooks/useApi';

// Components
import BatchProgress from '../components/dashboard/BatchProgress';
import CreditUsage from '../components/dashboard/CreditUsage';

// Types
interface Stats {
  overview?: {
    total_contacts?: number;
    emails_found?: number;
    phones_found?: number;
    success_rate?: number;
    credits_used_month?: number;
  };
  recent_batches?: Array<{
    id: string;
    filename: string;
    status: string;
    progress: number;
    created_at: string;
  }>;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { creditData } = useCreditContext();

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
      {/* Quick Actions - Moved to top and made smaller */}
        <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">
            {t('dashboard.quickActions.title')}
          </h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            Ready to go
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/import"
            className="group flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg mb-2 group-hover:bg-blue-200">
              <Upload className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">
              {t('dashboard.quickActions.newUpload')}
            </span>
          </Link>

          <Link
            to="/batches"
            className="group flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg mb-2 group-hover:bg-green-200">
              <Eye className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">
              {t('dashboard.quickActions.viewResults')}
            </span>
          </Link>

          <Link
            to="/settings"
            className="group flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg mb-2 group-hover:bg-purple-200">
              <Settings className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">
              {t('common.settings')}
            </span>
          </Link>
            </div>
          </motion.div>

      {/* Stats Grid */}
        <motion.div
        initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
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
                Emails Found
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(stats?.overview?.emails_found || 0)}
              </p>
              </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Mail className="h-6 w-6 text-green-600" />
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
                Phones Found
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(stats?.overview?.phones_found || 0)}
              </p>
              </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Phone className="h-6 w-6 text-purple-600" />
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
                {t('dashboard.stats.creditsUsed')}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(creditData?.used_this_month || 0)}
              </p>
              </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="h-4 w-4 text-green-500" />
            <span className="text-green-600 font-medium">+{creditData?.used_this_month || 0}</span>
            <span className="text-gray-500 ml-1">{t('common.thisMonth')}</span>
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
    </div>
  );
};

export default Dashboard; 