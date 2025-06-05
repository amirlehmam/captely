import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Mail, Phone, Clock, ChevronRight, 
  TrendingUp, BarChart3, RefreshCw, Upload,
  CheckCircle, XCircle, AlertTriangle, Eye,
  Activity, Zap, Target, ArrowUp, ArrowDown,
  Calendar, DollarSign, Wifi, WifiOff, Cog
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

// Updated hooks for production
import { useDashboardStats, useJobs, useServiceHealth } from '../hooks/useApi';

// Components
import BatchProgress from '../components/dashboard/BatchProgress';
import ProviderStatus from '../components/dashboard/ProviderStatus';
import CreditUsage from '../components/dashboard/CreditUsage';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Hooks for data fetching
  const { 
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



  const recentJobs = jobs.slice(0, 3);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
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
      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Batch Progress & Credit Usage */}
        <div className="lg:col-span-2 space-y-8">
          <BatchProgress />
          <CreditUsage />
        </div>
        
        {/* Right Column - Provider Status & System Health */}
        <div className="space-y-8">
          <ProviderStatus />
          
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

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('dashboard.recentActivity.title')}
            </h3>
            <Link
              to="/batches"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center"
            >
              {t('dashboard.recentActivity.viewAll')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>
        <div className="p-6">
          {recentJobs.length > 0 ? (
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {job.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : job.status === 'processing' ? (
                        <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : job.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {job.file_name || `Job ${job.id.substring(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {t(`enrichment.status.${job.status}`)}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {job.completed}/{job.total} {t('common.total').toLowerCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('dashboard.recentActivity.noActivity')}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border border-gray-200 shadow-lg"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('dashboard.quickActions.title')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {t('dashboard.quickActions.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/import"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Upload className="h-4 w-4 mr-2" />
              {t('dashboard.quickActions.newUpload')}
            </Link>
            <Link
              to="/batches"
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Eye className="h-4 w-4 mr-2" />
              {t('dashboard.quickActions.viewResults')}
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Cog className="h-4 w-4 mr-2" />
              {t('common.settings')}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard; 