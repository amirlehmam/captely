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

// Updated hooks for production
import { useDashboardStats, useJobs, useServiceHealth } from '../hooks/useApi';

// Components
import BatchProgress from '../components/dashboard/BatchProgress';
import ProviderStatus from '../components/dashboard/ProviderStatus';
import CreditUsage from '../components/dashboard/CreditUsage';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // PRODUCTION-READY HOOKS
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { jobs, loading: jobsLoading, error: jobsError } = useJobs();
  const { health, loading: healthLoading } = useServiceHealth();

  // Redirect to login if no JWT is stored
  useEffect(() => {
    const token =
      typeof window !== 'undefined' &&
      (localStorage.getItem('captely_jwt') ||
       sessionStorage.getItem('captely_jwt'));
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Calculate real-time metrics from jobs
  const activeJobs = jobs.filter(job => job.status === 'processing' || job.status === 'pending');
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const failedJobs = jobs.filter(job => job.status === 'failed');
  
  const totalContacts = jobs.reduce((sum, job) => sum + job.total, 0);
  const totalEnriched = jobs.reduce((sum, job) => sum + job.completed, 0);
  const totalEmailsFound = jobs.reduce((sum, job) => sum + (job.emails_found || 0), 0);
  const totalPhonesFound = jobs.reduce((sum, job) => sum + (job.phones_found || 0), 0);
  const avgSuccessRate = jobs.length > 0 
    ? jobs.reduce((sum, job) => sum + (job.success_rate || 0), 0) / jobs.length 
    : 0;

  // Service health indicators
  const servicesUp = Object.values(health).filter(Boolean).length;
  const totalServices = Object.keys(health).length;

  return (
    <div className="space-y-8">
      {/* Page header with action buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4 md:mb-0"
        >
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor your enrichment performance and system health
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex space-x-3"
        >
          <button
            onClick={() => refetchStats()}
            disabled={statsLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Upload className="h-4 w-4 mr-2" />
            New Enrichment
          </Link>
        </motion.div>
      </div>

      {/* System Health Alert */}
      <AnimatePresence>
        {!healthLoading && totalServices > 0 && servicesUp < totalServices && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
          >
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-800">
                  Service Health Warning
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  {servicesUp}/{totalServices} services are operational. Some features may be limited.
                </p>
              </div>
              <div className="ml-auto flex items-center space-x-2">
                {Object.entries(health).map(([service, isUp]) => (
                  <div key={service} className="flex items-center space-x-1">
                    {isUp ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600 capitalize">{service}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Contacts</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {totalContacts.toLocaleString()}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <Users className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-blue-600 font-medium">
                  {totalEnriched.toLocaleString()} enriched
                </span>
              </div>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Emails Found</p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {totalEmailsFound.toLocaleString()}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <Mail className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">
                  {totalContacts > 0 ? Math.round((totalEmailsFound / totalContacts) * 100) : 0}% hit rate
                </span>
              </div>
            </div>
            <Mail className="w-12 h-12 text-green-500" />
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
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Phones Found</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {totalPhonesFound.toLocaleString()}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <Activity className="h-4 w-4 text-purple-500 mr-1" />
                <span className="text-purple-600 font-medium">
                  {totalContacts > 0 ? Math.round((totalPhonesFound / totalContacts) * 100) : 0}% hit rate
                </span>
              </div>
            </div>
            <Phone className="w-12 h-12 text-purple-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Success Rate</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">
                {avgSuccessRate.toFixed(1)}%
              </p>
              <div className="flex items-center mt-2 text-sm">
                <Zap className="h-4 w-4 text-yellow-500 mr-1" />
                <span className="text-yellow-600 font-medium">
                  {activeJobs.length} active jobs
                </span>
              </div>
            </div>
            <BarChart3 className="w-12 h-12 text-yellow-500" />
          </div>
        </motion.div>
      </div>

      {/* Error States */}
      <AnimatePresence>
        {(statsError || jobsError) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <h4 className="text-sm font-semibold text-red-800">Error Loading Data</h4>
                <p className="text-sm text-red-700 mt-1">
                  {statsError || jobsError}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIXED: Improved layout with proper spacing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current batch progress - takes up 2 columns on large screens */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BatchProgress />
        </motion.div>
        
        {/* Right sidebar - Credit usage and Provider status stacked properly */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CreditUsage />
          <ProviderStatus />
        </motion.div>
      </div>

      {/* Quick Actions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border border-gray-200 shadow-lg"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-600 mt-1">
              Common tasks and useful links
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/upload"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Upload className="h-4 w-4 mr-2" />
              New Upload
            </Link>
            <Link
              to="/results"
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Results
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Cog className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard; 