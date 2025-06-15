import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, Filter, ArrowUpDown, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertTriangle, FileDown, Package,
  RefreshCw, Eye, ExternalLink, MoreVertical, Trash2, Pause,
  Play, BarChart3, TrendingUp, Users, Mail, Phone, Zap,
  AlertCircle, Info, Calendar, Timer, Activity, Loader, FileText
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

// Updated hooks for production
import { useJobs, useExport, useJob } from '../hooks/useApi';
import ExportModal from '../components/modals/ExportModal';
import { apiService } from '../services/api';

interface JobDetails {
  id: string;
  user_id: string;
  file_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'credit_insufficient';
  total: number;
  completed: number;
  created_at: string;
  updated_at: string;
  progress: number;
  success_rate: number;
  email_hit_rate: number;
  phone_hit_rate: number;
  emails_found: number;
  phones_found: number;
  credits_used: number;
  avg_confidence: number;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'credit_insufficient':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'processing':
      return <Timer className="h-5 w-5 text-blue-500 animate-pulse" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'credit_insufficient':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'processing':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'pending':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const BatchesPage: React.FC = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const location = useLocation();

  // Get highlight parameter from URL
  const searchParams = new URLSearchParams(location.search);
  const highlightJobId = searchParams.get('highlight');
  
  // Hooks
  const { jobs: jobsData, loading, error, refetch } = useJobs();

  // Scroll to highlighted job when page loads
  useEffect(() => {
    if (highlightJobId && !loading) {
      const timer = setTimeout(() => {
        const element = document.querySelector(`tr[data-job-id="${highlightJobId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Show a toast notification
          toast.success('📦 New batch created from extension!', {
            duration: 4000,
            position: 'top-right'
          });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightJobId, loading]);
  
  // Extract jobs array from the response
  const jobs = jobsData || [];
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState<string | null>(null);
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [bulkExportJobs, setBulkExportJobs] = useState<string[]>([]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    toast.success(t('success.settingsSaved'));
  };

  const handleSingleExport = (jobId: string) => {
    setExportJobId(jobId);
    setBulkExportJobs([]);
    setShowExportModal(true);
  };

  const handleBulkExport = () => {
    if (selectedJobs.size === 0) {
      toast.error('Please select batches to export');
      return;
    }

    const completedSelectedJobs = Array.from(selectedJobs).filter(jobId => {
      const job = jobs.find(j => j.id === jobId);
      return job && job.status === 'completed';
    });

    if (completedSelectedJobs.length === 0) {
      toast.error('No completed batches selected for export');
      return;
    }

    setExportJobId(null);
    setBulkExportJobs(completedSelectedJobs);
    setShowExportModal(true);
  };

  const handleExportConfirm = async (format: 'csv' | 'excel' | 'json' | 'hubspot' | 'lemlist' | 'zapier', customFilename?: string) => {
    try {
      if (exportJobId) {
        // Single job export
        if (['hubspot', 'lemlist', 'zapier'].includes(format)) {
          // Integration export
          if (format === 'hubspot') {
            await apiService.exportJobToHubSpot(exportJobId);
            toast.success('🚀 Batch exported to HubSpot successfully!');
                     } else if (format === 'lemlist') {
             await apiService.exportJobToLemlist(exportJobId);
           } else if (format === 'zapier') {
             await apiService.exportJobToZapier(exportJobId);
           }
        } else {
          // File export
          await apiService.exportData(exportJobId, format as 'csv' | 'excel' | 'json', customFilename);
          toast.success(`Batch exported as ${format.toUpperCase()} successfully!`);
        }
      } else if (bulkExportJobs.length > 0) {
        // Bulk export
        for (const jobId of bulkExportJobs) {
          if (['hubspot', 'lemlist', 'zapier'].includes(format)) {
            // Integration export for each batch
            if (format === 'hubspot') {
              await apiService.exportJobToHubSpot(jobId);
                         } else if (format === 'lemlist') {
               await apiService.exportJobToLemlist(jobId);
             } else if (format === 'zapier') {
               await apiService.exportJobToZapier(jobId);
             }
                     } else {
             // File export for each batch
             await apiService.exportData(jobId, format as 'csv' | 'excel' | 'json', customFilename);
           }
        }
        setSelectedJobs(new Set());
        if (['hubspot', 'lemlist', 'zapier'].includes(format)) {
          toast.success(`🚀 Successfully exported ${bulkExportJobs.length} batches to ${format.charAt(0).toUpperCase() + format.slice(1)}!`);
        } else {
          toast.success(`Successfully exported ${bulkExportJobs.length} batches as ${format.toUpperCase()}!`);
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error; // Let the modal handle the error display
    }
  };

  const handleSelectAll = () => {
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map(job => job.id)));
    }
  };

  const handleSelectJob = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  // Filter and sort jobs
  let filteredJobs = jobs.filter(job => {
    const matchesSearch = job.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort jobs
  filteredJobs = filteredJobs.sort((a, b) => {
    let aValue: any = a[sortBy as keyof typeof a];
    let bValue: any = b[sortBy as keyof typeof b];
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Pagination
  const indexOfLastJob = currentPage * itemsPerPage;
  const indexOfFirstJob = indexOfLastJob - itemsPerPage;
  const currentJobs = filteredJobs.slice(indexOfFirstJob, indexOfLastJob);
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);

  // Calculate summary stats
  const activeJobs = jobs.filter(job => job.status === 'processing' || job.status === 'pending');
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const failedJobs = jobs.filter(job => job.status === 'failed');
  const totalContacts = jobs.reduce((sum, job) => sum + job.total, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return isDark 
          ? 'bg-green-900/30 text-green-400 border-green-700/50' 
          : 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return isDark 
          ? 'bg-blue-900/30 text-blue-400 border-blue-700/50' 
          : 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return isDark 
          ? 'bg-red-900/30 text-red-400 border-red-700/50' 
          : 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return isDark 
          ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50' 
          : 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'credit_insufficient':
        return isDark 
          ? 'bg-orange-900/30 text-orange-400 border-orange-700/50' 
          : 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return isDark 
          ? 'bg-gray-900/30 text-gray-400 border-gray-700/50' 
          : 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'processing':
        return <Loader className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-96 transition-all duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDark ? 'border-primary-400' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-6 transition-all duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} min-h-screen p-6`}>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('batches.title')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('batches.subtitle')}</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <motion.button 
            onClick={handleRefresh}
            disabled={refreshing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-all duration-200 ${
              isDark 
                ? 'border-gray-600 text-gray-200 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-gray-900' 
                : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
            }`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </motion.button>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
          <Link
            to="/import"
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white transition-all duration-200 ${
                isDark
                  ? 'bg-gradient-to-r from-primary-500 to-primary-400 hover:from-primary-600 hover:to-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-400 focus:ring-offset-gray-900'
                  : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
              }`}
          >
            <Package className="h-4 w-4 mr-2" />
            {t('navigation.import')}
          </Link>
          </motion.div>
        </div>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-xl p-4 ${
              isDark 
                ? 'bg-red-900/20 border border-red-800/50' 
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className={`h-5 w-5 mr-3 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                <div>
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-red-300' : 'text-red-800'}`}>{t('errors.generic')}</h4>
                  <p className={`text-sm mt-1 ${isDark ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className={`text-sm font-medium transition-colors ${
                  isDark 
                    ? 'text-red-300 hover:text-red-100' 
                    : 'text-red-600 hover:text-red-800'
                }`}
              >
                {t('common.retry')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Stats Overview - Enhanced for dark mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 shadow-lg border transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-700/50 hover:shadow-blue-500/20' 
              : 'bg-gradient-to-br from-blue-50 to-white border-blue-200 hover:shadow-blue-500/20'
          }`}
        >
          <div className="flex items-center">
            <Activity className={`h-8 w-8 mr-3 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{t('dashboard.stats.activeJobs')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>{activeJobs.length}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 shadow-lg border transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-700/50 hover:shadow-green-500/20' 
              : 'bg-gradient-to-br from-green-50 to-white border-green-200 hover:shadow-green-500/20'
          }`}
        >
          <div className="flex items-center">
            <CheckCircle className={`h-8 w-8 mr-3 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-700'}`}>{t('dashboard.stats.completedJobs')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-green-100' : 'text-green-900'}`}>{completedJobs.length}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 shadow-lg border transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-700/50 hover:shadow-purple-500/20' 
              : 'bg-gradient-to-br from-purple-50 to-white border-purple-200 hover:shadow-purple-500/20'
          }`}
        >
          <div className="flex items-center">
            <Users className={`h-8 w-8 mr-3 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{t('dashboard.stats.totalContacts')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-purple-100' : 'text-purple-900'}`}>{totalContacts.toLocaleString()}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 shadow-lg border transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-red-900/20 to-red-800/10 border-red-700/50 hover:shadow-red-500/20' 
              : 'bg-gradient-to-br from-red-50 to-white border-red-200 hover:shadow-red-500/20'
          }`}
        >
          <div className="flex items-center">
            <XCircle className={`h-8 w-8 mr-3 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>{t('dashboard.stats.failedJobs')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-red-100' : 'text-red-900'}`}>{failedJobs.length}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
      
      {/* Search and Filters - Enhanced dark mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`shadow-lg rounded-xl border p-6 transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          {/* Search */}
          <div className="w-full lg:w-1/3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`block w-full pl-10 pr-3 py-3 border rounded-lg leading-5 text-sm transition-all duration-200 ${
                  isDark 
                    ? 'border-gray-600 bg-gray-700 placeholder-gray-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500' 
                    : 'border-gray-200 bg-white placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                }`}
                placeholder={t('search.placeholder')}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-4 py-3 border rounded-lg transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500' 
                  : 'border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              }`}
            >
              <option value="all">{t('batches.filters.all')}</option>
              <option value="pending">{t('batches.filters.pending')}</option>
              <option value="processing">{t('batches.filters.processing')}</option>
              <option value="completed">{t('batches.filters.completed')}</option>
              <option value="failed">{t('batches.filters.failed')}</option>
              <option value="credit_insufficient">{t('errors.insufficientCredits')}</option>
            </select>
            
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('_');
                setSortBy(field);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className={`px-4 py-3 border rounded-lg transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500' 
                  : 'border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              }`}
            >
              <option value="created_at_desc">{t('common.createdAt')} (newest)</option>
              <option value="created_at_asc">{t('common.createdAt')} (oldest)</option>
              <option value="total_desc">{t('batches.table.contacts')} (most)</option>
              <option value="completed_desc">{t('batches.table.progress')} (highest)</option>
              <option value="success_rate_desc">{t('batches.table.successRate')} (highest)</option>
            </select>

            {/* Bulk Actions */}
            {selectedJobs.size > 0 && (
              <div className="flex space-x-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBulkExport}
                  className={`px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                    isDark 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Download className="w-4 h-4 mr-2 inline" />
                  Export ({selectedJobs.size})
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedJobs(new Set())}
                  className={`px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                    isDark 
                      ? 'bg-gray-600 text-white hover:bg-gray-700' 
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  {t('common.cancel')}
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      
      {/* Batches table - Enhanced dark mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`shadow-lg overflow-hidden rounded-xl border transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={`${isDark ? 'bg-gradient-to-r from-gray-700 to-gray-800' : 'bg-gradient-to-r from-gray-50 to-white'}`}>
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
                    onChange={handleSelectAll}
                    className={`rounded text-primary-600 focus:ring-primary-500 ${
                      isDark 
                        ? 'border-gray-500 bg-gray-700' 
                        : 'border-gray-300'
                    }`}
                  />
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.table.fileName')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.table.status')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.table.progress')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.table.contacts')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.table.createdAt')}
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">{t('batches.table.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
              {currentJobs.map((job) => (
                <motion.tr 
                  key={job.id} 
                  data-job-id={job.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ scale: 1.005 }}
                  className={`transition-all duration-200 ${
                    isDark 
                      ? 'hover:bg-gray-750 hover:shadow-lg' 
                      : 'hover:bg-gray-50 hover:shadow-lg'
                  } ${
                    highlightJobId === job.id 
                      ? isDark
                        ? 'bg-green-900/30 border-l-4 border-green-500 shadow-lg shadow-green-500/10'
                        : 'bg-green-50 border-l-4 border-green-500 shadow-lg shadow-green-500/20'
                      : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => handleSelectJob(job.id)}
                      className={`rounded text-primary-600 focus:ring-primary-500 ${
                        isDark 
                          ? 'border-gray-500 bg-gray-700' 
                          : 'border-gray-300'
                      }`}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className={`h-5 w-5 mr-3 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                          {job.file_name || `Batch ${job.id.substring(0, 8)}`}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          ID: {job.id.substring(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                      job.progress >= 100 ? 'completed' : job.status
                    )}`}>
                      {getStatusIcon(job.progress >= 100 ? 'completed' : job.status)}
                      <span className="ml-1">{t(`enrichment.status.${job.progress >= 100 ? 'completed' : job.status}`)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              job.status === 'completed' ? 'bg-green-500' : 
                              job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {(job.progress || 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    <div>
                      <div className="font-medium">{job.completed}/{job.total}</div>
                      {job.success_rate !== undefined && (
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {(job.success_rate || 0).toFixed(1)}% {t('batches.table.successRate').toLowerCase()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    <div>
                      <div>{new Date(job.created_at).toLocaleDateString()}</div>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(job.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Link
                          to={`/batches/${job.id}`}
                          className={`transition-colors ${
                            isDark 
                              ? 'text-primary-400 hover:text-primary-300' 
                              : 'text-primary-600 hover:text-primary-900'
                          }`}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      </motion.div>
                      {/* 🔥 FIXED: Show export button when progress >= 100% OR status is completed */}
                      {(job.status === 'completed' || job.progress >= 100) && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleSingleExport(job.id)}
                          className={`transition-colors ${
                            isDark 
                              ? 'text-emerald-400 hover:text-emerald-300' 
                              : 'text-emerald-600 hover:text-emerald-900'
                          }`}
                          title="Export batch data"
                        >
                          <Download className="h-4 w-4" />
                        </motion.button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-6 py-4 border-t ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('common.total')}: {filteredJobs.length} {t('batches.title').toLowerCase()}
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-3 py-2 rounded-l-lg border text-sm font-medium transition-all duration-200 ${
                      currentPage === 1
                        ? isDark 
                          ? 'text-gray-500 cursor-not-allowed border-gray-600 bg-gray-700'
                          : 'text-gray-300 cursor-not-allowed border-gray-200 bg-white'
                        : isDark
                          ? 'text-gray-300 border-gray-600 bg-gray-700 hover:bg-gray-600 hover:text-primary-400'
                          : 'text-gray-700 border-gray-200 bg-white hover:bg-gray-50 hover:text-primary-600'
                    }`}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </motion.button>
                  
                  <span className={`relative inline-flex items-center px-4 py-2 border text-sm font-semibold ${
                    isDark 
                      ? 'border-gray-600 bg-primary-900/50 text-primary-300' 
                      : 'border-gray-200 bg-primary-50 text-primary-700'
                  }`}>
                    {currentPage} / {totalPages || 1}
                  </span>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`relative inline-flex items-center px-3 py-2 rounded-r-lg border text-sm font-medium transition-all duration-200 ${
                      currentPage === totalPages || totalPages === 0
                        ? isDark 
                          ? 'text-gray-500 cursor-not-allowed border-gray-600 bg-gray-700'
                          : 'text-gray-300 cursor-not-allowed border-gray-200 bg-white'
                        : isDark
                          ? 'text-gray-300 border-gray-600 bg-gray-700 hover:bg-gray-600 hover:text-primary-400'
                          : 'text-gray-700 border-gray-200 bg-white hover:bg-gray-50 hover:text-primary-600'
                    }`}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </motion.button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Empty state */}
      {filteredJobs.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center py-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        >
          <Package className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('batches.empty.title')}</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {searchTerm || statusFilter !== 'all' 
              ? t('search.noResults')
              : t('batches.empty.subtitle')
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <div className="mt-6">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
              <Link
                to="/import"
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                    isDark 
                      ? 'bg-primary-500 hover:bg-primary-600' 
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
              >
                <Package className="h-4 w-4 mr-2" />
                {t('batches.empty.cta')}
              </Link>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      {/* Job Details Modal/Side Panel (placeholder) */}
      <AnimatePresence>
        {showJobDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowJobDetails(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto ${
                isDark ? 'bg-gray-800' : 'bg-white'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Job Details</h3>
                  <button
                    onClick={() => setShowJobDetails(null)}
                    className={`transition-colors ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      Detailed job information would be displayed here, including:
                    </p>
                    <ul className={`mt-2 text-sm list-disc list-inside ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <li>Contact-level results</li>
                      <li>Provider performance breakdown</li>
                      <li>Quality metrics</li>
                      <li>Credit usage details</li>
                      <li>Error logs (if any)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setExportJobId(null);
          setBulkExportJobs([]);
        }}
        onExport={handleExportConfirm}
        title={exportJobId ? "Export Batch" : "Bulk Export Batches"}
        description={
          exportJobId 
            ? "Choose your preferred format to export this batch"
            : `Export ${bulkExportJobs.length} selected batches`
        }
        exportCount={exportJobId ? 1 : bulkExportJobs.length}
        type="batch"
        jobId={exportJobId || undefined}
        originalFilename={
          exportJobId 
            ? jobs.find(job => job.id === exportJobId)?.file_name 
            : bulkExportJobs.length === 1 
              ? jobs.find(job => job.id === bulkExportJobs[0])?.file_name
              : undefined
        }
      />
    </div>
  );
};

export default BatchesPage;