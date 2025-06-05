import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Mail, Phone, Clock, ChevronRight, 
  TrendingUp, BarChart3, RefreshCw, Upload,
  CheckCircle, XCircle, AlertTriangle, Eye,
  Activity, Zap, Target, ArrowUp, ArrowDown,
  Calendar, DollarSign, Wifi, WifiOff, Cog, Settings,
  CreditCard, ListChecks, Database, Loader
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreditContext } from '../contexts/CreditContext';
import { useTheme } from '../contexts/ThemeContext';

// Updated hooks for production
import { useDashboardStats, useJobs, useServiceHealth } from '../hooks/useApi';

// Components
import BatchProgress from '../components/dashboard/BatchProgress';
import CreditUsage from '../components/dashboard/CreditUsage';
import VerificationStats from '../components/dashboard/VerificationStats';

// Types
interface Stats {
  overview?: {
    total_contacts?: number;
    emails_found?: number;
    phones_found?: number;
    success_rate?: number;
    credits_used_month?: number;
    email_hit_rate?: number;
    phone_hit_rate?: number;
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
  const { isDark } = useTheme();

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

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    // Set initial loading to false once we have stats or an error
    if (stats || !statsLoading) {
      setInitialLoading(false);
    }
  }, [stats, statsLoading]);

  useEffect(() => {
    // Silent auto-refresh every 10 seconds (won't show loading state)
    const interval = setInterval(() => {
      refetchStats(); // This will update in background without showing loaders
    }, 10000);
    
    return () => clearInterval(interval);
  }, [refetchStats]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  // Enhanced stats cards with safe defaults to prevent flashing
  const statsCards = [
    {
      title: t('total_contacts'),
      value: stats?.overview?.total_contacts || 0,
      subtitle: "batch completed",
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-900',
      borderColor: 'border-blue-200'
    },
    {
      title: t('emails_found'),
      value: stats?.overview?.emails_found || 0,
      subtitle: `${Math.round((stats?.overview?.email_hit_rate || 0))}% hit rate`,
      icon: Mail,
      color: 'green',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      textColor: 'text-green-900',
      borderColor: 'border-green-200'
    },
    {
      title: t('phones_found'),
      value: stats?.overview?.phones_found || 0,
      subtitle: `${Math.round((stats?.overview?.phone_hit_rate || 0))}% hit rate`,
      icon: Phone,
      color: 'purple',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      textColor: 'text-purple-900',
      borderColor: 'border-purple-200'
    },
    {
      title: t('credits_used'),
      value: creditData?.limit_monthly ? Math.max(0, creditData.limit_monthly - creditData.balance) : 0,
      subtitle: "this month",
      icon: CreditCard,
      color: 'orange',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      textColor: 'text-orange-900',
      borderColor: 'border-orange-200'
    }
  ];

  if (initialLoading && statsLoading) {
    // Only show loader on very first load
    return (
      <div className={`min-h-screen flex items-center justify-center transition-all duration-300 ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="p-6 space-y-6">
        {/* Quick Actions - compact and elegant design */}
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border shadow-sm p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('quick_actions')}
            </h3>
            <div className="flex items-center text-sm text-gray-500">
              <Zap className="h-4 w-4 mr-1" />
              Fast Access
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <motion.button
              onClick={() => navigate('/import')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`group flex flex-col items-center p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 hover:bg-gray-650 hover:border-gray-500' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors ${
                isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-100 text-blue-600'
              } group-hover:${isDark ? 'bg-blue-900/30' : 'bg-blue-200'}`}>
                <Upload className="h-5 w-5" />
              </div>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {t('import_contacts')}
              </span>
            </motion.button>

            <motion.button
              onClick={() => navigate('/batches')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`group flex flex-col items-center p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 hover:bg-gray-650 hover:border-gray-500' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors ${
                isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-600'
              } group-hover:${isDark ? 'bg-green-900/30' : 'bg-green-200'}`}>
                <ListChecks className="h-5 w-5" />
              </div>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {t('view_batches')}
              </span>
            </motion.button>

            <motion.button
              onClick={() => navigate('/billing')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`group flex flex-col items-center p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 hover:bg-gray-650 hover:border-gray-500' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors ${
                isDark ? 'bg-purple-900/20 text-purple-400' : 'bg-purple-100 text-purple-600'
              } group-hover:${isDark ? 'bg-purple-900/30' : 'bg-purple-200'}`}>
                <CreditCard className="h-5 w-5" />
              </div>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {t('Buy Credits')}
              </span>
            </motion.button>

            <motion.button
              onClick={() => navigate('/crm')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`group flex flex-col items-center p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 hover:bg-gray-650 hover:border-gray-500' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors ${
                isDark ? 'bg-orange-900/20 text-orange-400' : 'bg-orange-100 text-orange-600'
              } group-hover:${isDark ? 'bg-orange-900/30' : 'bg-orange-200'}`}>
                <Database className="h-5 w-5" />
              </div>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {t('view_crm')}
              </span>
            </motion.button>
          </div>
        </div>

        {/* Stats Grid - Stable structure to prevent flashing */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {initialLoading && statsLoading ? (
            // Loading state for stats - maintain grid structure
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                    <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                  <div className="h-8 w-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))
          ) : (
            // Actual stats cards with descriptive text
            statsCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`${isDark ? 'bg-gray-800' : card.bgColor} rounded-xl p-6 border ${card.borderColor} shadow-lg hover:shadow-xl transition-all duration-300`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : card.iconColor} uppercase tracking-wide`}>
                      {card.title}
                    </p>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : card.textColor} mt-2 mb-1`}>
                      {card.value.toLocaleString()}
                    </p>
                    {/* Descriptive subtitle */}
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'} flex items-center`}>
                      <div className={`w-2 h-2 rounded-full ${
                        card.color === 'blue' ? 'bg-blue-400' :
                        card.color === 'green' ? 'bg-green-400' :
                        card.color === 'purple' ? 'bg-purple-400' : 'bg-orange-400'
                      } mr-2`}></div>
                      {card.subtitle}
                    </p>
                  </div>
                  <div className={`flex-shrink-0 ${isDark ? 'text-gray-400' : card.iconColor}`}>
                    <card.icon className="h-8 w-8" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

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
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('dashboard.systemHealth.title')}
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Wifi className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {t('dashboard.systemHealth.enrichmentService')}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      {t('common.active')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Wifi className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {t('dashboard.systemHealth.apiService')}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      {t('common.active')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Wifi className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {t('dashboard.systemHealth.dataProcessing')}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      {t('common.active')}
                    </span>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-400">
                      {t('dashboard.systemHealth.allSystemsOperational')}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 