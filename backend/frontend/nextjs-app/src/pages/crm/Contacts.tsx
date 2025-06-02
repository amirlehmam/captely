import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Plus, Search, Filter, Download, Upload,
  Mail, Phone, Building2, MapPin, Tag, MoreVertical,
  Star, Calendar, TrendingUp, ExternalLink, Check,
  Edit, Trash2, Eye, UserPlus, MessageCircle, 
  LinkedinIcon, Globe, Clock, Target, AlertCircle,
  RefreshCw, FileDown, Settings, X, Save, ChevronDown,
  ChevronUp, Zap, BarChart3, Activity, ArrowUpDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// Updated hooks for production
import { useCrmContacts, useExport } from '../../hooks/useApi';
import { Contact } from '../../services/api';

// Enhanced Contact interface for CRM
interface CrmContact extends Contact {
  status: 'new' | 'contacted' | 'qualified' | 'customer' | 'lost';
  lead_score: number;
  tags: string[];
  last_contacted_at?: string;
  notes?: string;
  source?: string;
}

const ContactsPage: React.FC = () => {
  // Hooks
  const [searchParams, setSearchParams] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: 'all'
  });
  
  const { contacts: contactsData, loading, error, refetch } = useCrmContacts(searchParams);
  const { exportData } = useExport();
  
  // Transform contacts to CRM format
  const contacts: CrmContact[] = contactsData.map(contact => ({
    ...contact,
    status: getContactStatus(contact),
    lead_score: calculateLeadScore(contact),
    tags: generateContactTags(contact),
    source: 'enrichment'
  }));

  // Local state
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContactDetail, setShowContactDetail] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortBy, setSortBy] = useState<keyof CrmContact>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Advanced filters
  const [filters, setFilters] = useState({
    status: 'all',
    leadScore: 'all',
    hasEmail: 'all',
    hasPhone: 'all',
    source: 'all',
    tags: [] as string[]
  });

  // Helper functions
  function getContactStatus(contact: Contact): 'new' | 'contacted' | 'qualified' | 'customer' | 'lost' {
    if (contact.enriched && contact.email && contact.email_verified) {
      return 'qualified';
    } else if (contact.enriched && contact.email) {
      return 'contacted';
    } else if (contact.enriched) {
      return 'new';
    }
    return 'new';
  }

  function calculateLeadScore(contact: Contact): number {
    let score = 0;
    if (contact.email) score += 30;
    if (contact.phone) score += 25;
    if (contact.email_verified) score += 20;
    if (contact.phone_verified) score += 15;
    if (contact.enrichment_score) score += contact.enrichment_score * 0.1;
    return Math.min(100, score);
  }

  function generateContactTags(contact: Contact): string[] {
    const tags: string[] = [];
    if (contact.email) tags.push('email');
    if (contact.phone) tags.push('phone');
    if (contact.email_verified) tags.push('verified');
    if (contact.enrichment_provider) tags.push(contact.enrichment_provider);
    if (contact.industry) tags.push(contact.industry.toLowerCase());
    return tags;
  }

  // Event handlers
  const handleSearch = useCallback((term: string) => {
    setSearchParams(prev => ({ ...prev, search: term, page: 1 }));
  }, []);

  const handleStatusFilter = useCallback((status: string) => {
    setSearchParams(prev => ({ ...prev, status, page: 1 }));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    toast.success('Contacts refreshed');
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

  const handleBulkExport = async () => {
    if (selectedContacts.size === 0) {
      toast.error('Please select contacts to export');
      return;
    }
    
    // For demo purposes, we'll export all contacts
    toast.success(`Exporting ${selectedContacts.size} contacts...`);
    setSelectedContacts(new Set());
  };

  const handleSort = (field: keyof CrmContact) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Sort contacts
  const sortedContacts = [...contacts].sort((a, b) => {
    let aValue: any = a[sortBy];
    let bValue: any = b[sortBy];
    
    // Handle undefined values
    if (aValue === undefined || aValue === null) aValue = '';
    if (bValue === undefined || bValue === null) bValue = '';
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue as string).getTime() || 0;
      bValue = new Date(bValue as string).getTime() || 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Apply advanced filters
  const filteredContacts = sortedContacts.filter(contact => {
    if (filters.status !== 'all' && contact.status !== filters.status) return false;
    if (filters.hasEmail !== 'all') {
      const hasEmail = !!contact.email;
      if (filters.hasEmail === 'yes' && !hasEmail) return false;
      if (filters.hasEmail === 'no' && hasEmail) return false;
    }
    if (filters.hasPhone !== 'all') {
      const hasPhone = !!contact.phone;
      if (filters.hasPhone === 'yes' && !hasPhone) return false;
      if (filters.hasPhone === 'no' && hasPhone) return false;
    }
    if (filters.leadScore !== 'all') {
      if (filters.leadScore === 'high' && contact.lead_score < 80) return false;
      if (filters.leadScore === 'medium' && (contact.lead_score < 50 || contact.lead_score >= 80)) return false;
      if (filters.leadScore === 'low' && contact.lead_score >= 50) return false;
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'info';
      case 'contacted': return 'warning';
      case 'qualified': return 'success';
      case 'customer': return 'success';
      case 'lost': return 'danger';
      default: return 'default';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'contacted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'qualified': return 'bg-green-100 text-green-800 border-green-200';
      case 'customer': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'lost': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLeadScoreStars = (score: number) => {
    const maxStars = 5;
    const filledStars = Math.ceil((score / 100) * maxStars);
    return Array.from({ length: maxStars }, (_, i) => i < filledStars);
  };

  // Stats calculations
  const stats = {
    total: contacts.length,
    qualified: contacts.filter(c => c.status === 'qualified').length,
    customers: contacts.filter(c => c.status === 'customer').length,
    withEmail: contacts.filter(c => c.email).length,
    withPhone: contacts.filter(c => c.phone).length,
    avgLeadScore: contacts.length > 0 ? contacts.reduce((sum, c) => sum + c.lead_score, 0) / contacts.length : 0
  };

  if (loading && !contacts.length) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen space-y-6">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            CRM Contacts
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your leads and customers in one place
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </button>
          
          <Link
            to="/import"
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Link>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </button>
        </div>
      </motion.div>

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
                  <h4 className="text-sm font-semibold text-red-800">Failed to load contacts</h4>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{stats.total}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
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
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Qualified</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{stats.qualified}</p>
            </div>
            <Target className="w-10 h-10 text-green-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Customers</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.customers}</p>
            </div>
            <Check className="w-10 h-10 text-emerald-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Emails</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">{stats.withEmail}</p>
            </div>
            <Mail className="w-10 h-10 text-purple-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Phones</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">{stats.withPhone}</p>
            </div>
            <Phone className="w-10 h-10 text-orange-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Avg Score</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.avgLeadScore.toFixed(0)}</p>
            </div>
            <BarChart3 className="w-10 h-10 text-yellow-500" />
          </div>
        </motion.div>
      </div>

      {/* Advanced Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="customer">Customer</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lead Score</label>
                <select
                  value={filters.leadScore}
                  onChange={(e) => setFilters({...filters, leadScore: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Scores</option>
                  <option value="high">High (80+)</option>
                  <option value="medium">Medium (50-79)</option>
                  <option value="low">Low (&lt;50)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Has Email</label>
                <select
                  value={filters.hasEmail}
                  onChange={(e) => setFilters({...filters, hasEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Has Phone</label>
                <select
                  value={filters.hasPhone}
                  onChange={(e) => setFilters({...filters, hasPhone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({
                    status: 'all',
                    leadScore: 'all',
                    hasEmail: 'all',
                    hasPhone: 'all',
                    source: 'all',
                    tags: []
                  })}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Bulk Actions */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchParams.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={searchParams.status}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="customer">Customer</option>
              <option value="lost">Lost</option>
            </select>
            
            {selectedContacts.size > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleBulkExport}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Export ({selectedContacts.size})
                </button>
                <button
                  onClick={() => setSelectedContacts(new Set())}
                  className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('first_name')}
                >
                  <div className="flex items-center">
                    Contact
                    <ArrowUpDown className="h-3 w-3 ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('company')}
                >
                  <div className="flex items-center">
                    Company
                    <ArrowUpDown className="h-3 w-3 ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <ArrowUpDown className="h-3 w-3 ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('lead_score')}
                >
                  <div className="flex items-center">
                    Lead Score
                    <ArrowUpDown className="h-3 w-3 ml-1" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contact Info
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Source
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredContacts.map((contact) => (
                <motion.tr
                  key={contact.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200"
                >
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => handleSelectContact(contact.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                          {contact.first_name?.charAt(0) || '?'}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {contact.first_name} {contact.last_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {contact.position || 'No position'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        <Building2 className="h-4 w-4 mr-1 text-gray-400" />
                        {contact.company || '-'}
                      </div>
                      {contact.location && (
                        <div className="text-sm text-gray-600 flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                          {contact.location}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(contact.status)}`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center">
                      <div className="flex">
                        {getLeadScoreStars(contact.lead_score).map((filled, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {contact.lead_score}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center text-sm">
                          <Mail className="h-3 w-3 mr-2 text-green-500" />
                          <span className="text-gray-900">{contact.email}</span>
                          {contact.email_verified && (
                            <Check className="h-3 w-3 ml-1 text-green-500" />
                          )}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="h-3 w-3 mr-2 text-blue-500" />
                          <span className="text-gray-900">{contact.phone}</span>
                          {contact.phone_verified && (
                            <Check className="h-3 w-3 ml-1 text-green-500" />
                          )}
                        </div>
                      )}
                      {contact.profile_url && (
                        <div className="flex items-center text-sm">
                          <ExternalLink className="h-3 w-3 mr-2 text-blue-500" />
                          <a 
                            href={contact.profile_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            LinkedIn
                          </a>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center">
                        <Activity className="h-3 w-3 mr-1 text-gray-400" />
                        {contact.enrichment_provider || 'Manual'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '-'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setShowContactDetail(contact.id)}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      <button
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                        title="Edit Contact"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      <button
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
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

        {/* Pagination placeholder */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              Showing {filteredContacts.length} contacts
            </div>
            <div className="text-sm text-gray-500">
              Page 1 of 1
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredContacts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchParams.search || searchParams.status !== 'all'
              ? 'Try adjusting your search criteria'
              : 'Start by importing contacts or add them manually'
            }
          </p>
          {!searchParams.search && searchParams.status === 'all' && (
            <div className="mt-6">
              <Link
                to="/import"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Contacts
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Contact Detail Modal (placeholder) */}
      <AnimatePresence>
        {showContactDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowContactDetail(null)}
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
                  <h3 className="text-lg font-semibold text-gray-900">Contact Details</h3>
                  <button
                    onClick={() => setShowContactDetail(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Detailed contact information would be displayed here, including:
                    </p>
                    <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                      <li>Complete contact information</li>
                      <li>Interaction history</li>
                      <li>Lead scoring details</li>
                      <li>Notes and activities</li>
                      <li>Enrichment data</li>
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

export default ContactsPage; 