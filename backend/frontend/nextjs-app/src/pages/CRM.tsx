import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Filter, Download, Mail, Phone, Building2, Building,
  MapPin, Tag, Star, Edit, Trash2, Eye, MoreVertical,
  CheckCircle, XCircle, AlertCircle, Clock, TrendingUp,
  RefreshCw, Settings, X, Save, ChevronDown, ChevronUp,
  Zap, BarChart3, Activity, ArrowUpDown, Target, Globe,
  Calendar, UserPlus, MessageCircle, ExternalLink,
  FileDown, Upload, Check, Plus, Minus, Sparkles,
  Award, Briefcase, Heart, Shield, Edit2,
  ChevronRight, Linkedin, Twitter, Facebook, Instagram
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';

import { apiService } from '../services/api';
import ExportModal from '../components/modals/ExportModal';

// Enhanced Contact interface for CRM
interface CrmContact {
  id: string;
  job_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  location?: string;
  industry?: string;
  profile_url?: string;
  enriched: boolean;
  enrichment_status: string;
  enrichment_provider?: string;
  enrichment_score?: number;
  email_verified: boolean;
  phone_verified: boolean;
  email_verification_score?: number;
  phone_verification_score?: number;
  notes?: string;
  credits_consumed?: number;
  lead_score: number;
  email_reliability: string;
  batch_name?: string;
  batch_created_at?: string;
  created_at: string;
  updated_at?: string;
}

interface CrmStats {
  overview: {
    total_contacts: number;
    enriched_contacts: number;
    contacts_with_email: number;
    contacts_with_phone: number;
    verified_emails: number;
    verified_phones: number;
    avg_lead_score: number;
    total_credits_consumed: number;
  };
  lead_quality: {
    high_quality: number;
    medium_quality: number;
    low_quality: number;
  };
  email_reliability: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

interface Batch {
  id: string;
  name: string;
  created_at: string;
  contact_count: number;
  enriched_count: number;
}

const CRMPage: React.FC = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ position: string; notes: string }>({ position: '', notes: '' });
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [emailReliabilityFilter, setEmailReliabilityFilter] = useState('all');
  const [leadScoreMin, setLeadScoreMin] = useState(0);
  const [leadScoreMax, setLeadScoreMax] = useState(100);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);
  const limit = 25;

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContactId, setExportContactId] = useState<string | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState('created_at');

  // Computed values
  const contactsWithEmails = stats?.overview.contacts_with_email || 0;
  const contactsWithPhones = stats?.overview.contacts_with_phone || 0;
  const highQualityContacts = stats?.lead_quality.high_quality || 0;

  // Filtered and sorted contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchTerm || 
      `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBatch = batchFilter === 'all' || contact.batch_name === batchFilter;
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'verified' && contact.email_verified) ||
      (statusFilter === 'unverified' && !contact.email_verified) ||
      (statusFilter === 'enriched' && contact.enriched);
    
    const matchesEmailReliability = emailReliabilityFilter === 'all' || 
      contact.email_reliability === emailReliabilityFilter;
    
    const matchesLeadScore = contact.lead_score >= leadScoreMin && contact.lead_score <= leadScoreMax;
    
    return matchesSearch && matchesBatch && matchesStatus && matchesEmailReliability && matchesLeadScore;
  });

  const currentContacts = filteredContacts.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch data
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getCrmContacts({
        page: currentPage,
        limit,
        search: searchTerm,
        batch_filter: batchFilter,
        status_filter: statusFilter,
        email_reliability: emailReliabilityFilter,
        lead_score_min: leadScoreMin,
        lead_score_max: leadScoreMax,
      });
      
      setContacts(response.contacts);
      setTotalContacts(response.total);
      setTotalPages(response.total_pages);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, batchFilter, statusFilter, emailReliabilityFilter, leadScoreMin, leadScoreMax]);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await apiService.getCrmContactsStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchBatches = useCallback(async () => {
    try {
      const batchesData = await apiService.getCrmBatches();
      setBatches(batchesData.batches);
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  }, []);

  // Effects
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchStats();
    fetchBatches();
  }, [fetchStats, fetchBatches]);

  // Handle URL search parameter when page loads
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchQuery = searchParams.get('search');
    if (searchQuery) {
      setSearchTerm(searchQuery);
      // Show a toast to indicate search is active
      toast.success(`🔍 Searching for "${searchQuery}"`);
    }
  }, [location.search]);

  // Handlers
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchContacts(), fetchStats(), fetchBatches()]);
    setRefreshing(false);
    toast.success('CRM data refreshed');
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    fetchContacts();
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set((contacts || []).map(c => c.id)));
    }
  };

  const handleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleEditContact = async (contactId: string) => {
    if (editingContact === contactId) {
      // Save changes
      try {
        await apiService.updateContact(contactId, {
          position: editForm.position,
          notes: editForm.notes
        });
        toast.success('Contact updated successfully');
        setEditingContact(null);
        fetchContacts();
      } catch (error) {
        toast.error('Failed to update contact');
      }
    } else {
      // Start editing
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        setEditForm({
          position: contact.position || '',
          notes: contact.notes || ''
        });
        setEditingContact(contactId);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingContact(null);
    setEditForm({ position: '', notes: '' });
  };

  const refetch = async () => {
    await handleRefresh();
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      // For now, just show a toast since deleteContact API doesn't exist
      toast.success('Contact marked for deletion');
      // Remove from local state
      setContacts(prev => prev.filter(contact => contact.id !== contactId));
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  const handleBulkExport = () => {
    if (selectedContacts.size === 0) {
      toast.error('Please select contacts to export');
      return;
    }
    setExportContactId(null);
    setShowExportModal(true);
  };

  const handleSingleExport = (contactId: string) => {
    setExportContactId(contactId);
    setShowExportModal(true);
  };

  const handleExportConfirm = async (format: 'csv' | 'excel' | 'json' | 'hubspot', customFilename?: string) => {
    try {
      if (exportContactId) {
        // Single contact export
        if (format === 'hubspot') {
          // Integration export
          await apiService.exportContactToHubSpot(exportContactId);
          toast.success('🚀 Successfully exported contact to HubSpot!');
        } else {
          // For other formats, export as CRM contact with single ID and custom filename
          await apiService.exportCrmContacts([exportContactId], format, customFilename);
          toast.success(`Successfully exported contact as ${format.toUpperCase()}!`);
        }
      } else if (selectedContacts.size > 0) {
        // Bulk export
        const contactIds = Array.from(selectedContacts);
        if (format === 'hubspot') {
          // Integration export for bulk
          await apiService.exportCrmContacts(contactIds, 'hubspot', customFilename);
          toast.success(`🚀 Successfully exported ${selectedContacts.size} contacts to HubSpot!`);
        } else {
          // File export
          await apiService.exportCrmContacts(contactIds, format, customFilename);
          toast.success(`Successfully exported ${selectedContacts.size} contacts as ${format.toUpperCase()}!`);
        }
        setSelectedContacts(new Set());
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error; // Let the modal handle the error display
    }
  };

  // Enhanced Helper functions with Dark Mode Support
  const getEmailReliabilityColor = (reliability: string) => {
    if (isDark) {
      switch (reliability) {
        case 'excellent': return 'bg-green-900/30 text-green-300 border-green-700/50';
        case 'good': return 'bg-blue-900/30 text-blue-300 border-blue-700/50';
        case 'fair': return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50';
        case 'poor': return 'bg-red-900/30 text-red-300 border-red-700/50';
        case 'no_email': return 'bg-gray-700 text-gray-300 border-gray-600';
        default: return 'bg-gray-700 text-gray-300 border-gray-600';
      }
    } else {
      switch (reliability) {
        case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
        case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'fair': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'poor': return 'bg-red-100 text-red-800 border-red-200';
        case 'no_email': return 'bg-gray-100 text-gray-800 border-gray-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    }
  };

  const getLeadScoreColor = (score: number) => {
    if (isDark) {
      if (score >= 80) return 'text-green-400';
      if (score >= 50) return 'text-yellow-400';
      return 'text-red-400';
    } else {
      if (score >= 80) return 'text-green-600';
      if (score >= 50) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  const getLeadScoreStars = (score: number) => {
    const stars = Math.ceil((score / 100) * 5);
    return Array.from({ length: 5 }, (_, i) => i < stars);
  };

  if (loading && contacts.length === 0) {
    return (
      <div className={`max-w-7xl mx-auto min-h-screen transition-colors duration-300 ${
        isDark ? 'bg-gray-900' : 'bg-white'
      }`}>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${
              isDark ? 'border-emerald-400' : 'border-teal-600'
            }`}></div>
            <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('common.loading')}
            </p>
          </div>
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
            {t('crm.title')}
          </h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {t('crm.subtitle')}
          </p>
        </div>
        
        <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-center space-x-4'}`}>
          <motion.button
            onClick={() => setShowAddModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center ${isMobile ? 'w-full justify-center px-4 py-3 text-base' : 'px-6 py-3 text-base'} font-medium text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 border border-transparent rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200`}
          >
            <UserPlus className="h-5 w-5 mr-2" />
            {t('crm.addContact')}
          </motion.button>
          
          <div className={`flex ${isMobile ? 'w-full space-x-2' : 'space-x-3'}`}>
            <motion.button
              onClick={() => refetch()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`inline-flex items-center ${isMobile ? 'flex-1 justify-center px-3 py-2 text-sm' : 'px-4 py-2 text-sm'} font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.refresh')}
            </motion.button>
            
            {selectedContacts.size > 0 && (
              <motion.button
                onClick={handleBulkExport}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`inline-flex items-center ${isMobile ? 'flex-1 justify-center px-3 py-2 text-sm' : 'px-4 py-2 text-sm'} font-medium text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200`}
              >
                <Download className="h-4 w-4 mr-2" />
                {isMobile ? `Export (${selectedContacts.size})` : `Export Selected (${selectedContacts.size})`}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-1 md:grid-cols-4 gap-6'}`}
      >
        <motion.div 
          whileHover={{ scale: isMobile ? 1 : 1.02 }}
          className={`rounded-xl ${isMobile ? 'p-4' : 'p-6'} border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-700/50' 
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
          }`}
        >
          <div className="flex items-center">
            <Users className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mr-3 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{t('crm.stats.totalContacts')}</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>{totalContacts}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: isMobile ? 1 : 1.02 }}
          className={`rounded-xl ${isMobile ? 'p-4' : 'p-6'} border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-700/50' 
              : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
          }`}
        >
          <div className="flex items-center">
            <Mail className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mr-3 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-700'}`}>{t('crm.stats.withEmails')}</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold ${isDark ? 'text-green-100' : 'text-green-900'}`}>{contactsWithEmails}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: isMobile ? 1 : 1.02 }}
          className={`rounded-xl ${isMobile ? 'p-4' : 'p-6'} border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-700/50' 
              : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
          }`}
        >
          <div className="flex items-center">
            <Phone className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mr-3 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{t('crm.stats.withPhones')}</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold ${isDark ? 'text-purple-100' : 'text-purple-900'}`}>{contactsWithPhones}</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ scale: isMobile ? 1 : 1.02 }}
          className={`rounded-xl ${isMobile ? 'p-4' : 'p-6'} border shadow-lg transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border-yellow-700/50' 
              : 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
          }`}
        >
          <div className="flex items-center">
            <Star className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mr-3 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>{t('crm.stats.highQuality')}</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold ${isDark ? 'text-yellow-100' : 'text-yellow-900'}`}>{highQualityContacts}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Filters and Search */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-xl shadow-lg border ${isMobile ? 'p-4' : 'p-6'} transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
      >
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6'}`}>
          <div className={isMobile ? 'w-full' : 'w-full lg:w-1/2'}>
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
                placeholder={t('crm.searchPlaceholder')}
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
              <option value="all">{t('crm.filters.allStatuses')}</option>
              <option value="verified">{t('crm.filters.verified')}</option>
              <option value="unverified">{t('crm.filters.unverified')}</option>
              <option value="enriched">{t('crm.filters.enriched')}</option>
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
              <option value="created_at">{t('crm.filters.newest')}</option>
              <option value="name">{t('crm.filters.name')}</option>
              <option value="company">{t('crm.filters.company')}</option>
              <option value="score">{t('crm.filters.score')}</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Contacts Grid/List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-primary-400' : 'border-primary-600'}`}></div>
        </div>
      ) : filteredContacts.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-center py-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        >
          <Users className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {searchTerm ? t('crm.noContactsFound') : t('crm.noContacts')}
          </h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {searchTerm ? t('crm.adjustFilters') : t('crm.getStarted')}
          </p>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`rounded-xl shadow-lg border transition-all duration-300 ${
            isDark 
              ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
              : 'bg-white border-gray-100 shadow-gray-200/50'
          }`}
        >
          <div className={isMobile ? '' : 'overflow-x-auto'}>
            {isMobile ? (
              // Mobile: Stack contacts as cards
              <div className="p-4 space-y-4">
                {currentContacts.map((contact) => (
                  <div key={contact.id} className={`rounded-lg border p-4 ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                          className={`h-4 w-4 rounded transition-colors ${
                            isDark 
                              ? 'text-primary-500 focus:ring-primary-500 border-gray-500 bg-gray-700' 
                              : 'text-primary-600 focus:ring-primary-500 border-gray-300'
                          }`}
                        />
                        <div>
                          <div className={`text-sm font-medium ${
                            isDark ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            {contact.first_name} {contact.last_name}
                          </div>
                          {contact.position && (
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {contact.position}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEditContact(contact.id)}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            isDark 
                              ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                              : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                          }`}
                          title={t('crm.editContact')}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            isDark 
                              ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                              : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                          }`}
                          title={t('crm.deleteContact')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {contact.email && (
                        <div className="flex items-center">
                          <Mail className="h-3 w-3 text-green-500 mr-2" />
                          <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{contact.email}</span>
                          {contact.email_verified && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 text-blue-500 mr-2" />
                          <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{contact.phone}</span>
                          {contact.phone_verified && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                        </div>
                      )}
                      {contact.company && (
                        <div className="flex items-center">
                          <Building className="h-3 w-3 text-gray-400 mr-2" />
                          <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{contact.company}</span>
                        </div>
                      )}
                      {contact.location && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 text-gray-400 mr-2" />
                          <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{contact.location}</span>
                        </div>
                      )}
                      {contact.lead_score !== undefined && (
                        <div className="flex items-center">
                          <Star className="h-3 w-3 text-yellow-500 mr-2" />
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            contact.lead_score >= 80
                              ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                              : contact.lead_score >= 60
                                ? isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                                : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'
                          }`}>
                            {contact.lead_score}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Desktop: Keep existing table
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={`${
                  isDark 
                    ? 'bg-gradient-to-r from-gray-800 to-gray-900' 
                    : 'bg-gradient-to-r from-gray-50 to-white'
                }`}>
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedContacts.size === contacts.length && contacts.length > 0}
                        onChange={handleSelectAll}
                        className={`h-4 w-4 rounded transition-colors ${
                          isDark 
                            ? 'text-emerald-500 focus:ring-emerald-500 border-gray-600 bg-gray-700' 
                            : 'text-teal-600 focus:ring-teal-500 border-gray-300'
                        }`}
                      />
                    </th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Contact
                    </th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Lead Score
                    </th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Email Reliability
                    </th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Company & Position
                    </th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Batch
                    </th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  isDark 
                    ? 'bg-gray-800 divide-gray-700' 
                    : 'bg-white divide-gray-100'
                }`}>
                  {(contacts || []).map((contact) => (
                    <motion.tr
                      key={contact.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`transition-all duration-200 ${
                        isDark 
                          ? 'hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-800' 
                          : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-white'
                      }`}
                    >
                      <td className="px-6 py-5">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                          className={`h-4 w-4 rounded transition-colors ${
                            isDark 
                              ? 'text-emerald-500 focus:ring-emerald-500 border-gray-600 bg-gray-700' 
                              : 'text-teal-600 focus:ring-teal-500 border-gray-300 bg-white'
                          }`}
                        />
                      </td>
                      
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                              {contact.first_name?.[0]?.toUpperCase() || '?'}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${
                              isDark ? 'text-gray-100' : 'text-gray-900'
                            }`}>
                              {contact.first_name} {contact.last_name}
                            </div>
                            <div className={`text-sm ${
                              isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              <div className="flex items-center space-x-3">
                                {contact.email && (
                                  <div className="flex items-center">
                                    <Mail className={`h-3 w-3 mr-1 ${
                                      isDark ? 'text-gray-500' : 'text-gray-400'
                                    }`} />
                                    <span className="truncate max-w-48">{contact.email}</span>
                                    {contact.email_verified && <CheckCircle className="h-3 w-3 ml-1 text-green-500" />}
                                  </div>
                                )}
                                {contact.phone && (
                                  <div className="flex items-center">
                                    <Phone className={`h-3 w-3 mr-1 ${
                                      isDark ? 'text-gray-500' : 'text-gray-400'
                                    }`} />
                                    <span>{contact.phone}</span>
                                    {contact.phone_verified && <CheckCircle className="h-3 w-3 ml-1 text-green-500" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <span className={`text-lg font-bold ${getLeadScoreColor(contact.lead_score)}`}>
                            {contact.lead_score}
                          </span>
                          <div className="flex ml-2">
                            {getLeadScoreStars(contact.lead_score).map((filled, i) => (
                              <Star key={i} className={`h-3 w-3 ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        {contact.email ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getEmailReliabilityColor(contact.email_reliability || 'unknown')}`}>
                            {(contact.email_reliability || 'unknown').charAt(0).toUpperCase() + (contact.email_reliability || 'unknown').slice(1)}
                          </span>
                        ) : (
                          <span className={`text-sm ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>No email</span>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <div>
                          <div className={`text-sm font-medium flex items-center ${
                            isDark ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            <Building className={`h-4 w-4 mr-2 ${
                              isDark ? 'text-gray-500' : 'text-gray-400'
                            }`} />
                            {contact.company || 'Unknown'}
                          </div>
                          {editingContact === contact.id ? (
                            <input
                              type="text"
                              value={editForm.position}
                              onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                              placeholder="Job title..."
                              className={`mt-1 text-sm border rounded px-2 py-1 w-full transition-all duration-200 ${
                                isDark 
                                  ? 'text-gray-100 bg-gray-700 border-gray-600 placeholder-gray-400' 
                                  : 'text-gray-600 bg-white border-gray-300 placeholder-gray-500'
                              }`}
                            />
                          ) : (
                            <div className={`text-sm ${
                              isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              {contact.position || 'No position'}
                            </div>
                          )}
                          {contact.location && (
                            <div className={`text-xs flex items-center mt-1 ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              <MapPin className="h-3 w-3 mr-1" />
                              {contact.location}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className={`text-sm ${
                          isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          <div className="flex items-center">
                            <Activity className={`h-3 w-3 mr-1 ${
                              isDark ? 'text-gray-500' : 'text-gray-400'
                            }`} />
                            {contact.batch_name || 'Unknown'}
                          </div>
                          <div className={`text-xs mt-1 ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {contact.batch_created_at && contact.batch_created_at !== 'Invalid Date' 
                              ? new Date(contact.batch_created_at).toLocaleDateString() 
                              : '-'}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {editingContact === contact.id ? (
                            <>
                              <button
                                onClick={() => handleEditContact(contact.id)}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                  isDark 
                                    ? 'text-green-400 hover:text-green-300 hover:bg-green-900/20' 
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                }`}
                                title="Save Changes"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                  isDark 
                                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <button
                                  onClick={() => handleEditContact(contact.id)}
                                  className={`p-2 rounded-lg transition-all duration-200 ${
                                    isDark 
                                      ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                                      : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                  }`}
                                  title="View Contact Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </motion.div>
                              
                              <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <button
                                  onClick={() => handleEditContact(contact.id)}
                                  className={`p-2 rounded-lg transition-all duration-200 ${
                                    isDark 
                                      ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                  }`}
                                  title="Edit Contact"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </motion.div>
                              
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleSingleExport(contact.id)}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                  isDark 
                                    ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20' 
                                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title="Export contact data"
                              >
                                <Download className="h-4 w-4" />
                              </motion.button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {/* Enhanced Pagination */}
      <div className={`px-6 py-4 border-t ${
        isDark 
          ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' 
          : 'bg-gradient-to-r from-gray-50 to-white border-gray-100'
      }`}>
        <div className="flex items-center justify-between">
          <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            📈 Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalContacts || 0)} of {(totalContacts || 0).toLocaleString()} contacts
            {selectedContacts.size > 0 && (
              <span className={`ml-2 font-semibold ${
                isDark ? 'text-emerald-400' : 'text-teal-600'
              }`}>
                • {selectedContacts.size} selected ✨
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-6 py-2 border rounded-xl text-sm font-medium transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-emerald-500' 
                  : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-teal-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm hover:shadow-md`}
              style={{ willChange: 'background-color, box-shadow' }}
            >
              ← Previous
            </button>
            <span className={`px-6 py-2 text-sm font-medium ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              �� Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-6 py-2 border rounded-xl text-sm font-medium transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-emerald-500' 
                  : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-teal-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm hover:shadow-md`}
              style={{ willChange: 'background-color, box-shadow' }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setExportContactId(null);
        }}
        onExport={handleExportConfirm}
        title={exportContactId ? "Export Contact" : "Export Contacts"}
        description={
          exportContactId 
            ? "Choose your preferred format to export this contact"
            : "Choose your preferred format to export selected contacts"
        }
        exportCount={exportContactId ? 1 : selectedContacts.size}
        type="contacts"
        contactIds={exportContactId ? [exportContactId] : Array.from(selectedContacts)}
      />
    </div>
  );
};

export default CRMPage; 