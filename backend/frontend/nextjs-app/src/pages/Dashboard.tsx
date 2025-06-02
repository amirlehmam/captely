import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Mail, Phone, Clock, ChevronRight, 
  TrendingUp, BarChart3, RefreshCw, Upload,
  CheckCircle, XCircle, AlertTriangle, Eye,
  Activity, Zap, Target, ArrowUp, ArrowDown,
  Calendar, DollarSign, Wifi, WifiOff
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Updated hooks for production
import { useDashboardStats, useJobs, useServiceHealth } from '../hooks/useApi';

// Components
import BatchProgress from '../components/dashboard/BatchProgress';
import RecentBatches from '../components/dashboard/RecentBatches';
import ProviderStatus from '../components/dashboard/ProviderStatus';
import CreditUsage from '../components/dashboard/CreditUsage';
import RealTimeMonitoring from '../components/dashboard/RealTimeMonitoring';

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
    <div className="space-y-6">
      {/* Page header with action buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Welcome back! Here's what's happening with your lead enrichment.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mt-4 md:mt-0 flex space-x-3"
        >
          <button 
            onClick={() => refetchStats()}
            disabled={statsLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <Link
            to="/import"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Upload className="h-4 w-4 mr-2" />
            New Import
          </Link>
        </motion.div>
      </div>

      {/* Service Health Alert */}
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
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">
                  {completedJobs.length} batches completed
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
                <Target className="h-4 w-4 text-green-500 mr-1" />
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
        {statsError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <h4 className="text-sm font-semibold text-red-800">
                  Dashboard Data Error
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  {statsError}. Using cached data where available.
                </p>
              </div>
              <button
                onClick={() => refetchStats()}
                className="ml-auto text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current batch progress */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BatchProgress />
        </motion.div>
        
        {/* Credit usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CreditUsage />
        </motion.div>

        {/* Real-Time Monitoring */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <RealTimeMonitoring />
        </motion.div>
        
        {/* API Provider Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <ProviderStatus />
        </motion.div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent batches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <RecentBatches />
        </motion.div>
      </div>

      {/* Quick Actions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 p-6 shadow-lg"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/import"
            className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200 group"
          >
            <Upload className="h-8 w-8 text-primary-500 mr-3 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="font-semibold text-gray-900">Import Contacts</h4>
              <p className="text-sm text-gray-600">Upload CSV files for enrichment</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 ml-auto" />
          </Link>

          <Link
            to="/batches"
            className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200 group"
          >
            <Eye className="h-8 w-8 text-blue-500 mr-3 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="font-semibold text-gray-900">View Batches</h4>
              <p className="text-sm text-gray-600">Monitor enrichment progress</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 ml-auto" />
          </Link>

          <Link
            to="/crm/contacts"
            className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200 group"
          >
            <Users className="h-8 w-8 text-green-500 mr-3 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="font-semibold text-gray-900">Manage CRM</h4>
              <p className="text-sm text-gray-600">View and organize contacts</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 ml-auto" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard; 