import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Calendar, TrendingUp, Clock, Star, Check, X, 
  AlertCircle, Info, ChevronRight, Download, RefreshCw, Zap,
  Target, BarChart3, Users, Shield, Headphones, Globe, Crown,
  ArrowRight, CheckCircle, XCircle, Timer, History, Eye,
  Plus, Trash2, ExternalLink, Lock, DollarSign, FileText,
  AlertTriangle, Loader2, CreditCard as CardIcon, Building,
  Mail, Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

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
  email_hit_rate: number;
  phone_hit_rate: number;
  success_stats: {
    total_enrichments: number;
    successful_enrichments: number;
    emails_found: number;
    phones_found: number;
    success_rate: number;
  };
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
  const { t, formatMessage } = useLanguage();
  
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
  
  // Credit Pack Options - Replace the old plans
  const creditPacks = [
    {
      id: 'pack-500',
      name: t('billing.creditPacks.pack500'),
      credits: 500,
      price_monthly: 25,
      price_annual: 240, // 12 * 20 (20% discount)
      emails_equivalent: 500,
      phones_equivalent: 50,
      popular: false
    },
    {
      id: 'pack-1500',
      name: t('billing.creditPacks.pack1500'),
      credits: 1500,
      price_monthly: 70,
      price_annual: 672, // 12 * 56 (20% discount)
      emails_equivalent: 1500,
      phones_equivalent: 150,
      popular: true
    },
    {
      id: 'pack-3000',
      name: t('billing.creditPacks.pack3000'),
      credits: 3000,
      price_monthly: 130,
      price_annual: 1248, // 12 * 104 (20% discount)
      emails_equivalent: 3000,
      phones_equivalent: 300,
      popular: false
    },
    {
      id: 'pack-5000',
      name: t('billing.creditPacks.pack5000'),
      credits: 5000,
      price_monthly: 200,
      price_annual: 1920, // 12 * 160 (20% discount)
      emails_equivalent: 5000,
      phones_equivalent: 500,
      popular: false
    },
    {
      id: 'pack-10000',
      name: t('billing.creditPacks.pack10000'),
      credits: 10000,
      price_monthly: 380,
      price_annual: 3648, // 12 * 304 (20% discount)
      emails_equivalent: 10000,
      phones_equivalent: 1000,
      popular: false
    },
    {
      id: 'pack-20000',
      name: t('billing.creditPacks.pack20000'),
      credits: 20000,
      price_monthly: 720,
      price_annual: 6912, // 12 * 576 (20% discount)
      emails_equivalent: 20000,
      phones_equivalent: 2000,
      popular: false
    }
  ];

  const fetchBillingDashboard = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BILLING_URL}/api/billing/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch billing dashboard');
      
      const data = await response.json();
      setCurrentPlan(data.current_plan);
      setSubscription(data.subscription);
      setPaymentMethods(data.payment_methods || []);
      setTransactions(data.recent_transactions || []);
    } catch (error) {
      console.error('Error fetching billing dashboard:', error);
    }
  };

  const fetchPackages = async () => {
    try {
      // Fetch all packages
      const packagesResponse = await fetch(`${import.meta.env.VITE_BILLING_URL}/api/packages`);
      if (!packagesResponse.ok) throw new Error('Failed to fetch packages');
      
      const packagesData = await packagesResponse.json();
      setPackages(packagesData);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchCreditUsage = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_IMPORT_URL}/api/user/credits`);
      if (!response.ok) throw new Error('Failed to fetch credit usage');
      
      const data = await response.json();
      
      // Update credit usage data with real values
      setCreditUsage({
        total_credits: data.limit_monthly || 5000,
        used_credits: data.used_this_month || 0,  // Use actual used credits, not calculated
        remaining_credits: data.balance || 0,     // Use actual balance from API
        expired_credits: 0,
        credits_by_month: [
          {
            month: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            allocated: data.limit_monthly || 5000,
            remaining: data.balance || 0,        // Use actual balance
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        email_hit_rate: data.statistics?.email_hit_rate || 0,
        phone_hit_rate: data.statistics?.phone_hit_rate || 0,  
        success_stats: {
          total_enrichments: data.statistics?.total_enriched || 0,
          successful_enrichments: data.statistics?.total_enriched || 0,
          emails_found: data.statistics?.emails_found || 0,
          phones_found: data.statistics?.phones_found || 0,
          success_rate: data.statistics?.success_rate || 0
        }
      });
    } catch (error) {
      console.error('Error fetching credit usage:', error);
    }
  };

  const fetchEnrichmentHistory = async () => {
    try {
      // Fetch real enrichment history from analytics service
      const response = await fetch(`${import.meta.env.VITE_ANALYTICS_URL}/api/analytics/enrichment-history`);
      if (!response.ok) {
        // Fallback to mock data if analytics service isn't available
        console.warn('Analytics service unavailable, using enrichment data from billing service');
        return;
      }
      
      const data = await response.json();
      setEnrichmentHistory(data.enrichments || []);
    } catch (error) {
      console.error('Error fetching enrichment history:', error);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BILLING_URL}/api/billing/history`);
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
        fetchCreditUsage(),
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
      toast.success(t('billing.billingDataRefreshed'));
    } catch (error) {
      toast.error(t('billing.failedToRefreshData'));
    } finally {
      setRefreshing(false);
    }
  };

  const handlePlanUpgrade = async (packageId: string, billingCycle: 'monthly' | 'annual') => {
    try {
      setLoading(true);
      
      // Create subscription through billing service - Mock implementation
      // await apiService.createSubscription(packageId, billingCycle === 'annual' ? 'yearly' : 'monthly');
      
      toast.success(t('billing.redirectingToCheckout'));
      
      // In production, this would redirect to Stripe Checkout or open a payment modal
      setTimeout(() => {
        toast.success(t('billing.subscriptionUpdatedSuccessfully'));
        fetchAllBillingData();
      }, 2000);
      
    } catch (error) {
      toast.error(t('billing.failedToInitiateUpgrade'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !confirm(t('billing.confirmCancelSubscription'))) {
      return;
    }

    try {
      setLoading(true);
      // await apiService.cancelSubscription(subscription.id);
      toast.success(t('billing.subscriptionCanceled'));
      await fetchAllBillingData();
    } catch (error) {
      toast.error(t('billing.failedToCancelSubscription'));
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
      
      toast.success(t('billing.invoiceDownloadedSuccessfully'));
    } catch (error) {
      toast.error(t('billing.failedToDownloadInvoice'));
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      // In production, this would open Stripe's payment method setup
      toast.success(t('billing.redirectingToSecurePaymentSetup'));
      
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
        toast.success(t('billing.paymentMethodAddedSuccessfully'));
      }, 2000);
    } catch (error) {
      toast.error(t('billing.failedToAddPaymentMethod'));
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm(t('billing.confirmRemovePaymentMethod'))) {
      return;
    }

    try {
      setLoading(true);
      // In production, this would call the API to remove the payment method
      setPaymentMethods(paymentMethods.filter(pm => pm.id !== paymentMethodId));
      toast.success(t('billing.paymentMethodRemovedSuccessfully'));
    } catch (error) {
      toast.error(t('billing.failedToRemovePaymentMethod'));
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
      toast.success(t('billing.defaultPaymentMethodUpdated'));
    } catch (error) {
      toast.error(t('billing.failedToUpdateDefaultPaymentMethod'));
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
            <p className="mt-4 text-gray-600">{t('billing.loadingBillingInformation')}</p>
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
              {t('billing.title')}
            </h1>
            <p className="text-gray-600 mt-2">
              {t('billing.subtitle')}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {t('billing.refreshButton')}
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
            >
              <History className="h-4 w-4 mr-2" />
              {showHistory ? t('billing.hideHistory') : t('billing.showHistory')}
            </button>
            <button 
              onClick={() => handleDownloadInvoice()}
              disabled={downloadingInvoice}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
            >
              {downloadingInvoice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {t('billing.downloadInvoice')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Credit Consumption Info Box - MODIFIED */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mb-8"
      >
        <div className="flex items-start space-x-4">
          <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('billing.creditConsumptionLogicTitle')}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-700 flex items-center">
                  <Zap className="w-4 h-4 text-blue-500 mr-2" />
                  <strong>1 email found = 1 credit</strong>
                </p>
                <p className="text-sm text-gray-700 flex items-center">
                  <Zap className="w-4 h-4 text-purple-500 mr-2" />
                  <strong>1 phone found = 10 credits</strong>
                </p>
                <p className="text-sm text-gray-700 flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  No result = No charge
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Current Plan & Credits Overview - MODIFIED */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mb-8">
        {/* Current Plan - ENHANCED WITH NEW BUTTONS */}
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
                <h3 className="text-lg font-bold text-gray-900">
                  {t('billing.currentPlanTitle')}
                </h3>
                <p className="text-sm text-gray-600">
                  {subscription?.billing_cycle === 'annual' ? t('billing.annualSubscription') : t('billing.monthlySubscription')}
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
              <span className="text-sm text-gray-600">/{t('billing.month')}</span>
            </div>
            
            <div className="pt-4 border-t border-teal-200 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {t('billing.nextBillingDate')}
                </span>
                <span className="font-medium text-gray-900">
                  {subscription?.current_period_end ? formatDate(subscription.current_period_end) : 'N/A'}
                </span>
              </div>
              
              {/* NEW BUTTONS */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowAddPaymentMethod(true)}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t('billing.managePaymentMethods')}
                </button>
                <button
                  onClick={() => handleDownloadInvoice()}
                  disabled={downloadingInvoice}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
                >
                  {downloadingInvoice ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  {t('billing.seeDownloadInvoices')}
                </button>
            </div>
              
              {subscription?.status === 'active' && (
            <button 
                  onClick={handleCancelSubscription}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
                  {t('billing.cancelSubscription')}
            </button>
              )}
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
          <h3 className="text-lg font-semibold text-gray-900">
            {t('billing.paymentMethodsTitle')}
          </h3>
          <button
            onClick={() => setShowAddPaymentMethod(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('billing.addPaymentMethod')}
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {t('billing.noPaymentMethods')}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {t('billing.addPaymentMethodDescription')}
            </p>
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
                            {t('billing.default')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {t('billing.expires')} {method.exp_month}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.is_default && (
                      <button
                        onClick={() => handleSetDefaultPaymentMethod(method.id)}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        {t('billing.setAsDefault')}
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
              {t('billing.monthly')}
            </button>
            <button
              onClick={() => setBillingType('annual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                billingType === 'annual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('billing.annualTwoMonthsOffered')}
            </button>
          </div>
        </div>
      </div>

      {/* CREDIT PACKS - REPLACE THE OLD PLANS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('billing.chooseCreditPackTitle')}
          </h2>
          <p className="text-gray-600">
            {t('billing.chooseCreditPackSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creditPacks.map((pack) => {
            const monthlyPrice = billingType === 'annual' ? pack.price_annual / 12 : pack.price_monthly;
            const totalPrice = billingType === 'annual' ? pack.price_annual : pack.price_monthly;
            const savings = billingType === 'annual' ? (pack.price_monthly * 12) - pack.price_annual : 0;
            const isCurrentPack = currentPlan?.credits_monthly === pack.credits;
          
          return (
            <motion.div
                key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative bg-white rounded-xl shadow-lg border-2 transition-all duration-300 ${
                  pack.popular 
                  ? 'border-teal-500 shadow-xl scale-105' 
                    : isCurrentPack
                  ? 'border-green-500'
                  : 'border-gray-200 hover:border-teal-300'
              }`}
            >
                {pack.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-1 rounded-full text-xs font-bold">
                    {t('billing.mostPopular')}
                  </span>
                </div>
              )}
              
                {isCurrentPack && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    {t('billing.current')}
                  </span>
                </div>
              )}

              <div className="p-6">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">{pack.name}</h3>
                  <div className="mt-4">
                        <span className="text-3xl font-bold text-gray-900">
                        €{monthlyPrice.toFixed(0)}
                        </span>
                      <span className="text-gray-600">/{t('billing.month')}</span>
                      
                      {billingType === 'annual' && savings > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-green-600 font-medium">
                            {t('billing.save')} €{savings.toFixed(0)}/{t('billing.year')}
                          </p>
                          <p className="text-xs text-green-500">
                            {t('billing.twoMonthsOffered')}
                          </p>
                      </div>
                    )}
                  </div>
                  
                    <p className="text-sm text-gray-600 mt-2">
                      {billingType === 'annual' ? (pack.credits * 12).toLocaleString() : pack.credits.toLocaleString()} 
                      {billingType === 'annual' ? t('billing.creditsPerYear') : t('billing.creditsPerMonth')}
                    </p>
                </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                      {billingType === 'annual' ? (pack.emails_equivalent * 12).toLocaleString() : pack.emails_equivalent.toLocaleString()} {t('billing.emails')}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" />
                      {billingType === 'annual' ? (pack.phones_equivalent * 12).toLocaleString() : pack.phones_equivalent.toLocaleString()} {t('billing.phones')}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {t('billing.apiAccessIntegrations')}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {t('billing.chromeExtension')}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {t('billing.emailSupport')}
                    </div>
                  </div>

                <button
                    onClick={() => handlePlanUpgrade(pack.id, billingType)}
                    disabled={isCurrentPack || loading}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      isCurrentPack
                      ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                        : pack.popular
                      ? 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : isCurrentPack ? (
                      t('billing.currentPack')
                ) : (
                      t('billing.buyThisPack')
                )}
              </button>
                  
                  {billingType === 'annual' && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                      {formatMessage('billing.billedAnnually', { amount: totalPrice.toFixed(0) })}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
          </div>
        </motion.div>

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
              <h3 className="text-lg font-semibold text-gray-900">
                {t('billing.enrichmentHistoryTitle')}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {t('billing.enrichmentHistorySubtitle')}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('billing.contact')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('billing.type')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('billing.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('billing.credits')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('billing.source')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('billing.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('billing.result')}
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

      {/* Credit Information - SIMPLIFIED */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mt-8"
      >
        <div className="flex items-start space-x-4">
          <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('billing.howCreditsWorkTitle')}
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• <strong>{t('billing.oneEmailOneCredit')}</strong> - {t('billing.emailCreditDescription')}</p>
              <p>• <strong>{t('billing.onePhoneTenCredits')}</strong> - {t('billing.phoneCreditDescription')}</p>
              <p>• <strong>{t('billing.noResultNoCharge')}</strong> - {t('billing.creditDeductionDescription')}</p>
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
                <h2 className="text-xl font-bold text-gray-900">
                  {t('billing.addPaymentMethodTitle')}
                </h2>
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
                      <h5 className="font-medium text-blue-900 mb-1">
                        {t('billing.securePaymentTitle')}
                      </h5>
                      <p className="text-sm text-blue-700">
                        {t('billing.securePaymentDescription')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddPaymentMethod}
                  className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200"
                >
                  {t('billing.continueToStripeCheckout')}
                  <ExternalLink className="w-4 h-4 ml-2 inline" />
                </button>

                <p className="text-xs text-center text-gray-500">
                  {t('billing.agreeTerms')}
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