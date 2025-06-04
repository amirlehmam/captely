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

const BatchDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  
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
      toast.success('Contact updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update contact');
    } finally {
      setUpdating(null);
    }
  };

  // Handle HubSpot export
  const exportToHubSpot = async (contactId: string) => {
    try {
      setExporting(contactId);
      await apiService.exportContactToHubSpot(contactId);
      toast.success('Contact exported to HubSpot!');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const exportBatchToHubSpot = async () => {
    if (!jobId) return;
    
    try {
      setExporting('batch');
      const result = await apiService.exportJobToHubSpot(jobId);
      toast.success(`Exported ${result.exported_count} contacts to HubSpot!`);
    } catch (err: any) {
      toast.error(err.message || 'Batch export failed');
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
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Verified</span>;
    } else if (contact.enriched) {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Enriched</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Pending</span>;
    }
  };

  if (jobLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading batch details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Batch not found</h3>
        <p className="mt-1 text-sm text-gray-500">The requested batch could not be found.</p>
        <div className="mt-6">
          <Link to="/batches" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batches
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/batches')}
            className="inline-flex items-center px-3 py-2 border border-gray-200 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batches
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {job.file_name || `Batch ${job.id.substring(0, 8)}`}
            </h1>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-sm text-gray-600">
                {job.total} contacts
              </span>
              <span className="text-sm text-gray-600">
                Created {new Date(job.created_at).toLocaleDateString()}
              </span>
              {getStatusBadge(job as any)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={exportBatchToHubSpot}
            disabled={exporting === 'batch'}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
          >
            {exporting === 'batch' ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Export to HubSpot
              </>
            )}
          </button>
        </div>
      </div>

      {/* Batch Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm font-semibold text-blue-700">Total Contacts</p>
              <p className="text-2xl font-bold text-blue-900">{job.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm font-semibold text-green-700">Emails Found</p>
              <p className="text-2xl font-bold text-green-900">{job.emails_found || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center">
            <Phone className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm font-semibold text-purple-700">Phones Found</p>
              <p className="text-2xl font-bold text-purple-900">{job.phones_found || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm font-semibold text-yellow-700">Success Rate</p>
              <p className="text-2xl font-bold text-yellow-900">{job.success_rate?.toFixed(1) || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          <div className="w-full lg:w-1/2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                placeholder="Search contacts by name, email, or company..."
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="enriched">Enriched</option>
              <option value="not_enriched">Not Enriched</option>
              <option value="verified">Verified</option>
            </select>

            <button
              onClick={() => fetchContacts(page)}
              className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {selectedContacts.size > 0 && (
              <button
                onClick={() => {/* Handle bulk actions */}}
                className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Actions ({selectedContacts.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white shadow-lg overflow-hidden rounded-xl border border-gray-100">
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Email & Phone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Company & Position
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Notes
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
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => handleSelectContact(contact.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingContact === contact.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editData.first_name || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, first_name: e.target.value }))}
                          className="block w-full border border-gray-200 rounded px-2 py-1 text-sm"
                          placeholder="First name"
                        />
                        <input
                          type="text"
                          value={editData.last_name || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, last_name: e.target.value }))}
                          className="block w-full border border-gray-200 rounded px-2 py-1 text-sm"
                          placeholder="Last name"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
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
                          <span className="text-gray-900">{contact.email}</span>
                          {contact.email_verified && <CheckCircle className="h-3 w-3 text-green-500 ml-1" />}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="h-3 w-3 text-blue-500 mr-2" />
                          <span className="text-gray-900">{contact.phone}</span>
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
                          className="block w-full border border-gray-200 rounded px-2 py-1 text-sm"
                          placeholder="Company"
                        />
                        <input
                          type="text"
                          value={editData.position || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, position: e.target.value }))}
                          className="block w-full border border-gray-200 rounded px-2 py-1 text-sm"
                          placeholder="Position"
                        />
                      </div>
                    ) : (
                      <div>
                        {contact.company && (
                          <div className="text-sm font-medium text-gray-900 flex items-center">
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
                          via {contact.enrichment_provider}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingContact === contact.id ? (
                      <textarea
                        value={editData.notes || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                        className="block w-full border border-gray-200 rounded px-2 py-1 text-sm"
                        rows={2}
                        placeholder="Add notes..."
                      />
                    ) : (
                      <div className="text-sm text-gray-600 max-w-xs">
                        {contact.notes || (
                          <span className="text-gray-400 italic">No notes</span>
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
                            className="p-2 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50"
                          >
                            {updating === contact.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 text-gray-600 hover:text-gray-700 rounded-lg hover:bg-gray-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(contact)}
                            className="p-2 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50"
                            title="Edit Contact"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          
                          {contact.email && (
                            <button
                              onClick={() => exportToHubSpot(contact.id)}
                              disabled={exporting === contact.id}
                              className="p-2 text-orange-600 hover:text-orange-700 rounded-lg hover:bg-orange-50"
                              title="Export to HubSpot"
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
                              className="p-2 text-gray-600 hover:text-gray-700 rounded-lg hover:bg-gray-50"
                              title="View LinkedIn Profile"
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
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="flex items-center">
              <p className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 border border-gray-200 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 border border-gray-200 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {filteredContacts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search terms or filters' 
              : 'This batch has no contacts'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default BatchDetailPage; 