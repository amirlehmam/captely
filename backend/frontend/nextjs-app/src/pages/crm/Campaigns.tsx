import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Megaphone, Plus, Play, Pause, BarChart3, Mail,
  Calendar, Clock, Users, Target, Send, TrendingUp,
  Settings, MoreVertical, CheckCircle2, AlertCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../../services/api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  from_email?: string;
  from_name?: string;
  total_contacts: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

const CampaignsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'email',
    from_email: '',
    from_name: ''
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCampaigns();
      setCampaigns(Array.isArray(response) ? response : []);
    } catch (error) {
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (campaignId: string, newStatus: 'draft' | 'active' | 'paused' | 'completed') => {
    try {
      await apiService.updateCampaignStatus(campaignId, newStatus);
      toast.success(`Campaign ${newStatus}`);
      await fetchCampaigns();
    } catch (error) {
      toast.error('Failed to update campaign status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'completed': return 'info';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'linkedin': return <Users className="w-4 h-4" />;
      case 'cold_call': return <Clock className="w-4 h-4" />;
      default: return <Send className="w-4 h-4" />;
    }
  };

  const calculateMetrics = (campaign: Campaign) => {
    const openRate = campaign.sent_count > 0 
      ? ((campaign.open_count / campaign.sent_count) * 100).toFixed(1)
      : '0';
    const clickRate = campaign.open_count > 0
      ? ((campaign.click_count / campaign.open_count) * 100).toFixed(1)
      : '0';
    const replyRate = campaign.sent_count > 0
      ? ((campaign.reply_count / campaign.sent_count) * 100).toFixed(1)
      : '0';
    
    return { openRate, clickRate, replyRate };
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.name.trim()) {
        toast.error('Campaign name is required');
        return;
      }

      await apiService.createCampaign(formData);
      toast.success('Campaign created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', type: 'email', from_email: '', from_name: '' });
      await fetchCampaigns();
    } catch (error) {
      toast.error('Failed to create campaign');
    }
  };

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
              Campaigns
            </h1>
            <p className="text-gray-600 mt-2">
              Manage your outreach campaigns across multiple channels
            </p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </button>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Active Campaigns</p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {campaigns.filter(c => c.status === 'active').length}
              </p>
            </div>
            <Play className="w-12 h-12 text-green-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Sent</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {campaigns.reduce((sum, c) => sum + c.sent_count, 0).toLocaleString()}
              </p>
            </div>
            <Send className="w-12 h-12 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Avg Open Rate</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {campaigns.length > 0 
                  ? `${(campaigns.reduce((sum, c) => {
                      const rate = c.sent_count > 0 ? (c.open_count / c.sent_count) * 100 : 0;
                      return sum + rate;
                    }, 0) / campaigns.length).toFixed(1)}%`
                  : '0%'
                }
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide">Total Replies</p>
              <p className="text-3xl font-bold text-teal-900 mt-2">
                {campaigns.reduce((sum, c) => sum + c.reply_count, 0).toLocaleString()}
              </p>
            </div>
            <CheckCircle2 className="w-12 h-12 text-teal-500" />
          </div>
        </motion.div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign, index) => {
          const metrics = calculateMetrics(campaign);
          return (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300 h-full"
            >
              <div className="p-6 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                      {getTypeIcon(campaign.type)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {campaign.name}
                      </h3>
                      <div className="flex items-center space-x-3 mt-1">
                        <Badge variant={getStatusColor(campaign.status) as any}>
                          {campaign.status}
                        </Badge>
                        <span className="text-sm font-medium text-gray-600">
                          {campaign.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                {/* Campaign Stats */}
                <div className="space-y-4 mb-6 flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Contacts</span>
                      <span className="text-sm font-bold text-gray-900">
                        {campaign.sent_count}/{campaign.total_contacts}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-teal-500 to-teal-400 h-3 rounded-full transition-all duration-300 shadow-sm"
                        style={{ width: `${campaign.total_contacts > 0 ? (campaign.sent_count / campaign.total_contacts) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                      <p className="text-2xl font-bold text-green-900">
                        {metrics.openRate}%
                      </p>
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Open Rate</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-2xl font-bold text-blue-900">
                        {metrics.clickRate}%
                      </p>
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Click Rate</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
                      <p className="text-2xl font-bold text-purple-900">
                        {metrics.replyRate}%
                      </p>
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Reply Rate</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-sm font-medium text-gray-600">
                    Created {new Date(campaign.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-2">
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange(campaign.id, 'active')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                        title="Start Campaign"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {campaign.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(campaign.id, 'paused')}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all duration-200"
                        title="Pause Campaign"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                      title="View Analytics"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Create New Campaign Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: campaigns.length * 0.1 }}
          onClick={() => setShowCreateModal(true)}
          className="cursor-pointer bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300 hover:border-teal-500 hover:shadow-xl transition-all duration-300 h-full flex items-center justify-center min-h-[400px]"
        >
          <div className="text-center p-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-50 to-teal-100 rounded-full flex items-center justify-center mb-6 border border-teal-200">
              <Plus className="w-8 h-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Create New Campaign
            </h3>
            <p className="text-sm font-medium text-gray-600">
              Start a new outreach campaign across multiple channels
            </p>
          </div>
        </motion.div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create New Campaign</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', type: 'email', from_email: '', from_name: '' });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter campaign name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Campaign Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="email">Email</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="cold_call">Cold Call</option>
                  <option value="multi_channel">Multi-Channel</option>
                </select>
              </div>

              {formData.type === 'email' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      From Email
                    </label>
                    <input
                      type="email"
                      value={formData.from_email}
                      onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="sender@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={formData.from_name}
                      onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                </>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg font-medium transition-all duration-200"
                >
                  Create Campaign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', type: 'email', from_email: '', from_name: '' });
                  }}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CampaignsPage; 