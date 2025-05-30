import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, User, CreditCard, Key, Shield, Bell, 
  Users, Database, Globe, Eye, EyeOff, Check, X, Plus, Trash2,
  Download, Upload, Save, Lock, Unlock, Mail, Phone, Smartphone,
  AlertCircle, CheckCircle, Clock, RefreshCw, Copy, ExternalLink,
  Calendar, DollarSign, TrendingUp, BarChart3, Zap, Target,
  Filter, Search, Edit, Monitor, Webhook, Cloud, Settings2
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

interface BillingInfo {
  plan: string;
  credits_used: number;
  credits_total: number;
  billing_cycle: string;
  next_billing_date: string;
  amount: number;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used?: string;
  status: 'active' | 'revoked';
}

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('account');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  // State for different sections
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [notifications, setNotifications] = useState({
    email_marketing: true,
    email_batches: true,
    email_billing: true,
    sms_alerts: false,
    push_notifications: true,
    webhook_notifications: false
  });
  const [enrichmentSettings, setEnrichmentSettings] = useState({
    auto_enrich: true,
    data_sources: ['apollo', 'hunter', 'clearbit'],
    accuracy_threshold: 85,
    retry_failed: true,
    retention_days: 90
  });
  const [securitySettings, setSecuritySettings] = useState({
    two_factor_enabled: false,
    login_alerts: true,
    session_timeout: 480, // 8 hours
    allowed_ips: []
  });

  // Form states
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [newApiKeyName, setNewApiKeyName] = useState('');

  useEffect(() => {
    fetchUserProfile();
    fetchBillingInfo();
    fetchApiKeys();
  }, []);

  const fetchUserProfile = async () => {
    try {
      // Mock data for now - replace with actual API call
      setProfile({
        id: '1',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@captely.com',
        phone: '+1-555-0123',
        created_at: '2024-01-01T00:00:00Z'
      });
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const fetchBillingInfo = async () => {
    try {
      // Mock data for now
      setBilling({
        plan: 'Enterprise',
        credits_used: 15420,
        credits_total: 20000,
        billing_cycle: 'monthly',
        next_billing_date: '2024-03-15',
        amount: 499
      });
    } catch (error) {
      toast.error('Failed to load billing info');
    }
  };

  const fetchApiKeys = async () => {
    try {
      // Mock data for now
      setApiKeys([
        {
          id: '1',
          name: 'Production API',
          key: 'cap_live_1234567890abcdef',
          created_at: '2024-01-15T00:00:00Z',
          last_used: '2024-02-28T10:30:00Z',
          status: 'active'
        },
        {
          id: '2',
          name: 'Development API',
          key: 'cap_test_abcdef1234567890',
          created_at: '2024-02-01T00:00:00Z',
          last_used: '2024-02-25T14:20:00Z',
          status: 'active'
        }
      ]);
    } catch (error) {
      toast.error('Failed to load API keys');
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      // API call to change password
      toast.success('Password updated successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    
    setLoading(true);
    try {
      const newKey: ApiKey = {
        id: Date.now().toString(),
        name: newApiKeyName,
        key: `cap_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        created_at: new Date().toISOString(),
        status: 'active'
      };
      setApiKeys([...apiKeys, newKey]);
      setNewApiKeyName('');
      toast.success('API key generated successfully');
    } catch (error) {
      toast.error('Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    setLoading(true);
    try {
      setApiKeys(apiKeys.map(key => 
        key.id === keyId ? { ...key, status: 'revoked' as const } : key
      ));
      toast.success('API key revoked');
    } catch (error) {
      toast.error('Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const sidebarItems = [
    { id: 'account', label: 'Account Settings', icon: <User className="w-5 h-5" /> },
    { id: 'billing', label: 'Billing & Plans', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'api', label: 'API & Keys', icon: <Key className="w-5 h-5" /> },
    { id: 'enrichment', label: 'Enrichment Settings', icon: <Database className="w-5 h-5" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
    { id: 'team', label: 'Team & Access', icon: <Users className="w-5 h-5" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-5 h-5" /> },
    { id: 'integrations', label: 'Integrations', icon: <Globe className="w-5 h-5" /> },
    { id: 'export', label: 'Data Export', icon: <Download className="w-5 h-5" /> }
  ];

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
            <button className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200">
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

  const renderBillingSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Billing & Plans</h2>
        
        {/* Current Plan */}
        <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-xl border border-teal-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{billing?.plan} Plan</h3>
              <p className="text-gray-600 mt-1">Perfect for growing businesses</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-teal-600">${billing?.amount}</p>
              <p className="text-sm text-gray-600">per month</p>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Credits Used</h3>
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">{billing?.credits_used?.toLocaleString()}</span>
                <span className="text-sm text-gray-600">/ {billing?.credits_total?.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((billing?.credits_used || 0) / (billing?.credits_total || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Next Billing</h3>
              <Calendar className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {billing?.next_billing_date ? new Date(billing.next_billing_date).toLocaleDateString() : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Auto-renewal enabled</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Status</h3>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">Active</p>
            <p className="text-sm text-gray-600 mt-1">All systems operational</p>
          </div>
        </div>

        {/* Plan Options */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Starter', price: 49, credits: 5000, features: ['Basic enrichment', 'Email support', 'API access'] },
              { name: 'Professional', price: 199, credits: 15000, features: ['Advanced enrichment', 'Priority support', 'Webhooks', 'Team collaboration'] },
              { name: 'Enterprise', price: 499, credits: 20000, features: ['Premium enrichment', '24/7 support', 'Custom integrations', 'Advanced analytics'], current: true }
            ].map((plan) => (
              <div key={plan.name} className={`border-2 rounded-xl p-6 transition-all duration-200 ${
                plan.current ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
              }`}>
                <div className="text-center">
                  <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{plan.credits.toLocaleString()} credits</p>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full mt-6 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  plan.current 
                    ? 'bg-gray-100 text-gray-600 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                }`} disabled={plan.current}>
                  {plan.current ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            ))}
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
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter API key name (e.g., 'Production App')"
              value={newApiKeyName}
              onChange={(e) => setNewApiKeyName(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
            />
            <button
              onClick={generateApiKey}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate
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
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-sm font-semibold text-gray-900">{apiKey.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                        title={showApiKey === apiKey.id ? "Hide" : "Show"}
                      >
                        {showApiKey === apiKey.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(apiKey.key)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {apiKey.status === 'active' && (
                    <button
                      onClick={() => revokeApiKey(apiKey.id)}
                      className="ml-4 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4 mr-1 inline" />
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Documentation */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">API Documentation</h3>
              <p className="text-sm text-gray-600 mt-1">Learn how to integrate with Captely's API</p>
            </div>
            <a
              href="/docs/api"
              className="inline-flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg shadow hover:shadow-md transition-all duration-200 text-sm font-medium"
            >
              View Docs
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEnrichmentSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Enrichment Settings</h2>
        
        {/* Auto-Enrichment */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Auto-Enrichment</h3>
              <p className="text-sm text-gray-600">Automatically enrich contacts when they're imported</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enrichmentSettings.auto_enrich}
                onChange={(e) => setEnrichmentSettings(prev => ({...prev, auto_enrich: e.target.checked}))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>
        </div>

        {/* Data Sources */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Sources</h3>
          <p className="text-sm text-gray-600 mb-4">Select which data sources to use for enrichment</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'apollo', name: 'Apollo', description: 'Professional contact database' },
              { id: 'hunter', name: 'Hunter', description: 'Email finder and verifier' },
              { id: 'clearbit', name: 'Clearbit', description: 'Company intelligence' },
              { id: 'zoominfo', name: 'ZoomInfo', description: 'B2B contact intelligence' },
              { id: 'lusha', name: 'Lusha', description: 'Contact enrichment platform' },
              { id: 'snov', name: 'Snov.io', description: 'Email finder and CRM' }
            ].map((source) => (
              <label key={source.id} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:border-teal-300 transition-all duration-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrichmentSettings.data_sources.includes(source.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setEnrichmentSettings(prev => ({
                        ...prev,
                        data_sources: [...prev.data_sources, source.id]
                      }));
                    } else {
                      setEnrichmentSettings(prev => ({
                        ...prev,
                        data_sources: prev.data_sources.filter(s => s !== source.id)
                      }));
                    }
                  }}
                  className="mt-1 w-4 h-4 text-teal-600 bg-white border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{source.name}</div>
                  <div className="text-xs text-gray-600">{source.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Quality Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accuracy Threshold: {enrichmentSettings.accuracy_threshold}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={enrichmentSettings.accuracy_threshold}
                  onChange={(e) => setEnrichmentSettings(prev => ({...prev, accuracy_threshold: parseInt(e.target.value)}))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrichmentSettings.retry_failed}
                  onChange={(e) => setEnrichmentSettings(prev => ({...prev, retry_failed: e.target.checked}))}
                  className="w-4 h-4 text-teal-600 bg-white border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                />
                <span className="text-sm text-gray-700">Retry failed enrichments</span>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Retention</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keep enriched data for
              </label>
              <select
                value={enrichmentSettings.retention_days}
                onChange={(e) => setEnrichmentSettings(prev => ({...prev, retention_days: parseInt(e.target.value)}))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
                <option value={-1}>Forever</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200">
            <Save className="w-4 h-4 mr-2 inline" />
            Save Enrichment Settings
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Settings</h2>
        
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="space-y-6">
            {[
              { 
                key: 'email_marketing', 
                title: 'Marketing Emails', 
                description: 'Product updates, tips, and marketing communications',
                icon: <Mail className="w-5 h-5" />
              },
              { 
                key: 'email_batches', 
                title: 'Batch Notifications', 
                description: 'Get notified when enrichment batches are completed',
                icon: <CheckCircle className="w-5 h-5" />
              },
              { 
                key: 'email_billing', 
                title: 'Billing Alerts', 
                description: 'Important billing and payment notifications',
                icon: <CreditCard className="w-5 h-5" />
              },
              { 
                key: 'sms_alerts', 
                title: 'SMS Alerts', 
                description: 'Critical alerts via SMS (additional charges may apply)',
                icon: <Smartphone className="w-5 h-5" />
              },
              { 
                key: 'push_notifications', 
                title: 'Push Notifications', 
                description: 'Browser notifications for real-time updates',
                icon: <Bell className="w-5 h-5" />
              },
              { 
                key: 'webhook_notifications', 
                title: 'Webhook Notifications', 
                description: 'Send notifications to your webhook endpoints',
                icon: <Webhook className="w-5 h-5" />
              }
            ].map((notification) => (
              <div key={notification.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-teal-300 transition-all duration-200">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                    {notification.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{notification.title}</h4>
                    <p className="text-sm text-gray-600">{notification.description}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications[notification.key as keyof typeof notifications]}
                    onChange={(e) => setNotifications(prev => ({
                      ...prev,
                      [notification.key]: e.target.checked
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200">
              <Save className="w-4 h-4 mr-2 inline" />
              Save Notification Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account': return renderAccountSettings();
      case 'billing': return renderBillingSettings();
      case 'api': return renderApiSettings();
      case 'enrichment': return renderEnrichmentSettings();
      case 'notifications': return renderNotificationSettings();
      case 'team': return <div className="p-8 text-center text-gray-500">Team management coming soon...</div>;
      case 'security': return <div className="p-8 text-center text-gray-500">Security settings coming soon...</div>;
      case 'integrations': return <div className="p-8 text-center text-gray-500">Integrations management coming soon...</div>;
      case 'export': return <div className="p-8 text-center text-gray-500">Data export tools coming soon...</div>;
      default: return renderAccountSettings();
    }
  };

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <SettingsIcon className="h-6 w-6 text-teal-600" />
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            </div>
            
            <nav className="space-y-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeSection === item.id
                      ? 'bg-gradient-to-r from-teal-50 to-teal-100 text-teal-700 border border-teal-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="p-8">
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
      </div>
    </div>
  );
};

export default SettingsPage;