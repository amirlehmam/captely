import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Plus, Calendar, Clock, User, Mail, Phone, MessageSquare,
  CheckCircle, XCircle, AlertCircle, Filter, Search, MoreVertical,
  Bell, Target, TrendingUp, Users, Star, Edit, Trash2, Eye, X,
  Save, UserCheck, Briefcase, CalendarDays
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../../services/api';

interface CrmActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'task' | 'note' | 'follow_up';
  title: string;
  description?: string;
  contact_id?: string;
  contact_name?: string;
  contact_email?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  completed_at?: string;
  created_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

interface CreateActivityForm {
  type: 'call' | 'email' | 'meeting' | 'task' | 'note' | 'follow_up';
  title: string;
  description: string;
  contact_id: string;
  status: 'pending' | 'completed' | 'cancelled' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  assigned_to: string;
}

const ActivitiesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<CrmActivity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CrmActivity | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state for creating/editing activities
  const [formData, setFormData] = useState<CreateActivityForm>({
    type: 'call',
    title: '',
    description: '',
    contact_id: '',
    status: 'pending',
    priority: 'medium',
    due_date: '',
    assigned_to: 'current_user'
  });

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    filterActivities();
  }, [activities, searchTerm, typeFilter, statusFilter, priorityFilter]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCrmActivities({
        limit: 100,
        skip: 0
      });
      setActivities(Array.isArray(response) ? response : []);
    } catch (error) {
      toast.error('Failed to fetch activities');
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterActivities = () => {
    let filtered = activities;

    if (searchTerm) {
      filtered = filtered.filter(activity => 
        activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(activity => activity.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(activity => activity.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(activity => activity.priority === priorityFilter);
    }

    setFilteredActivities(filtered);
    setCurrentPage(1);
  };

  const handleCreateActivity = async () => {
    try {
      await apiService.createCrmActivity({
        ...formData,
        created_by: 'current_user'
      });
      toast.success('Activity created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchActivities();
    } catch (error) {
      toast.error('Failed to create activity');
      console.error('Error creating activity:', error);
    }
  };

  const handleUpdateActivity = async () => {
    if (!selectedActivity) return;
    
    try {
      await apiService.updateActivityStatus(selectedActivity.id, formData.status);
      toast.success('Activity updated successfully');
      setShowEditModal(false);
      setSelectedActivity(null);
      resetForm();
      fetchActivities();
    } catch (error) {
      toast.error('Failed to update activity');
      console.error('Error updating activity:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'call',
      title: '',
      description: '',
      contact_id: '',
      status: 'pending',
      priority: 'medium',
      due_date: '',
      assigned_to: 'current_user'
    });
  };

  const openEditModal = (activity: CrmActivity) => {
    setSelectedActivity(activity);
    setFormData({
      type: activity.type,
      title: activity.title,
      description: activity.description || '',
      contact_id: activity.contact_id || '',
      status: activity.status,
      priority: activity.priority,
      due_date: activity.due_date || '',
      assigned_to: activity.assigned_to || ''
    });
    setShowEditModal(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Users className="w-4 h-4" />;
      case 'task': return <CheckCircle className="w-4 h-4" />;
      case 'note': return <MessageSquare className="w-4 h-4" />;
      case 'follow_up': return <Bell className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100 border-green-200';
      case 'pending': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'cancelled': return 'text-gray-600 bg-gray-100 border-gray-200';
      case 'overdue': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-700 bg-red-100 border-red-300';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-300';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      case 'low': return 'text-green-700 bg-green-100 border-green-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);

  const stats = {
    total: activities.length,
    pending: activities.filter(a => a.status === 'pending').length,
    overdue: activities.filter(a => a.status === 'overdue').length,
    completed: activities.filter(a => a.status === 'completed').length
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto bg-white min-h-screen">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading activities...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              CRM Activities
            </h1>
            <p className="text-gray-600 mt-2">
              Track tasks, follow-ups, and interactions with your contacts
            </p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Activity
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Activities</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {stats.total}
              </p>
            </div>
            <Activity className="w-12 h-12 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Pending</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">
                {stats.pending}
              </p>
            </div>
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700 uppercase tracking-wide">Overdue</p>
              <p className="text-3xl font-bold text-red-900 mt-2">
                {stats.overdue}
              </p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Completed</p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {stats.completed}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </motion.div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              >
                <option value="all">All Types</option>
                <option value="call">Calls</option>
                <option value="email">Emails</option>
                <option value="meeting">Meetings</option>
                <option value="task">Tasks</option>
                <option value="note">Notes</option>
                <option value="follow_up">Follow-ups</option>
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              >
                <option value="all">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedActivities.map((activity) => (
                <motion.tr
                  key={activity.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${
                        activity.type === 'call' ? 'bg-blue-100 text-blue-600' :
                        activity.type === 'email' ? 'bg-green-100 text-green-600' :
                        activity.type === 'meeting' ? 'bg-purple-100 text-purple-600' :
                        activity.type === 'task' ? 'bg-orange-100 text-orange-600' :
                        activity.type === 'note' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {getTypeIcon(activity.type)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {activity.title}
                        </h4>
                        {activity.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.description.length > 60 
                              ? `${activity.description.substring(0, 60)}...`
                              : activity.description
                            }
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1 capitalize">
                          {activity.type}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {activity.contact_name ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.contact_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {activity.contact_email}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No contact</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(activity.priority)}`}>
                      {activity.priority}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {activity.due_date ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(activity.due_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No due date</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-teal-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {activity.assigned_to || 'Unassigned'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => openEditModal(activity)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(activity)}
                        className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all duration-200"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredActivities.length)} of {filteredActivities.length} activities
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
              >
                Previous
              </button>
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
      </div>

      {/* Create Activity Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Create New Activity</h3>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Activity Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                    >
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="task">Task</option>
                      <option value="note">Note</option>
                      <option value="follow_up">Follow-up</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter activity title..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter activity description..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateActivity}
                    className="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
                  >
                    <Save className="w-4 h-4 mr-2 inline" />
                    Create Activity
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Activity Modal */}
      <AnimatePresence>
        {showEditModal && selectedActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Edit Activity</h3>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedActivity(null);
                      resetForm();
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{selectedActivity.title}</h4>
                  <p className="text-sm text-gray-600 mb-3">{selectedActivity.description}</p>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedActivity.status)}`}>
                      {selectedActivity.status}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(selectedActivity.priority)}`}>
                      {selectedActivity.priority}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Update Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedActivity(null);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateActivity}
                    className="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
                  >
                    <Save className="w-4 h-4 mr-2 inline" />
                    Update Activity
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActivitiesPage; 