import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, Filter, ArrowUpDown, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertTriangle, FileDown, Package,
  RefreshCw, Eye, ExternalLink, MoreVertical, Trash2, Pause,
  Play, BarChart3, TrendingUp, Users, Mail, Phone, Zap,
  AlertCircle, Info, Calendar, Timer
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// Updated hooks for production
import { useJobs, useExport, useJob } from '../hooks/useApi';

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
  // Hooks
  const { jobs: jobsData, loading, error, refetch } = useJobs();
  const { exportData, exporting, error: exportError } = useExport();
  
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
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    toast.success('Batches refreshed');
  };

  const handleExport = async (jobId: string, format: 'csv' | 'excel' | 'json' = 'csv') => {
    try {
      await exportData(jobId, format);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleBulkExport = async (format: 'csv' | 'excel' | 'json' = 'csv') => {
    if (selectedJobs.size === 0) {
      toast.error('Please select jobs to export');
      return;
    }

    const completedSelectedJobs = Array.from(selectedJobs).filter(jobId => {
      const job = jobs.find(j => j.id === jobId);
      return job && job.status === 'completed';
    });

    if (completedSelectedJobs.length === 0) {
      toast.error('No completed jobs selected for export');
      return;
    }

    for (const jobId of completedSelectedJobs) {
      await handleExport(jobId, format);
    }
    
    setSelectedJobs(new Set());
    toast.success(`Exported ${completedSelectedJobs.length} batches`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading batches...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Batches</h1>
          <p className="text-gray-600 mt-1">View and export your enriched contact data</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <Link
            to="/import"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Package className="h-4 w-4 mr-2" />
            New Import
          </Link>
        </div>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                <div>
                  <h4 className="text-sm font-semibold text-red-800">Failed to load batches</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Batches</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{jobs.length}</p>
              <div className="flex items-center mt-2 text-sm">
                <BarChart3 className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-blue-600 font-medium">{totalContacts.toLocaleString()} contacts</span>
              </div>
            </div>
            <Package className="w-12 h-12 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Completed</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{completedJobs.length}</p>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">
                  {jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0}% success rate
                </span>
              </div>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Active</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">{activeJobs.length}</p>
              <div className="flex items-center mt-2 text-sm">
                <Zap className="h-4 w-4 text-yellow-500 mr-1" />
                <span className="text-yellow-600 font-medium">Currently processing</span>
              </div>
            </div>
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Total Emails</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {jobs.reduce((sum, job) => sum + (job.emails_found || 0), 0).toLocaleString()}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <Mail className="h-4 w-4 text-purple-500 mr-1" />
                <span className="text-purple-600 font-medium">Enriched contacts</span>
              </div>
            </div>
            <Mail className="w-12 h-12 text-purple-500" />
          </div>
        </motion.div>
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          {/* Search */}
          <div className="w-full lg:w-1/3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm text-gray-900 transition-all duration-200"
                placeholder="Search batches by name or ID..."
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="credit_insufficient">Credit Issues</option>
            </select>
            
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('_');
                setSortBy(field);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            >
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
              <option value="total_desc">Most Contacts</option>
              <option value="completed_desc">Most Processed</option>
              <option value="success_rate_desc">Highest Success Rate</option>
            </select>

            {/* Bulk Actions */}
            {selectedJobs.size > 0 && (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkExport('csv')}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Export CSV ({selectedJobs.size})
                </button>
                <button
                  onClick={() => setSelectedJobs(new Set())}
                  className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Batches table */}
      <div className="bg-white shadow-lg overflow-hidden rounded-xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Batch Details
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Results
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {currentJobs.map((job) => (
                <motion.tr 
                  key={job.id} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 group"
                >
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => handleSelectJob(job.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {job.file_name || `Batch Import`}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        ID: {job.id.substring(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {job.total.toLocaleString()} contacts
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="mr-3">
                        {getStatusIcon(job.status)}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(job.status)}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="w-48">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-600">{job.completed}/{job.total}</span>
                        <span className="font-semibold text-gray-900">{job.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            job.status === 'completed' 
                              ? 'bg-green-500' 
                              : job.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          } ${job.status === 'processing' ? 'animate-pulse' : ''}`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <Mail className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-gray-600 mr-2">Emails:</span>
                        <span className="font-semibold text-gray-900">{job.emails_found || 0}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="h-3 w-3 text-blue-500 mr-1" />
                        <span className="text-gray-600 mr-2">Phones:</span>
                        <span className="font-semibold text-gray-900">{job.phones_found || 0}</span>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block ${
                        (job.success_rate || 0) >= 80 
                          ? 'text-green-700 bg-green-100' 
                          : (job.success_rate || 0) >= 50 
                            ? 'text-yellow-700 bg-yellow-100' 
                            : 'text-red-700 bg-red-100'
                      }`}>
                        {job.success_rate?.toFixed(1) || 0}% Success
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-700">
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(job.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {/* View Details */}
                      <Link
                        to={`/batches/${job.id}`}
                        className="p-2 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-all duration-200"
                        title="View Batch Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>

                      {/* Export Actions */}
                      {job.status === 'completed' && (
                        <>
                          <button 
                            onClick={() => handleExport(job.id, 'csv')}
                            disabled={exporting === job.id}
                            className="p-2 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50 transition-all duration-200"
                            title="Export as CSV"
                          >
                            {exporting === job.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                          
                          <button 
                            onClick={() => handleExport(job.id, 'excel')}
                            disabled={exporting === job.id}
                            className="p-2 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-all duration-200"
                            title="Export as Excel"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {/* More Actions */}
                      <button 
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
                        title="More Options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 flex items-center justify-between border-t border-gray-100">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Showing <span className="font-bold">{indexOfFirstJob + 1}</span> to <span className="font-bold">
                  {Math.min(indexOfLastJob, filteredJobs.length)}
                </span> of <span className="font-bold">{filteredJobs.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-3 py-2 rounded-l-lg border border-gray-200 bg-white text-sm font-medium transition-all duration-200 ${
                    currentPage === 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-200 bg-primary-50 text-sm font-semibold text-primary-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`relative inline-flex items-center px-3 py-2 rounded-r-lg border border-gray-200 bg-white text-sm font-medium transition-all duration-200 ${
                    currentPage === totalPages || totalPages === 0
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filteredJobs.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No batches found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search terms or filters' 
              : 'Start by importing some contacts'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <div className="mt-6">
              <Link
                to="/import"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Import Contacts
              </Link>
            </div>
          )}
        </div>
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
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
                  <button
                    onClick={() => setShowJobDetails(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Detailed job information would be displayed here, including:
                    </p>
                    <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
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
    </div>
  );
};

export default BatchesPage;