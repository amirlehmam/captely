import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Filter, Download, Mail, Phone, Building2, 
  MapPin, Tag, Star, Edit, Trash2, Eye, MoreVertical,
  CheckCircle, XCircle, AlertCircle, Clock, TrendingUp,
  RefreshCw, Settings, X, Save, ChevronDown, ChevronUp,
  Zap, BarChart3, Activity, ArrowUpDown, Target, Globe,
  Calendar, UserPlus, MessageCircle, ExternalLink,
  FileDown, Upload, Check, Plus, Minus, Sparkles,
  Award, Briefcase, Heart, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

import { apiService } from '../services/api';

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
      setSelectedContacts(new Set(contacts.map(c => c.id)));
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

  const handleBulkExport = async (exportType: 'hubspot' | 'csv') => {
    if (selectedContacts.size === 0) {
      toast.error('Please select contacts to export');
      return;
    }

    try {
      await apiService.bulkExportCrmContacts(Array.from(selectedContacts), exportType);
      setSelectedContacts(new Set());
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleSingleExport = async (contactId: string) => {
    try {
      await apiService.exportContactToHubSpot(contactId);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Helper functions
  const getEmailReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'fair': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'poor': return 'bg-red-100 text-red-800 border-red-200';
      case 'no_email': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLeadScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
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
    <div className={`max-w-7xl mx-auto min-h-screen transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Enhanced Header with Better Content */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 relative overflow-hidden"
      >
        {/* Background Pattern */}
        <div className={`absolute inset-0 opacity-30 ${
          isDark ? 'bg-gradient-to-r from-emerald-900/20 to-blue-900/20' : 'bg-gradient-to-r from-emerald-50 to-blue-50'
        }`}>
          <div className="absolute inset-0" style={{
            backgroundImage: isDark 
              ? 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }} />
        </div>
        
        <div className="relative z-10 p-8 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-4">
              {/* Main Title with Icon */}
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl ${
                  isDark 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25'
                }`}>
                  <Users className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className={`text-4xl font-bold mb-2 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    ✨ Contacts Management
                  </h1>
                  <div className="flex items-center space-x-2">
                    <Award className={`h-5 w-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-lg font-medium ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>
                      Advanced CRM Dashboard
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced Description */}
              <div className="max-w-3xl space-y-3">
                <p className={`text-lg leading-relaxed ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Manage and enrich your contact database with AI-powered insights. Track lead scores, 
                  verify email deliverability, and export to your favorite CRM platforms seamlessly.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Shield className={`h-4 w-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      Email Verification
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                      Lead Scoring
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Target className={`h-4 w-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                    <span className={`text-sm font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                      Smart Enrichment
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Heart className={`h-4 w-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                    <span className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                      CRM Integration
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`inline-flex items-center px-6 py-3 border rounded-xl font-medium transition-all duration-200 ${
                  isDark 
                    ? 'border-gray-600 text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50' 
                    : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50'
                } shadow-lg hover:shadow-xl disabled:cursor-not-allowed`}
                style={{ willChange: 'background-color, transform' }}
              >
                <RefreshCw className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </button>
              
              {selectedContacts.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkExport('hubspot')}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    style={{ willChange: 'transform, box-shadow' }}
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Export to HubSpot ({selectedContacts.size})
                  </button>
                  <button
                    onClick={() => handleBulkExport('csv')}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    style={{ willChange: 'transform, box-shadow' }}
                  >
                    <FileDown className="h-5 w-5 mr-2" />
                    Export CSV ({selectedContacts.size})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Stats Cards with Dark Mode */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
        >
          {/* Total Contacts Card */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -4 }}
            className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-700/50 hover:shadow-blue-500/25' 
                : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-blue-500/25'
            }`}
            style={{ willChange: 'transform, box-shadow' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold mb-2 ${
                  isDark ? 'text-blue-300' : 'text-blue-600'
                }`}>
                  Total Contacts
                </p>
                <p className={`text-3xl font-bold ${
                  isDark ? 'text-blue-100' : 'text-blue-900'
                }`}>
                  {stats.overview.total_contacts.toLocaleString()}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className={`h-4 w-4 mr-1 ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <span className={`text-xs font-medium ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    Database size
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                isDark 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-blue-500/10 text-blue-600'
              }`}>
                <Users className="h-8 w-8" />
              </div>
            </div>
          </motion.div>

          {/* Enriched Contacts Card */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -4 }}
            className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border-emerald-700/50 hover:shadow-emerald-500/25' 
                : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-emerald-500/25'
            }`}
            style={{ willChange: 'transform, box-shadow' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold mb-2 ${
                  isDark ? 'text-emerald-300' : 'text-emerald-600'
                }`}>
                  Enriched Contacts
                </p>
                <p className={`text-3xl font-bold ${
                  isDark ? 'text-emerald-100' : 'text-emerald-900'
                }`}>
                  {stats.overview.enriched_contacts.toLocaleString()}
                </p>
                <div className="flex items-center mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    isDark 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {((stats.overview.enriched_contacts / stats.overview.total_contacts) * 100).toFixed(1)}% success
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                isDark 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-emerald-500/10 text-emerald-600'
              }`}>
                <Zap className="h-8 w-8" />
              </div>
            </div>
          </motion.div>

          {/* Lead Score Card */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -4 }}
            className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-700/50 hover:shadow-purple-500/25' 
                : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-purple-500/25'
            }`}
            style={{ willChange: 'transform, box-shadow' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold mb-2 ${
                  isDark ? 'text-purple-300' : 'text-purple-600'
                }`}>
                  Avg Lead Score
                </p>
                <p className={`text-3xl font-bold ${
                  isDark ? 'text-purple-100' : 'text-purple-900'
                }`}>
                  {stats.overview.avg_lead_score.toFixed(1)}
                </p>
                <div className="flex items-center mt-2">
                  {getLeadScoreStars(stats.overview.avg_lead_score).map((filled, i) => (
                    <Star key={i} className={`h-4 w-4 ${
                      filled 
                        ? 'text-yellow-400 fill-current' 
                        : isDark ? 'text-gray-600' : 'text-gray-300'
                    }`} />
                  ))}
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                isDark 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'bg-purple-500/10 text-purple-600'
              }`}>
                <Target className="h-8 w-8" />
              </div>
            </div>
          </motion.div>

          {/* Credits Used Card */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -4 }}
            className={`rounded-2xl p-6 border shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-amber-900/30 to-orange-800/20 border-amber-700/50 hover:shadow-amber-500/25' 
                : 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 hover:shadow-amber-500/25'
            }`}
            style={{ willChange: 'transform, box-shadow' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold mb-2 ${
                  isDark ? 'text-amber-300' : 'text-amber-600'
                }`}>
                  Credits Consumed
                </p>
                <p className={`text-3xl font-bold ${
                  isDark ? 'text-amber-100' : 'text-amber-900'
                }`}>
                  {stats.overview.total_credits_consumed.toFixed(0)}
                </p>
                <div className="flex items-center mt-2">
                  <Briefcase className={`h-4 w-4 mr-1 ${
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  }`} />
                  <span className={`text-xs font-medium ${
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  }`}>
                    Total investment
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                isDark 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'bg-amber-500/10 text-amber-600'
              }`}>
                <BarChart3 className="h-8 w-8" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Enhanced Search and Filters with Dark Mode */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl shadow-lg border p-6 mb-6 transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
        style={{ willChange: 'background-color, border-color' }}
      >
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Enhanced Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Search contacts by name, email, company..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl transition-all duration-200 ${
                  isDark 
                    ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500' 
                    : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
                } focus:outline-none shadow-sm hover:shadow-md`}
                style={{ willChange: 'border-color, box-shadow' }}
              />
            </div>
          </div>

          {/* Enhanced Batch Filter */}
          <div className="min-w-48">
            <select
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                handleFilterChange();
              }}
              className={`w-full px-4 py-3 border rounded-xl font-medium transition-all duration-200 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500' 
                  : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
              } focus:outline-none shadow-sm hover:shadow-md`}
              style={{ willChange: 'border-color, box-shadow' }}
            >
              <option value="all">📊 All Batches</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>
                  📁 {batch.name} ({batch.contact_count})
                </option>
              ))}
            </select>
          </div>

          {/* Enhanced Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-6 py-3 border rounded-xl font-medium transition-all duration-200 ${
              isDark 
                ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600' 
                : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
            } shadow-sm hover:shadow-md`}
            style={{ willChange: 'background-color, box-shadow' }}
          >
            <Filter className="h-5 w-5 mr-2" />
            Advanced Filters
            {showFilters ? <ChevronUp className="h-5 w-5 ml-2" /> : <ChevronDown className="h-5 w-5 ml-2" />}
          </button>
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      handleFilterChange();
                    }}
                    className={`w-full px-3 py-2 border rounded-lg transition-all duration-200 ${
                      isDark 
                        ? 'border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-emerald-500' 
                        : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500'
                    } focus:outline-none`}
                  >
                    <option value="all">All Status</option>
                    <option value="enriched">✅ Enriched</option>
                    <option value="not_enriched">⏳ Not Enriched</option>
                    <option value="verified">🔒 Email Verified</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>Email Reliability</label>
                  <select
                    value={emailReliabilityFilter}
                    onChange={(e) => {
                      setEmailReliabilityFilter(e.target.value);
                      handleFilterChange();
                    }}
                    className={`w-full px-3 py-2 border rounded-lg transition-all duration-200 ${
                      isDark 
                        ? 'border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-emerald-500' 
                        : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500'
                    } focus:outline-none`}
                  >
                    <option value="all">All Reliability</option>
                    <option value="excellent">🟢 Excellent</option>
                    <option value="good">🔵 Good</option>
                    <option value="fair">🟡 Fair</option>
                    <option value="poor">🔴 Poor</option>
                    <option value="no_email">⚫ No Email</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>Lead Score Range</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={leadScoreMin}
                      onChange={(e) => setLeadScoreMin(Number(e.target.value))}
                      className={`w-16 px-2 py-2 border rounded text-sm transition-all duration-200 ${
                        isDark 
                          ? 'border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-emerald-500' 
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500'
                      } focus:outline-none`}
                    />
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>to</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={leadScoreMax}
                      onChange={(e) => setLeadScoreMax(Number(e.target.value))}
                      className={`w-16 px-2 py-2 border rounded text-sm transition-all duration-200 ${
                        isDark 
                          ? 'border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-emerald-500' 
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500'
                      } focus:outline-none`}
                    />
                    <button
                      onClick={handleFilterChange}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      ✨ Apply
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Enhanced Contacts Table with Dark Mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl shadow-lg border overflow-hidden transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
        style={{ willChange: 'background-color, border-color' }}
      >
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            <thead className={`${
              isDark 
                ? 'bg-gradient-to-r from-gray-800 to-gray-750' 
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
                  👤 Contact
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  ⭐ Lead Score
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  📧 Email Reliability
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  🏢 Company & Position
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  📊 Batch
                </th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  ⚡ Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {contacts.map((contact) => (
                <motion.tr
                  key={contact.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => handleSelectContact(contact.id)}
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
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
                        <div className="text-sm font-medium text-gray-900">
                          {contact.first_name} {contact.last_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div className="flex items-center space-x-3">
                            {contact.email && (
                              <div className="flex items-center">
                                <Mail className="h-3 w-3 mr-1 text-gray-400" />
                                <span className="truncate max-w-48">{contact.email}</span>
                                {contact.email_verified && <CheckCircle className="h-3 w-3 ml-1 text-green-500" />}
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center">
                                <Phone className="h-3 w-3 mr-1 text-gray-400" />
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getEmailReliabilityColor(contact.email_reliability)}`}>
                        {contact.email_reliability.charAt(0).toUpperCase() + contact.email_reliability.slice(1)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">No email</span>
                    )}
                  </td>

                  <td className="px-6 py-5">
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                        {contact.company || 'Unknown'}
                      </div>
                      {editingContact === contact.id ? (
                        <input
                          type="text"
                          value={editForm.position}
                          onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                          placeholder="Job title..."
                          className="mt-1 text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 w-full"
                        />
                      ) : (
                        <div className="text-sm text-gray-600">
                          {contact.position || 'No position'}
                        </div>
                      )}
                      {contact.location && (
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {contact.location}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center">
                        <Activity className="h-3 w-3 mr-1 text-gray-400" />
                        {contact.batch_name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {contact.batch_created_at ? new Date(contact.batch_created_at).toLocaleDateString() : '-'}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {editingContact === contact.id ? (
                        <>
                          <button
                            onClick={() => handleEditContact(contact.id)}
                            className="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50 transition-all duration-200"
                            title="Save Changes"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditContact(contact.id)}
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                            title="Edit Contact"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleSingleExport(contact.id)}
                            className="text-orange-500 hover:text-orange-600 p-2 rounded-lg hover:bg-orange-50 transition-all duration-200"
                            title="Export to HubSpot"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
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
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalContacts)} of {totalContacts.toLocaleString()} contacts
              {selectedContacts.size > 0 && (
                <span className="ml-2 text-teal-600">
                  • {selectedContacts.size} selected
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CRMPage; 