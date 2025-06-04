import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Filter, Download, Mail, Phone, Building2, 
  MapPin, Tag, Star, Edit, Trash2, Eye, MoreVertical,
  CheckCircle, XCircle, AlertCircle, Clock, TrendingUp,
  RefreshCw, Settings, X, Save, ChevronDown, ChevronUp,
  Zap, BarChart3, Activity, ArrowUpDown, Target, Globe,
  Calendar, UserPlus, MessageCircle, ExternalLink,
  FileDown, Upload, Check, Plus, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

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
      <div className="max-w-7xl mx-auto bg-white min-h-screen">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading CRM contacts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📇 Contacts CRM
            </h1>
            <p className="text-gray-600">
              Unified view of all your enriched contacts from all batches
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {selectedContacts.size > 0 && (
              <>
                <button
                  onClick={() => handleBulkExport('hubspot')}
                  className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all duration-200"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Export to HubSpot ({selectedContacts.size})
                </button>
                <button
                  onClick={() => handleBulkExport('csv')}
                  className="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all duration-200"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export CSV ({selectedContacts.size})
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-semibold">Total Contacts</p>
                <p className="text-2xl font-bold text-blue-900">{stats.overview.total_contacts.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-semibold">Enriched</p>
                <p className="text-2xl font-bold text-green-900">{stats.overview.enriched_contacts.toLocaleString()}</p>
                <p className="text-xs text-green-600">
                  {((stats.overview.enriched_contacts / stats.overview.total_contacts) * 100).toFixed(1)}% success
                </p>
              </div>
              <Zap className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-semibold">Avg Lead Score</p>
                <p className="text-2xl font-bold text-purple-900">{stats.overview.avg_lead_score.toFixed(1)}</p>
                <div className="flex mt-1">
                  {getLeadScoreStars(stats.overview.avg_lead_score).map((filled, i) => (
                    <Star key={i} className={`h-3 w-3 ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                  ))}
                </div>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-semibold">Credits Used</p>
                <p className="text-2xl font-bold text-orange-900">{stats.overview.total_credits_consumed.toFixed(0)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Search and Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6"
      >
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Batch Filter */}
          <div className="min-w-48">
            <select
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
            >
              <option value="all">All Batches</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} ({batch.contact_count})
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-3 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </button>
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-gray-100"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      handleFilterChange();
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">All Status</option>
                    <option value="enriched">Enriched</option>
                    <option value="not_enriched">Not Enriched</option>
                    <option value="verified">Email Verified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Reliability</label>
                  <select
                    value={emailReliabilityFilter}
                    onChange={(e) => {
                      setEmailReliabilityFilter(e.target.value);
                      handleFilterChange();
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">All Reliability</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="no_email">No Email</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lead Score Range</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={leadScoreMin}
                      onChange={(e) => setLeadScoreMin(Number(e.target.value))}
                      className="w-16 px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={leadScoreMax}
                      onChange={(e) => setLeadScoreMax(Number(e.target.value))}
                      className="w-16 px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      onClick={handleFilterChange}
                      className="px-3 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Contacts Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedContacts.size === contacts.length && contacts.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Lead Score
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Email Reliability
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Company & Position
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
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