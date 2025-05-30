import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Calendar, TrendingUp, Clock, Star, Check, X, 
  AlertCircle, Info, ChevronRight, Download, RefreshCw, Zap,
  Target, BarChart3, Users, Shield, Headphones, Globe, Crown,
  ArrowRight, CheckCircle, XCircle, Timer, History, Eye,
  Plus, Trash2, ExternalLink, Lock, DollarSign, FileText,
  AlertTriangle, Loader2, CreditCard as CardIcon, Building
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';

interface Subscription {
  id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  current_period_start: string;
  current_period_end: string;
  billing_cycle: 'monthly' | 'annual';
}

interface CurrentPlan {
  id: string;
  name: string;
  display_name: string;
  plan_type: 'starter' | 'pro' | 'enterprise';
  credits_monthly: number;
  price_monthly: number;
  price_annual: number;
  features: string[];
  popular?: boolean;
  is_active: boolean;
}

interface CreditUsage {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  expired_credits: number;
  credits_by_month: Array<{
    month: string;
    allocated: number;
    remaining: number;
    expires_at: string;
  }>;
}

interface EnrichmentHistoryItem {
  id: string;
  contact_name: string;
  contact_email?: string;
  enrichment_type: 'email' | 'phone';
  status: 'success' | 'failed' | 'cached';
  source: 'internal' | 'apollo' | 'hunter' | 'clearbit' | 'dropcontact' | 'icypeas';
  result_data?: string;
  credits_used: number;
  created_at: string;
}

interface Transaction {
  id: string;
  type: 'subscription' | 'credit_purchase' | 'refund';
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending';
  description: string;
  credits_added?: number;
  created_at: string;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  provider: string;
  last_four: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

const BillingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedProPlan, setSelectedProPlan] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  
  // Real data states
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [creditUsage, setCreditUsage] = useState<CreditUsage | null>(null);
  const [enrichmentHistory, setEnrichmentHistory] = useState<EnrichmentHistoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [packages, setPackages] = useState<CurrentPlan[]>([]);
  const [proPlans, setProPlans] = useState<any[]>([]);

  const fetchBillingDashboard = async () => {
    try {
      const response = await fetch('http://localhost:8006/api/billing/dashboard');
      if (!response.ok) throw new Error('Failed to fetch billing dashboard');
      
      const data = await response.json();
      setCurrentPlan(data.current_plan);
      setSubscription(data.subscription);
      setCreditUsage(data.credit_usage);
      setPaymentMethods(data.payment_methods || []);
      setTransactions(data.recent_transactions || []);
    } catch (error) {
      console.error('Error fetching billing dashboard:', error);
    }
  };

  const fetchPackages = async () => {
    try {
      // Fetch all packages
      const packagesResponse = await fetch('http://localhost:8006/api/packages');
      if (!packagesResponse.ok) throw new Error('Failed to fetch packages');
      
      const packagesData = await packagesResponse.json();
      setPackages(packagesData);

      // Fetch pro plans specifically
      const proPlansResponse = await fetch('http://localhost:8006/api/packages/pro-plans');
      if (!proPlansResponse.ok) throw new Error('Failed to fetch pro plans');
      
      const proPlansData = await proPlansResponse.json();
      setProPlans(proPlansData.plans || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchEnrichmentHistory = async () => {
    try {
      const response = await fetch('http://localhost:8006/api/enrichment/history');
      if (!response.ok) throw new Error('Failed to fetch enrichment history');
      
      const data = await response.json();
      setEnrichmentHistory(data);
    } catch (error) {
      console.error('Error fetching enrichment history:', error);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      const response = await fetch('http://localhost:8006/api/billing/history');
      if (!response.ok) throw new Error('Failed to fetch billing history');
      
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching billing history:', error);
    }
  };

  const fetchAllBillingData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBillingDashboard(),
        fetchPackages(),
        fetchEnrichmentHistory(),
        fetchBillingHistory()
      ]);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBillingData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAllBillingData();
      toast.success('Billing data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handlePlanUpgrade = async (packageId: string, billingCycle: 'monthly' | 'annual') => {
    try {
      setLoading(true);
      
      // Create subscription through billing service
      await apiService.createSubscription(packageId, billingCycle === 'annual' ? 'yearly' : 'monthly');
      
      toast.success('Redirecting to checkout...');
      
      // In production, this would redirect to Stripe Checkout or open a payment modal
      setTimeout(() => {
        toast.success('Subscription updated successfully!');
        fetchAllBillingData();
      }, 2000);
      
    } catch (error) {
      toast.error('Failed to initiate upgrade');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of the billing period.')) {
      return;
    }

    try {
      setLoading(true);
      await apiService.cancelSubscription(subscription.id);
      toast.success('Subscription canceled. You will retain access until the end of the billing period.');
      await fetchAllBillingData();
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (transactionId?: string) => {
    setDownloadingInvoice(true);
    try {
      // In production, this would download the actual invoice PDF
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a mock invoice
      const invoiceData = {
        invoice_number: `INV-2024-${Math.floor(Math.random() * 10000)}`,
        date: new Date().toISOString(),
        amount: currentPlan?.price_monthly || 0,
        plan: currentPlan?.display_name || 'Unknown',
        transaction_id: transactionId || 'N/A'
      };
      
      // Create and download a simple text file as a mock invoice
      const blob = new Blob([JSON.stringify(invoiceData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceData.invoice_number}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      // In production, this would open Stripe's payment method setup
      toast.success('Redirecting to secure payment setup...');
      
      // Mock adding a payment method
      setTimeout(() => {
        const newPaymentMethod: PaymentMethod = {
          id: `pm-${Date.now()}`,
          type: 'card',
          provider: 'stripe',
          last_four: '5555',
          brand: 'mastercard',
          exp_month: 12,
          exp_year: 2026,
          is_default: paymentMethods.length === 0,
          is_verified: true,
          created_at: new Date().toISOString()
        };
        
        setPaymentMethods([...paymentMethods, newPaymentMethod]);
        setShowAddPaymentMethod(false);
        toast.success('Payment method added successfully');
      }, 2000);
    } catch (error) {
      toast.error('Failed to add payment method');
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      setLoading(true);
      // In production, this would call the API to remove the payment method
      setPaymentMethods(paymentMethods.filter(pm => pm.id !== paymentMethodId));
      toast.success('Payment method removed successfully');
    } catch (error) {
      toast.error('Failed to remove payment method');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      setLoading(true);
      // In production, this would call the API to set the default payment method
      setPaymentMethods(paymentMethods.map(pm => ({
        ...pm,
        is_default: pm.id === paymentMethodId
      })));
      toast.success('Default payment method updated');
    } catch (error) {
      toast.error('Failed to update default payment method');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cached': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'internal': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'apollo': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'hunter': return 'bg-green-100 text-green-700 border-green-200';
      case 'clearbit': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'dropcontact': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'icypeas': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const calculateAnnualSavings = (monthlyPrice: number) => {
    const annualPrice = monthlyPrice * 12 * 0.8; // 20% discount
    const savings = (monthlyPrice * 12) - annualPrice;
    return { annualPrice, savings };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCardBrandIcon = (brand?: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return <div className="text-blue-600 font-bold text-xs">VISA</div>;
      case 'mastercard':
        return <div className="text-red-600 font-bold text-xs">MC</div>;
      case 'amex':
        return <div className="text-blue-500 font-bold text-xs">AMEX</div>;
      default:
        return <CreditCard className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading && !currentPlan) {
    return (
      <div className="max-w-7xl mx-auto bg-white min-h-screen">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading billing information...</p>
          </div>
        </div>
      </div>
    );
  }

  // Get main plans from packages
  const mainPlans = packages.filter(pkg => 
    ['starter', 'pro-5k', 'enterprise'].includes(pkg.id)
  );

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
              Billing & Credits
            </h1>
            <p className="text-gray-600 mt-2">
              Manage your subscription and monitor credit usage
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
            >
              <History className="h-4 w-4 mr-2" />
              {showHistory ? 'Hide' : 'Show'} History
            </button>
            <button 
              onClick={() => handleDownloadInvoice()}
              disabled={downloadingInvoice}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
            >
              {downloadingInvoice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Invoice
            </button>
          </div>
        </div>
      </motion.div>

      {/* Current Plan & Credits Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Current Plan */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-xl border border-teal-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Crown className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Current Plan</h3>
                <p className="text-sm text-gray-600">
                  {subscription?.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} subscription
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
              subscription?.status === 'active' 
                ? 'bg-green-100 text-green-700 border-green-200'
                : subscription?.status === 'trialing'
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-yellow-100 text-yellow-700 border-yellow-200'
            }`}>
              {subscription?.status || 'Unknown'}
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-2xl font-bold text-gray-900">{currentPlan?.display_name}</h4>
              <p className="text-gray-600">{currentPlan?.credits_monthly?.toLocaleString()} credits/month</p>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-teal-600">
                €{subscription?.billing_cycle === 'annual' 
                  ? (currentPlan?.price_annual || 0) / 12 
                  : currentPlan?.price_monthly}
              </span>
              <span className="text-sm text-gray-600">/month</span>
            </div>
            
            <div className="pt-4 border-t border-teal-200 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Next billing date</span>
                <span className="font-medium text-gray-900">
                  {subscription?.current_period_end ? formatDate(subscription.current_period_end) : 'N/A'}
                </span>
              </div>
              {subscription?.status === 'active' && (
                <button
                  onClick={handleCancelSubscription}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Credits Overview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Credit Usage</h3>
                <p className="text-sm text-gray-600">Current period</p>
              </div>
            </div>
            <button 
              onClick={handleRefresh}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Credits Used</span>
                <span className="text-lg font-bold text-gray-900">
                  {creditUsage?.used_credits?.toLocaleString()} / {creditUsage?.total_credits?.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${((creditUsage?.used_credits || 0) / (creditUsage?.total_credits || 1)) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(((creditUsage?.used_credits || 0) / (creditUsage?.total_credits || 1)) * 100)}% used
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{creditUsage?.remaining_credits?.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Remaining</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{creditUsage?.expired_credits?.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Expired</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Payment Methods */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
          <button
            onClick={() => setShowAddPaymentMethod(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Payment Method
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No payment methods on file</p>
            <p className="text-sm text-gray-500 mt-1">Add a payment method to continue your subscription</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`border rounded-lg p-4 transition-all duration-200 ${
                  method.is_default 
                    ? 'border-teal-500 bg-teal-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      {getCardBrandIcon(method.brand)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          •••• {method.last_four}
                        </span>
                        {method.is_default && (
                          <span className="px-2 py-1 bg-teal-600 text-white text-xs rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Expires {method.exp_month}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.is_default && (
                      <button
                        onClick={() => handleSetDefaultPaymentMethod(method.id)}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Set as default
                      </button>
                    )}
                    <button
                      onClick={() => handleRemovePaymentMethod(method.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Credit Expiration Details */}
      {creditUsage && creditUsage.credits_by_month.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Credit Expiration Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creditUsage.credits_by_month.map((month, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{month.month}</h4>
                  <Timer className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Allocated:</span>
                    <span className="font-medium">{month.allocated.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-medium text-green-600">{month.remaining.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expires:</span>
                    <span className="font-medium text-red-600">{formatDate(month.expires_at)}</span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(month.remaining / month.allocated) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Billing Type Toggle */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          <div className="bg-gray-100 rounded-lg p-1 inline-flex">
            <button
              onClick={() => setBillingType('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                billingType === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingType('annual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                billingType === 'annual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual (20% off)
            </button>
          </div>
        </div>
      </div>

      {/* Main Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {mainPlans.map((plan) => {
          const { annualPrice, savings } = calculateAnnualSavings(plan.price_monthly);
          const isCurrentPlan = currentPlan?.id === plan.id;
          
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative bg-white rounded-xl shadow-lg border-2 transition-all duration-300 ${
                plan.popular 
                  ? 'border-teal-500 shadow-xl scale-105' 
                  : isCurrentPlan
                  ? 'border-green-500'
                  : 'border-gray-200 hover:border-teal-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-1 rounded-full text-xs font-bold">
                    MOST POPULAR
                  </span>
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    CURRENT
                  </span>
                </div>
              )}

              <div className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
                  <div className="mt-4">
                    {plan.plan_type === 'enterprise' ? (
                      <div>
                        <span className="text-3xl font-bold text-gray-900">Custom</span>
                        <p className="text-sm text-gray-600 mt-1">Contact us for pricing</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-gray-900">
                          €{billingType === 'annual' ? (annualPrice / 12).toFixed(0) : plan.price_monthly}
                        </span>
                        <span className="text-gray-600">
                          /{billingType === 'annual' ? 'month' : 'month'}
                        </span>
                        {billingType === 'annual' && (
                          <p className="text-sm text-green-600 mt-1">
                            Save €{savings.toFixed(0)}/year
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {plan.plan_type !== 'enterprise' && (
                    <p className="text-sm text-gray-600 mt-2">
                      {plan.credits_monthly.toLocaleString()} credits/month
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanUpgrade(plan.id, billingType)}
                  disabled={isCurrentPlan || loading}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {isCurrentPlan ? 'Current Plan' : plan.plan_type === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pro Plans Expansion */}
      {proPlans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pro Plan Options</h3>
          <p className="text-gray-600 mb-6">Choose the perfect credit volume for your needs</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {proPlans.map((plan) => {
              const { annualPrice, savings } = calculateAnnualSavings(plan.price_monthly);
              const isCurrentPlan = currentPlan?.id === plan.id;
              
              return (
                <div
                  key={plan.id}
                  className={`border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                    plan.popular 
                      ? 'border-teal-500 bg-teal-50' 
                      : isCurrentPlan
                      ? 'border-green-500 bg-green-50'
                      : selectedProPlan === plan.id
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300'
                  }`}
                  onClick={() => setSelectedProPlan(plan.id)}
                >
                  {plan.popular && (
                    <div className="text-center mb-2">
                      <span className="bg-teal-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        POPULAR
                      </span>
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="text-center mb-2">
                      <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        CURRENT
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h4 className="font-bold text-gray-900">{plan.credits_monthly.toLocaleString()}</h4>
                    <p className="text-xs text-gray-600 mb-2">credits/month</p>
                    <p className="text-lg font-bold text-gray-900">
                      €{billingType === 'annual' ? (annualPrice / 12).toFixed(0) : plan.price_monthly}
                    </p>
                    <p className="text-xs text-gray-600">
                      /month
                    </p>
                    {billingType === 'annual' && (
                      <p className="text-xs text-green-600 mt-1">
                        Save €{savings.toFixed(0)}/year
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {selectedProPlan && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={() => handlePlanUpgrade(selectedProPlan, billingType)}
                disabled={loading}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Upgrade to Selected Plan'
                )}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  {transaction.type === 'subscription' ? (
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                  ) : transaction.type === 'credit_purchase' ? (
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Zap className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="p-2 bg-red-100 rounded-lg">
                      <ArrowRight className="w-5 h-5 text-red-600" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-medium text-gray-900">{transaction.description}</h4>
                    <p className="text-sm text-gray-600">{formatDate(transaction.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    €{transaction.amount.toFixed(2)}
                  </p>
                  {transaction.credits_added && (
                    <p className="text-sm text-green-600">
                      +{transaction.credits_added.toLocaleString()} credits
                    </p>
                  )}
                  <button
                    onClick={() => handleDownloadInvoice(transaction.id)}
                    className="text-xs text-teal-600 hover:text-teal-700 mt-1"
                  >
                    Download invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Enrichment History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8"
          >
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Enrichment History</h3>
              <p className="text-sm text-gray-600 mt-1">Recent credit usage and enrichment results</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {enrichmentHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.contact_name || 'Unknown'}</div>
                        {item.contact_email && (
                          <div className="text-xs text-gray-500">{item.contact_email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.enrichment_type === 'email' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {item.enrichment_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(item.status)}
                          <span className="ml-2 text-sm text-gray-900 capitalize">{item.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          item.credits_used > 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {item.credits_used > 0 ? `-${item.credits_used}` : '0'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSourceColor(item.source)}`}>
                          {item.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.result_data || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credit Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mt-8"
      >
        <div className="flex items-start space-x-4">
          <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">How Credits Work</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• <strong>1 email found = 1 credit</strong> - When we successfully find an email address</p>
              <p>• <strong>1 phone found = 10 credits</strong> - When we successfully find a phone number</p>
              <p>• <strong>No result = No charge</strong> - Credits are only deducted for successful enrichments</p>
              <p>• <strong>Cached results still cost credits</strong> - Even if data is served from our shared database</p>
              <p>• <strong>Credits expire after 3 months</strong> - Rolling expiration, oldest credits used first</p>
              <p>• <strong>Annual plans</strong> - All credits allocated upfront, valid for 18 months</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add Payment Method Modal */}
      <AnimatePresence>
        {showAddPaymentMethod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddPaymentMethod(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Add Payment Method</h2>
                <button
                  onClick={() => setShowAddPaymentMethod(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-start">
                    <Lock className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h5 className="font-medium text-blue-900 mb-1">Secure Payment</h5>
                      <p className="text-sm text-blue-700">
                        Your payment information is encrypted and processed securely through Stripe.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddPaymentMethod}
                  className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200"
                >
                  Continue to Stripe Checkout
                  <ExternalLink className="w-4 h-4 ml-2 inline" />
                </button>

                <p className="text-xs text-center text-gray-500">
                  By adding a payment method, you agree to our terms of service and privacy policy.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BillingPage;