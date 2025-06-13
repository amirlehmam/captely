import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Edit2, Save, X, Mail, Phone, Building, MapPin, 
  User, FileText, ExternalLink, Download, Upload, CheckCircle, 
  XCircle, AlertCircle, Clock, Star, Tag, MessageSquare,
  MoreVertical, Trash2, Copy, Eye, TrendingUp, Target,
  Calendar, Globe, Linkedin, Filter, Search, RefreshCw,
  Settings, Users, Zap, BarChart3
} from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useJob } from '../hooks/useApi';
import { apiService, Contact, Job } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const BatchDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  
  // Hooks
  const { job, loading: jobLoading } = useJob(jobId || '');
  
  // State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Contact>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Fetch contacts
  const fetchContacts = async (currentPage = 1) => {
    if (!jobId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getJobContacts(jobId, currentPage, limit);
      setContacts(response.contacts);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts(page);
  }, [jobId, page]);

  // Handle contact editing
  const startEdit = (contact: Contact) => {
    setEditingContact(contact.id);
    setEditData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      position: contact.position,
      company: contact.company,
      location: contact.location,
      industry: contact.industry,
      notes: contact.notes || ''
    });
  };

  const cancelEdit = () => {
    setEditingContact(null);
    setEditData({});
  };

  const saveEdit = async (contactId: string) => {
    try {
      setUpdating(contactId);
      const updatedContact = await apiService.updateContact(contactId, editData);
      
      // Update local state
      setContacts(prev => prev.map(contact => 
        contact.id === contactId ? updatedContact : contact
      ));
      
      setEditingContact(null);
      setEditData({});
      toast.success(t('batches.details.contactUpdated'));
    } catch (err: any) {
      toast.error(err.message || t('batches.details.updateFailed'));
    } finally {
      setUpdating(null);
    }
  };

  // Handle HubSpot export
  const exportToHubSpot = async (contactId: string) => {
    try {
      setExporting(contactId);
      await apiService.exportContactToHubSpot(contactId);
      toast.success(t('batches.details.exportSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('batches.details.exportFailed'));
    } finally {
      setExporting(null);
    }
  };

  const exportBatchToHubSpot = async () => {
    if (!jobId) return;
    
    try {
      setExporting('batch');
      const result = await apiService.exportJobToHubSpot(jobId);
      toast.success(t('batches.details.batchExportSuccess').replace('{count}', result.exported_count.toString()));
    } catch (err: any) {
      toast.error(err.message || t('batches.details.batchExportFailed'));
    } finally {
      setExporting(null);
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'enriched' && contact.enriched) ||
      (statusFilter === 'not_enriched' && !contact.enriched) ||
      (statusFilter === 'verified' && contact.email_verified);
    
    return matchesSearch && matchesStatus;
  });

  // Handle selection
  const handleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  // Status badge helper
  const getStatusBadge = (contact: Contact) => {
    if (contact.enriched && contact.email_verified) {
      return <span className={`px-2 py-1 text-xs font-medium rounded-full ${
        isDark 
          ? 'bg-green-900/30 text-green-400' 
          : 'bg-green-100 text-green-800'
      }`}>{t('batches.details.verified')}</span>;
    } else if (contact.enriched) {
      return <span className={`px-2 py-1 text-xs font-medium rounded-full ${
        isDark 
          ? 'bg-blue-900/30 text-blue-400' 
          : 'bg-blue-100 text-blue-800'
      }`}>{t('batches.details.enriched')}</span>;
    } else {
      return <span className={`px-2 py-1 text-xs font-medium rounded-full ${
        isDark 
          ? 'bg-gray-900/30 text-gray-400' 
          : 'bg-gray-100 text-gray-800'
      }`}>{t('batches.details.pending')}</span>;
    }
  };

  if (jobLoading || loading) {
    return (
      <div className={`flex items-center justify-center min-h-96 transition-all duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDark ? 'border-primary-400' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('batches.details.loadingDetails')}</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={`text-center py-12 min-h-screen transition-all duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div>
          <AlertCircle className={`mx-auto h-12 w-12 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('batches.details.batchNotFound')}</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('batches.details.batchNotFoundDesc')}</p>
        <div className="mt-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                to="/batches" 
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-all duration-200 ${
                  isDark 
                    ? 'bg-primary-500 hover:bg-primary-600' 
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('batches.details.backToBatches')}
          </Link>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 min-h-screen transition-all duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <motion.button
            onClick={() => navigate('/batches')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md transition-all duration-200 ${
              isDark 
                ? 'border-gray-600 text-gray-200 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-gray-900' 
                : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
            }`}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('batches.details.backToBatches')}
          </motion.button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {job.file_name || `Batch ${job.id.substring(0, 8)}`}
            </h1>
            <div className="flex items-center space-x-4 mt-1">
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {job.total} {t('batches.details.contacts').toLowerCase()}
              </span>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {t('common.createdAt')} {new Date(job.created_at).toLocaleDateString()}
              </span>
              {getStatusBadge(job as any)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.button
            onClick={exportBatchToHubSpot}
            disabled={exporting === 'batch'}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white transition-all duration-200 disabled:opacity-50 ${
              isDark 
                ? 'bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400 focus:ring-offset-gray-900' 
                : 'bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500'
            }`}
          >
            {exporting === 'batch' ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {t('batches.details.exporting')}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {t('batches.details.exportToHubSpot')}
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Batch Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-700/50 hover:shadow-blue-500/20' 
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-blue-500/20'
          }`}
        >
          <div className="flex items-center">
            <Users className={`h-8 w-8 mr-3 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{t('batches.details.totalContacts')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>{job.total}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-700/50 hover:shadow-green-500/25' 
              : 'bg-gradient-to-br from-green-50 to-green-100 border-green-300 hover:shadow-green-500/25'
          }`}
        >
          <div className="flex items-center">
            <Mail className={`h-8 w-8 mr-3 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-700'}`}>{t('batches.details.emailsFound')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-green-100' : 'text-green-900'}`}>{job.emails_found || 0}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-700/50 hover:shadow-purple-500/20' 
              : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-purple-500/20'
          }`}
        >
          <div className="flex items-center">
            <Phone className={`h-8 w-8 mr-3 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{t('batches.details.phonesFound')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-purple-100' : 'text-purple-900'}`}>{job.phones_found || 0}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: 1.02, y: -4 }}
          className={`rounded-xl p-6 border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-yellow-900/20 to-orange-900/10 border-yellow-700/50 hover:shadow-yellow-500/20' 
              : 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 hover:shadow-yellow-500/20'
          }`}
        >
          <div className="flex items-center">
            <TrendingUp className={`h-8 w-8 mr-3 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>{t('batches.details.successRate')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-yellow-100' : 'text-yellow-900'}`}>{job.success_rate?.toFixed(1) || 0}%</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`shadow-lg rounded-xl border p-6 transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          <div className="w-full lg:w-1/2">
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
                placeholder={t('batches.details.searchPlaceholder')}
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-4 py-3 border rounded-lg transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500' 
                  : 'border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              }`}
            >
              <option value="all">{t('batches.details.allStatus')}</option>
              <option value="enriched">{t('batches.details.enriched')}</option>
              <option value="not_enriched">{t('batches.details.notEnriched')}</option>
              <option value="verified">{t('batches.details.verified')}</option>
            </select>

            <motion.button
              onClick={() => fetchContacts(page)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-4 py-3 border rounded-lg transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500' 
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.button>

            {selectedContacts.size > 0 && (
              <motion.button
                onClick={() => {/* Handle bulk actions */}}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-4 py-3 text-white rounded-lg transition-all duration-200 ${
                  isDark 
                    ? 'bg-primary-500 hover:bg-primary-600' 
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {t('batches.details.bulkActions').replace('{count}', selectedContacts.size.toString())}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Contacts Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
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
                    checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
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
                  {t('batches.details.contact')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.details.emailAndPhone')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.details.companyAndPosition')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('common.status')}
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {t('batches.details.notes')}
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">{t('common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-100'}`}>
              {filteredContacts.map((contact) => (
                <motion.tr 
                  key={contact.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`transition-all duration-200 ${
                    isDark 
                      ? 'hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-750' 
                      : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-white'
                  }`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => handleSelectContact(contact.id)}
                      className={`rounded text-primary-600 focus:ring-primary-500 ${
                        isDark 
                          ? 'border-gray-500 bg-gray-700' 
                          : 'border-gray-300'
                      }`}
                    />
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingContact === contact.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editData.first_name || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, first_name: e.target.value }))}
                          className={`block w-full border rounded px-2 py-1 text-sm transition-all duration-200 ${
                            isDark 
                              ? 'border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400' 
                              : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder={t('batches.details.firstName')}
                        />
                        <input
                          type="text"
                          value={editData.last_name || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, last_name: e.target.value }))}
                          className={`block w-full border rounded px-2 py-1 text-sm transition-all duration-200 ${
                            isDark 
                              ? 'border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400' 
                              : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder={t('batches.details.lastName')}
                        />
                      </div>
                    ) : (
                      <div>
                        <div className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                          {contact.first_name} {contact.last_name}
                        </div>
                        {contact.location && (
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            {contact.location}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center text-sm">
                          <Mail className="h-3 w-3 text-green-500 mr-2" />
                          <span className={`${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{contact.email}</span>
                          {contact.email_verified && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="h-3 w-3 text-blue-500 mr-2" />
                          <span className={`${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{contact.phone}</span>
                          {contact.phone_verified && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingContact === contact.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editData.company || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, company: e.target.value }))}
                          className={`block w-full border rounded px-2 py-1 text-sm transition-all duration-200 ${
                            isDark 
                              ? 'border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400' 
                              : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder={t('batches.details.company')}
                        />
                        <input
                          type="text"
                          value={editData.position || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, position: e.target.value }))}
                          className={`block w-full border rounded px-2 py-1 text-sm transition-all duration-200 ${
                            isDark 
                              ? 'border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400' 
                              : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder={t('batches.details.position')}
                        />
                      </div>
                    ) : (
                      <div>
                        {contact.company && (
                          <div className={`text-sm font-medium flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            <Building className="h-3 w-3 text-gray-400 mr-1" />
                            {contact.company}
                          </div>
                        )}
                        {contact.position && (
                          <div className="text-xs text-gray-500 mt-1">
                            {contact.position}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {getStatusBadge(contact)}
                      {contact.enrichment_provider && (
                        <div className="text-xs text-gray-500">
                          {t('batches.details.via')} {contact.enrichment_provider}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingContact === contact.id ? (
                      <textarea
                        value={editData.notes || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                        className={`block w-full border rounded px-2 py-1 text-sm transition-all duration-200 ${
                          isDark 
                            ? 'border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400' 
                            : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500'
                        }`}
                        rows={2}
                        placeholder={t('batches.details.addNotes')}
                      />
                    ) : (
                      <div className={`text-sm max-w-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {contact.notes || (
                          <span className={`italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('batches.details.noNotes')}</span>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {editingContact === contact.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(contact.id)}
                            disabled={updating === contact.id}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              isDark 
                                ? 'text-green-400 hover:text-green-300 hover:bg-green-900/20' 
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                            }`}
                          >
                            {updating === contact.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              isDark 
                                ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(contact)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              isDark 
                                ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                            title={t('batches.details.editContact')}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          
                          {contact.email && (
                            <button
                              onClick={() => exportToHubSpot(contact.id)}
                              disabled={exporting === contact.id}
                              className={`p-2 rounded-lg transition-all duration-200 ${
                                isDark 
                                  ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-900/20' 
                                  : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                              }`}
                              title={t('batches.details.exportContact')}
                            >
                              {exporting === contact.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          
                          {contact.profile_url && (
                            <a
                              href={contact.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`p-2 rounded-lg transition-all duration-200 ${
                                isDark 
                                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                                  : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                              }`}
                              title={t('batches.details.viewLinkedIn')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </>
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
          <div className={`px-6 py-4 flex items-center justify-between border-t ${
            isDark 
              ? 'bg-gray-750 border-gray-700' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('batches.details.pageOf').replace('{current}', page.toString()).replace('{total}', totalPages.toString())}
              </p>
            </div>
            <div className="flex space-x-2">
              <motion.button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-2 border rounded text-sm disabled:opacity-50 transition-all duration-200 ${
                  isDark 
                    ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('batches.details.previous')}
              </motion.button>
              <motion.button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-2 border rounded text-sm disabled:opacity-50 transition-all duration-200 ${
                  isDark 
                    ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('batches.details.next')}
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Empty state */}
      {filteredContacts.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center py-12 rounded-xl ${
            isDark 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-100'
          }`}
        >
          <Users className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('batches.details.noContactsFound')}</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {searchTerm || statusFilter !== 'all' 
              ? t('batches.details.adjustFilters')
              : t('batches.details.batchHasNoContacts')
            }
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default BatchDetailPage; 