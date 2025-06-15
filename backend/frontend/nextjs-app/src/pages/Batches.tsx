import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, Filter, ArrowUpDown, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertTriangle, FileDown, Package,
  RefreshCw, Eye, ExternalLink, MoreVertical, Trash2, Pause,
  Play, BarChart3, TrendingUp, Users, Mail, Phone, Zap,
  AlertCircle, Info, Calendar, Timer, Activity, Loader, FileText,
  Upload
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

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
  
  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    <div className={`${isMobile ? 'mobile-container' : 'space-y-6'} min-h-screen transition-all duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} ${isMobile ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'}`}
      >
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('batches.title')}
          </h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {t('batches.subtitle')}
          </p>
        </div>
        
        <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-center space-x-4'}`}>
          <motion.button
            onClick={() => navigate('/import')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center ${isMobile ? 'w-full justify-center px-4 py-3 text-base' : 'px-6 py-3 text-base'} font-medium text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 border border-transparent rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200`}
          >
            <Upload className="h-5 w-5 mr-2" />
            {t('batches.newBatch')}
          </motion.button>
          
          <motion.button
            onClick={refetch}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center ${isMobile ? 'w-full justify-center px-4 py-2 text-sm' : 'px-4 py-2 text-sm'} font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-xl shadow-lg border ${isMobile ? 'p-4' : 'p-6'} transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
      >
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-6'}`}>
          <div className={isMobile ? 'w-full' : 'w-full md:w-1/2'}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`block w-full pl-10 pr-3 ${isMobile ? 'py-2 text-sm' : 'py-3'} border rounded-lg leading-5 transition-all duration-200 ${
                  isDark 
                    ? 'border-gray-600 bg-gray-700 placeholder-gray-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500' 
                    : 'border-gray-200 bg-white placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                }`}
                placeholder={t('batches.searchPlaceholder')}
              />
            </div>
          </div>

          <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'space-x-3'}`}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${isMobile ? 'w-full' : ''} px-4 ${isMobile ? 'py-2 text-sm' : 'py-3'} border rounded-lg transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500' 
                  : 'border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              }`}
            >
              <option value="all">{t('batches.filters.allStatuses')}</option>
              <option value="processing">{t('batches.filters.processing')}</option>
              <option value="completed">{t('batches.filters.completed')}</option>
              <option value="failed">{t('batches.filters.failed')}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`${isMobile ? 'w-full' : ''} px-4 ${isMobile ? 'py-2 text-sm' : 'py-3'} border rounded-lg transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500' 
                  : 'border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              }`}
            >
              <option value="newest">{t('batches.filters.newest')}</option>
              <option value="oldest">{t('batches.filters.oldest')}</option>
              <option value="name">{t('batches.filters.name')}</option>
              <option value="size">{t('batches.filters.size')}</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Batches Grid/List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className={`h-8 w-8 animate-spin ${isDark ? 'text-white' : 'text-gray-900'}`} />
        </div>
      ) : filteredJobs.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-center py-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        >
          <FileText className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {searchTerm ? t('batches.noBatchesFound') : t('batches.noBatches')}
          </h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {searchTerm ? t('batches.adjustFilters') : t('batches.getStarted')}
          </p>
          {!searchTerm && (
            <div className="mt-6">
              <motion.button
                onClick={() => navigate('/import')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`inline-flex items-center ${isMobile ? 'px-4 py-2 text-sm' : 'px-4 py-2 text-sm'} font-medium text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200`}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('batches.createFirstBatch')}
              </motion.button>
            </div>
          )}
        </motion.div>
      ) : (
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'}`}>
          {filteredJobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: isMobile ? 1 : 1.02, y: isMobile ? 0 : -4 }}
              className={`rounded-xl ${isMobile ? 'p-4' : 'p-6'} border shadow-lg cursor-pointer transition-all duration-300 ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 hover:shadow-2xl hover:shadow-gray-900/50' 
                  : 'bg-white border-gray-100 hover:shadow-xl hover:shadow-gray-200/50'
              }`}
              onClick={() => navigate(`/batches/${job.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className={`text-lg font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {job.file_name || `Batch ${job.id.substring(0, 8)}`}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mt-1`}>
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  {getStatusBadge(job.status)}
                </div>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 gap-4'} mb-4`}>
                <div className="text-center">
                  <div className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    {job.total}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('batches.contacts')}
                  </div>
                </div>
                <div className="text-center">
                  <div className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    {job.emails_found || 0}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('batches.emails')}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className={`h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {job.total} {t('batches.contactsLower')}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {job.success_rate !== undefined && (
                    <div className="flex items-center space-x-1">
                      <TrendingUp className={`h-4 w-4 ${
                        job.success_rate > 70 
                          ? isDark ? 'text-green-400' : 'text-green-500'
                          : job.success_rate > 40
                            ? isDark ? 'text-yellow-400' : 'text-yellow-500'
                            : isDark ? 'text-red-400' : 'text-red-500'
                      }`} />
                      <span className={`text-sm font-medium ${
                        job.success_rate > 70 
                          ? isDark ? 'text-green-400' : 'text-green-600'
                          : job.success_rate > 40
                            ? isDark ? 'text-yellow-400' : 'text-yellow-600'
                            : isDark ? 'text-red-400' : 'text-red-600'
                      }`}>
                        {job.success_rate.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {isMobile && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      {t('batches.tapToView')}
                    </span>
                    <Eye className={`h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredJobs.length > 0 && totalPages > 1 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-center justify-center'} space-x-0 ${isMobile ? '' : 'md:space-x-2'}`}
        >
          <div className={`flex items-center ${isMobile ? 'justify-center mb-2' : ''}`}>
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('batches.pageOf')
                .replace('{current}', currentPage.toString())
                .replace('{total}', totalPages.toString())}
            </p>
          </div>
          <div className={`flex ${isMobile ? 'justify-center' : ''} space-x-2`}>
            <motion.button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`inline-flex items-center ${isMobile ? 'px-3 py-1 text-sm' : 'px-4 py-2 text-sm'} font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
            >
              {t('batches.previous')}
            </motion.button>
            <motion.button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`inline-flex items-center ${isMobile ? 'px-3 py-1 text-sm' : 'px-4 py-2 text-sm'} font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
            >
              {t('batches.next')}
            </motion.button>
          </div>
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