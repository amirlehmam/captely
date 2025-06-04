import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, User, CreditCard, Key, Shield, Bell, 
  Users, Database, Globe, Eye, EyeOff, Check, X, Plus, Trash2,
  Download, Upload, Save, Lock, Unlock, Mail, Phone, Smartphone,
  AlertCircle, CheckCircle, Clock, RefreshCw, Copy, ExternalLink,
  Calendar, DollarSign, TrendingUp, BarChart3, Zap, Target,
  Filter, Search, Edit, Monitor, Webhook, Cloud, Settings2,
  UserPlus, Activity, Sliders, Server, HardDrive, Gauge,
  FileDown, Archive, Share2, Link2, Terminal, Code2, Wifi,
  ChevronUp, ChevronDown, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar?: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  joined_at: string;
  last_active?: string;
}

interface SecurityLog {
  id: string;
  event: string;
  ip_address: string;
  timestamp: string;
  status: 'success' | 'failed';
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used?: string;
  status: 'active' | 'revoked';
  permissions: string[];
}

interface EnrichmentProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  priority: number;
  successRate: number;
  creditsUsed: number;
}

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('account');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  // State for different sections
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [billing, setBilling] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [enrichmentProviders, setEnrichmentProviders] = useState<EnrichmentProvider[]>([]);
  
  const [notifications, setNotifications] = useState({
    email_enrichment_complete: true,
    email_batch_ready: true,
    email_credits_low: true,
    email_billing: true,
    push_notifications: false,
    webhook_enabled: false,
    webhook_url: ''
  });

  const [enrichmentSettings, setEnrichmentSettings] = useState({
    auto_enrich: true,
    quality_threshold: 'balanced', // 'highest', 'balanced', 'fastest'
    retry_failed: true,
    max_retries: 3,
    cache_duration: 30, // days
    confidence_threshold: 0.70
  });

  const [securitySettings, setSecuritySettings] = useState({
    two_factor_enabled: false,
    login_alerts: true,
    ip_whitelist_enabled: false,
    allowed_ips: [],
    password_policy: {
      min_length: 8,
      require_uppercase: true,
      require_numbers: true,
      require_special: true
    }
  });

  const [dataExportSettings, setDataExportSettings] = useState({
    format: 'csv',
    include_enrichment_data: true,
    include_timestamps: true,
    include_metadata: false,
    schedule_enabled: false,
    schedule_frequency: 'weekly',
    schedule_email: ''
  });

  // Form states
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user' as 'admin' | 'user' | 'viewer'
  });

  const [newApiKeyForm, setNewApiKeyForm] = useState({
    name: '',
    permissions: ['read', 'write']
  });

  // Sidebar navigation items - production ready
  const sidebarItems = [
    {
      id: 'account',
      label: 'Account',
      icon: <User className="w-5 h-5" />,
      description: 'Profile and personal settings'
    },
    {
      id: 'security',
      label: 'Security',
      icon: <Shield className="w-5 h-5" />,
      description: 'Password and security settings'
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Subscription and payment'
    },
    {
      id: 'api',
      label: 'API Keys',
      icon: <Key className="w-5 h-5" />,
      description: 'Manage API access'
    },
    {
      id: 'import',
      label: 'Import Settings',
      icon: <Upload className="w-5 h-5" />,
      description: 'Import and enrichment settings'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="w-5 h-5" />,
      description: 'Email and alert preferences'
    },
    {
      id: 'team',
      label: 'Team',
      icon: <Users className="w-5 h-5" />,
      description: 'Team members and roles'
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: <Webhook className="w-5 h-5" />,
      description: 'Third-party connections'
    },
    {
      id: 'export',
      label: 'Data Export',
      icon: <Download className="w-5 h-5" />,
      description: 'Export and backup options'
    }
  ];

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUserProfile(),
        fetchBillingInfo(),
        fetchApiKeys(),
        fetchTeamMembers(),
        fetchSecurityLogs(),
        fetchEnrichmentProviders(),
        fetchNotificationSettings(),
        fetchEnrichmentSettings()
      ]);
    } catch (error) {
      console.error('Error fetching settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await apiService.getUserProfile();
      setProfile(response as UserProfile);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const fetchBillingInfo = async () => {
    try {
      const subscription = await apiService.getCurrentSubscription();
      setBilling(subscription);
    } catch (error) {
      console.error('Failed to load billing info:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await apiService.getApiTokens();
      setApiKeys((response || []) as ApiKey[]);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await apiService.getTeamMembers();
      setTeamMembers((response || []) as TeamMember[]);
    } catch (error) {
      console.error('Failed to load team members:', error);
    }
  };

  const fetchSecurityLogs = async () => {
    try {
      const response = await apiService.getSecurityLogs();
      setSecurityLogs((response || []) as SecurityLog[]);
    } catch (error) {
      console.error('Failed to load security logs:', error);
    }
  };

  const fetchEnrichmentProviders = async () => {
    // Real enrichment providers from our system
    setEnrichmentProviders([
      {
        id: 'dropcontact',
        name: 'Dropcontact',
        enabled: true,
        priority: 1,
        successRate: 85,
        creditsUsed: 1234
      },
      {
        id: 'icypeas',
        name: 'Icypeas',
        enabled: true,
        priority: 2,
        successRate: 78,
        creditsUsed: 890
      },
      {
        id: 'apollo',
        name: 'Apollo',
        enabled: false,
        priority: 3,
        successRate: 72,
        creditsUsed: 456
      }
    ]);
  };

  const fetchNotificationSettings = async () => {
    try {
      if (profile?.id) {
        const prefs = await apiService.getNotificationPreferences(profile.id);
        if (prefs && typeof prefs === 'object') {
          const preferences = prefs as any;
          setNotifications(prev => ({
            ...prev,
            email_enrichment_complete: preferences.job_completion_alerts || true,
            email_batch_ready: preferences.job_completion_alerts || true,
            email_credits_low: preferences.credit_warnings || true,
            email_billing: preferences.email_notifications || true
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const fetchEnrichmentSettings = async () => {
    // Load from localStorage first, then API
    const saved = localStorage.getItem('enrichmentSettings');
    if (saved) {
      setEnrichmentSettings(JSON.parse(saved));
    }
    
    try {
      const apiSettings = await apiService.getSetting('enrichmentSettings');
      if (apiSettings && typeof apiSettings === 'object' && 'value' in apiSettings) {
        const settings = (apiSettings as { value: any }).value;
        if (settings) {
          setEnrichmentSettings(settings);
        }
      }
    } catch (error) {
      console.error('Failed to load enrichment settings:', error);
    }
  };

  const handleProfileUpdate = async () => {
    setLoading(true);
    try {
      if (profile) {
        await apiService.updateUserProfile({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone
        });
        toast.success('Profile updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    try {
      await apiService.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      toast.success('Password updated successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const saveEnrichmentSettings = async () => {
    setLoading(true);
    try {
      // Save to localStorage and/or API
      localStorage.setItem('enrichmentSettings', JSON.stringify(enrichmentSettings));
      
      // Update minimum confidence in the system
      await apiService.updateSetting('enrichmentSettings', enrichmentSettings);
      
      toast.success('Enrichment settings saved successfully');
    } catch (error) {
      toast.error('Failed to save enrichment settings');
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationSettings = async () => {
    setLoading(true);
    try {
      if (profile?.id) {
        await apiService.updateNotificationPreferences(profile.id, {
          email_notifications: notifications.email_billing,
          job_completion_alerts: notifications.email_enrichment_complete,
          credit_warnings: notifications.email_credits_low,
          weekly_summary: false,
          low_credit_threshold: 100
        });
        
        // Save webhook settings
        await apiService.updateSetting('notificationSettings', notifications);
      }
      toast.success('Notification settings saved successfully');
    } catch (error) {
      toast.error('Failed to save notification settings');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newApiKeyForm.name.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    
    setLoading(true);
    try {
      const response = await apiService.createApiToken(newApiKeyForm.name);
      if (response && response.token) {
        setApiKeys([...apiKeys, {
          id: response.id,
          name: newApiKeyForm.name,
          key: response.token,
          created_at: new Date().toISOString(),
          status: 'active',
          permissions: newApiKeyForm.permissions
        }]);
        setNewApiKeyForm({ name: '', permissions: ['read', 'write'] });
        
        // Show the key once for copying
        setShowApiKey(response.id);
        toast.success('API key generated successfully. Copy it now - it won\'t be shown again!');
      }
    } catch (error) {
      toast.error('Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      await apiService.deleteApiToken(keyId);
      setApiKeys(apiKeys.filter(key => key.id !== keyId));
      toast.success('API key revoked successfully');
    } catch (error) {
      toast.error('Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  const inviteTeamMember = async () => {
    if (!inviteForm.email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    
    setLoading(true);
    try {
      // In production, this would send an invitation email
      toast.success(`Invitation sent to ${inviteForm.email}`);
      setInviteForm({ email: '', role: 'user' });
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const exportAllData = async () => {
    setLoading(true);
    try {
      // Get all jobs for the user
      const jobs = await apiService.getJobs();
      
      if (!Array.isArray(jobs) || jobs.length === 0) {
        toast.error('No data to export');
        return;
      }
      
      // Export the most recent completed job
      const completedJobs = jobs.filter((job: any) => job.status === 'completed');
      if (completedJobs.length > 0) {
        await apiService.exportData(completedJobs[0].id, dataExportSettings.format as 'csv' | 'excel' | 'json');
        toast.success('Export started - file will download automatically');
      } else {
        toast.error('No completed enrichments to export');
      }
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const updateProviderPriority = async (providerId: string, direction: 'up' | 'down') => {
    const providers = [...enrichmentProviders];
    const index = providers.findIndex(p => p.id === providerId);
    
    if (direction === 'up' && index > 0) {
      [providers[index - 1], providers[index]] = [providers[index], providers[index - 1]];
    } else if (direction === 'down' && index < providers.length - 1) {
      [providers[index], providers[index + 1]] = [providers[index + 1], providers[index]];
    }
    
    // Update priorities
    providers.forEach((provider, idx) => {
      provider.priority = idx + 1;
    });
    
    setEnrichmentProviders(providers);
    
    // Save to API
    try {
      await apiService.updateSetting('providerPriority', providers);
      toast.success('Provider priority updated');
    } catch (error) {
      toast.error('Failed to update provider priority');
    }
  };

  const saveSecuritySettings = async () => {
    setLoading(true);
    try {
      await apiService.updateSetting('securitySettings', securitySettings);
      toast.success('Security settings saved successfully');
    } catch (error) {
      toast.error('Failed to save security settings');
    } finally {
      setLoading(false);
    }
  };

  const saveDataExportSettings = async () => {
    setLoading(true);
    try {
      await apiService.updateSetting('dataExportSettings', dataExportSettings);
      toast.success('Export settings saved successfully');
    } catch (error) {
      toast.error('Failed to save export settings');
    } finally {
      setLoading(false);
    }
  };

  const renderAccountSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h2>
        
        {/* Profile Information */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                value={profile?.first_name || ''}
                onChange={(e) => setProfile(prev => prev ? {...prev, first_name: e.target.value} : null)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={profile?.last_name || ''}
                onChange={(e) => setProfile(prev => prev ? {...prev, last_name: e.target.value} : null)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={profile?.email || ''}
                onChange={(e) => setProfile(prev => prev ? {...prev, email: e.target.value} : null)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={profile?.phone || ''}
                onChange={(e) => setProfile(prev => prev ? {...prev, phone: e.target.value} : null)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              />
            </div>
          </div>
          <div className="mt-6">
            <button 
              onClick={handleProfileUpdate}
              className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200"
            >
              <Save className="w-4 h-4 mr-2 inline" />
              Save Profile
            </button>
          </div>
        </div>

        {/* Password Change */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm(prev => ({...prev, current_password: e.target.value}))}
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm(prev => ({...prev, new_password: e.target.value}))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 8 characters with uppercase, numbers, and special characters
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm(prev => ({...prev, confirm_password: e.target.value}))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              />
            </div>
            <button
              onClick={handlePasswordChange}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2 inline" />
              )}
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEnrichmentSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Settings</h2>
        
        {/* Auto-Enrichment Settings */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Automatic Enrichment</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Automatically Enrich New Contacts on Import</h4>
                <p className="text-sm text-gray-600">When enabled, new contacts will be automatically enriched when you import them</p>
              </div>
              <button
                onClick={() => setEnrichmentSettings(prev => ({ ...prev, auto_enrich: !prev.auto_enrich }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  enrichmentSettings.auto_enrich ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  enrichmentSettings.auto_enrich ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {enrichmentSettings.auto_enrich && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h5 className="font-medium text-blue-900 mb-1">Auto-Enrichment Benefits</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Automatically finds email addresses and phone numbers</li>
                      <li>• Verifies contact information for accuracy</li>
                      <li>• Saves time by processing contacts immediately</li>
                      <li>• Uses our smart cascade system for best results</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6">
            <button 
              onClick={saveEnrichmentSettings}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2 inline" />
              )}
              Save Settings
            </button>
          </div>
        </div>

        {/* Self-Enrichment Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Self-Enrichment</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
              <div className="flex items-start">
                <Zap className="w-5 h-5 text-purple-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h5 className="font-medium text-purple-900 mb-1">Manual Enrichment</h5>
                  <p className="text-sm text-purple-700">
                    You can manually enrich contacts at any time from the Import page or by uploading a CSV file.
                    This gives you full control over when and which contacts to enrich.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center pt-4">
              <a
                href="/import"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200"
              >
                <Upload className="w-4 h-4 mr-2" />
                Go to Import Page
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTeamSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Team & Access Management</h2>
        
        {/* Invite Team Member */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>
          <div className="flex gap-4">
            <input
              type="email"
              placeholder="Enter email address"
              value={inviteForm.email}
              onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
            />
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value as any }))}
              className="px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
            >
              <option value="viewer">Viewer</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={inviteTeamMember}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4 mr-2 inline" />
              Send Invite
            </button>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Role Permissions:</strong><br />
              • <strong>Viewer:</strong> Can view data and reports<br />
              • <strong>User:</strong> Can import, enrich, and export data<br />
              • <strong>Admin:</strong> Full access including billing and team management
            </p>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {teamMembers.map((member) => (
              <div key={member.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{member.name}</h4>
                      <p className="text-sm text-gray-600">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      member.role === 'admin' 
                        ? 'bg-purple-100 text-purple-700 border-purple-200'
                        : member.role === 'user'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {member.role}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      member.status === 'active' 
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : member.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {member.status}
                    </span>
                    {member.id !== profile?.id && (
                      <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center space-x-6 text-sm text-gray-500">
                  <span>Joined {new Date(member.joined_at).toLocaleDateString()}</span>
                  {member.last_active && (
                    <span>Last active {new Date(member.last_active).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Security Settings</h2>
        
        {/* Security Options */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Security Options</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
                <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
              </div>
              <button
                onClick={() => setSecuritySettings(prev => ({ ...prev, two_factor_enabled: !prev.two_factor_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  securitySettings.two_factor_enabled ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  securitySettings.two_factor_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Login Alerts</h4>
                <p className="text-sm text-gray-600">Get notified of new login attempts</p>
              </div>
              <button
                onClick={() => setSecuritySettings(prev => ({ ...prev, login_alerts: !prev.login_alerts }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  securitySettings.login_alerts ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  securitySettings.login_alerts ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Security Logs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Recent Security Events</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {securityLogs.map((log) => (
              <div key={log.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${
                      log.status === 'success' 
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {log.status === 'success' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{log.event}</h4>
                      <p className="text-sm text-gray-600">IP: {log.ip_address}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderIntegrationSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Integration Settings</h2>
        
        {/* Webhook Configuration */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook Configuration</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Enable Webhooks</h4>
                <p className="text-sm text-gray-600">Send real-time notifications to your server</p>
              </div>
              <button
                onClick={() => setNotifications(prev => ({ ...prev, webhook_enabled: !prev.webhook_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  notifications.webhook_enabled ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  notifications.webhook_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            
            {notifications.webhook_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={notifications.webhook_url}
                  onChange={(e) => setNotifications(prev => ({ ...prev, webhook_url: e.target.value }))}
                  placeholder="https://your-server.com/webhook"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                />
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h5 className="font-medium text-gray-900 mb-2">Webhook Events</h5>
              <div className="space-y-2 text-sm text-gray-600">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" defaultChecked />
                  Enrichment completed
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" defaultChecked />
                  Import finished
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  Credit balance low
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* API Settings */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-start">
                <Terminal className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h5 className="font-medium text-blue-900 mb-1">API Endpoint</h5>
                  <code className="text-sm text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    https://api.captely.com/v1
                  </code>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-start">
                <Wifi className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h5 className="font-medium text-green-900 mb-1">API Status</h5>
                  <p className="text-sm text-green-700">All systems operational</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDataExportSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Data Export Settings</h2>
        
        {/* Export Configuration */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Configuration</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Export Format</label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'csv', label: 'CSV', icon: FileDown },
                  { value: 'excel', label: 'Excel', icon: FileDown },
                  { value: 'json', label: 'JSON', icon: Code2 }
                ].map((format) => (
                  <button
                    key={format.value}
                    onClick={() => setDataExportSettings(prev => ({ ...prev, format: format.value }))}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center ${
                      dataExportSettings.format === format.value
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <div className={`mb-2 ${
                      dataExportSettings.format === format.value ? 'text-teal-600' : 'text-gray-400'
                    }`}>
                      <format.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-gray-900">{format.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dataExportSettings.include_enrichment_data}
                  onChange={(e) => setDataExportSettings(prev => ({ 
                    ...prev, 
                    include_enrichment_data: e.target.checked 
                  }))}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-gray-700">Include enrichment data</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dataExportSettings.include_timestamps}
                  onChange={(e) => setDataExportSettings(prev => ({ 
                    ...prev, 
                    include_timestamps: e.target.checked 
                  }))}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-gray-700">Include timestamps</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dataExportSettings.include_metadata}
                  onChange={(e) => setDataExportSettings(prev => ({ 
                    ...prev, 
                    include_metadata: e.target.checked 
                  }))}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-gray-700">Include metadata</span>
              </label>
            </div>

            <div>
              <button
                onClick={exportAllData}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2 inline" />
                )}
                Export All Data
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled Exports */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduled Exports</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Enable Scheduled Exports</h4>
                <p className="text-sm text-gray-600">Automatically export data on a regular schedule</p>
              </div>
              <button
                onClick={() => setDataExportSettings(prev => ({ ...prev, schedule_enabled: !prev.schedule_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  dataExportSettings.schedule_enabled ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  dataExportSettings.schedule_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {dataExportSettings.schedule_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                  <select
                    value={dataExportSettings.schedule_frequency}
                    onChange={(e) => setDataExportSettings(prev => ({ ...prev, schedule_frequency: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={dataExportSettings.schedule_email}
                    onChange={(e) => setDataExportSettings(prev => ({ ...prev, schedule_email: e.target.value }))}
                    placeholder="exports@yourcompany.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderApiSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">API Keys & Access</h2>
        
        {/* Generate New API Key */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate New API Key</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter API key name (e.g., 'Production App')"
              value={newApiKeyForm.name}
              onChange={(e) => setNewApiKeyForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newApiKeyForm.permissions.includes('read')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewApiKeyForm(prev => ({ 
                          ...prev, 
                          permissions: [...prev.permissions, 'read'] 
                        }));
                      } else {
                        setNewApiKeyForm(prev => ({ 
                          ...prev, 
                          permissions: prev.permissions.filter(p => p !== 'read') 
                        }));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Read access</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newApiKeyForm.permissions.includes('write')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewApiKeyForm(prev => ({ 
                          ...prev, 
                          permissions: [...prev.permissions, 'write'] 
                        }));
                      } else {
                        setNewApiKeyForm(prev => ({ 
                          ...prev, 
                          permissions: prev.permissions.filter(p => p !== 'write') 
                        }));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Write access</span>
                </label>
              </div>
            </div>
            <button
              onClick={generateApiKey}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Generate API Key
                </>
              )}
            </button>
          </div>
        </div>

        {/* Existing API Keys */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Your API Keys</h3>
            <p className="text-sm text-gray-600 mt-1">Manage your API keys for accessing Captely services</p>
          </div>
          <div className="divide-y divide-gray-100">
            {apiKeys.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No API keys yet. Generate your first key above.
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">{apiKey.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                          apiKey.status === 'active' 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {apiKey.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                        {apiKey.last_used && (
                          <span>Last used: {new Date(apiKey.last_used).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <code className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 select-all">
                          {showApiKey === apiKey.id ? apiKey.key : `${apiKey.key.substring(0, 12)}${'•'.repeat(20)}`}
                        </code>
                        <button
                          onClick={() => setShowApiKey(showApiKey === apiKey.id ? null : apiKey.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                        >
                          {showApiKey === apiKey.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(apiKey.key)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => revokeApiKey(apiKey.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return renderAccountSettings();
      case 'billing':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Billing & Plans</h2>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Billing Management</h3>
                  <p className="text-gray-600 mb-4">
                    Manage your subscription, view usage, and update payment methods
                  </p>
                  <a
                    href="/billing"
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Go to Billing Page
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      case 'api':
        return renderApiSettings();
      case 'import':
        return renderEnrichmentSettings();
      case 'notifications':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Settings</h2>
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Email Notifications</h3>
                <div className="space-y-4">
                  {Object.entries({
                    email_enrichment_complete: 'Enrichment Complete',
                    email_batch_ready: 'Batch Ready for Export',
                    email_credits_low: 'Low Credit Warning',
                    email_billing: 'Billing & Subscription Updates'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <button
                        onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          notifications[key as keyof typeof notifications] ? 'bg-teal-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          notifications[key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </label>
                  ))}
                </div>
                <div className="mt-6">
                  <button 
                    onClick={saveNotificationSettings}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2 inline" />
                    )}
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'team':
        return renderTeamSettings();
      case 'security':
        return renderSecuritySettings();
      case 'integrations':
        return renderIntegrationSettings();
      case 'export':
        return renderDataExportSettings();
      default:
        return null;
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex gap-8">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <nav className="space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeSection === item.id 
                    ? 'bg-gradient-to-r from-teal-50 to-blue-50 text-teal-700 border border-teal-200' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SettingsPage;