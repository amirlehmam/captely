import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Calendar, TrendingUp, Clock, Star, Check, X, 
  AlertCircle, Info, ChevronRight, ChevronDown, Download, RefreshCw, Zap,
  Target, BarChart3, Users, Shield, Headphones, Globe, Crown,
  ArrowRight, CheckCircle, XCircle, Timer, History, Eye,
  Plus, Trash2, ExternalLink, Lock, DollarSign, FileText,
  AlertTriangle, Loader2, CreditCard as CardIcon, Building,
  Mail, Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { StripePaymentMethodSetup, CheckoutSession } from '../components/StripeElements';

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
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedProPlan, setSelectedProPlan] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [paymentMethodsExpanded, setPaymentMethodsExpanded] = useState(false);
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
      const data = await apiService.getBillingDashboard();
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
      // Fetch all packages using authenticated API service
      const packagesData = await apiService.getBillingPackages();
      setPackages(packagesData);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchCreditUsage = async () => {
    try {
      const data = await apiService.getCreditData();
      
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
      // Fetch enrichment history using authenticated API service
      const data = await apiService.getEnrichmentHistory();
      setEnrichmentHistory(data.enrichments || []);
    } catch (error) {
      console.warn('Analytics service unavailable, using enrichment data from billing service');
      console.error('Error fetching enrichment history:', error);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      // Fetch billing history using authenticated API service
      const data = await apiService.getBillingHistory();
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
      
      // Create Stripe checkout session
      const response = await apiService.createCheckoutSession(packageId, billingCycle);
      
      toast.success(t('billing.redirectingToCheckout'));
      
      // Redirect to Stripe Checkout
      window.location.href = response.checkout_url;
      
    } catch (error) {
      console.error('Upgrade error:', error);
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
      const response = await apiService.cancelSubscription();
      toast.success(response.message || t('billing.subscriptionCanceled'));
      await fetchAllBillingData();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error(t('billing.failedToCancelSubscription'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (transactionId?: string) => {
    setDownloadingInvoice(true);
    try {
      // Open customer portal for invoice downloads
      const response = await apiService.createCustomerPortalSession();
      window.open(response.portal_url, '_blank');
      toast.success(t('billing.redirectingToCustomerPortal'));
    } catch (error) {
      console.error('Invoice error:', error);
      toast.error(t('billing.failedToDownloadInvoice'));
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    // Show the Stripe Elements modal
    setShowAddPaymentMethod(true);
  };

  const handlePaymentMethodSuccess = async () => {
        setShowAddPaymentMethod(false);
    await fetchAllBillingData();
        toast.success(t('billing.paymentMethodAddedSuccessfully'));
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm(t('billing.confirmRemovePaymentMethod'))) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.removePaymentMethod(paymentMethodId);
      setPaymentMethods(paymentMethods.filter(pm => pm.id !== paymentMethodId));
      toast.success(response.message || t('billing.paymentMethodRemovedSuccessfully'));
    } catch (error) {
      console.error('Remove payment method error:', error);
      toast.error(t('billing.failedToRemovePaymentMethod'));
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      setLoading(true);
      const response = await apiService.setDefaultPaymentMethod(paymentMethodId);
      setPaymentMethods(paymentMethods.map(pm => ({
        ...pm,
        is_default: pm.id === paymentMethodId
      })));
      toast.success(response.message || t('billing.defaultPaymentMethodUpdated'));
    } catch (error) {
      console.error('Set default error:', error);
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
      <div className={`max-w-7xl mx-auto min-h-screen ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      }`}>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className={`w-12 h-12 animate-spin mx-auto ${
              theme === 'dark' ? 'text-emerald-400' : 'text-teal-600'
            }`} />
            <p className={`mt-4 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>{t('billing.loadingBillingInformation')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto min-h-screen ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    }`}>
      {/* Enhanced Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative mb-8 ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-emerald-900' 
            : 'bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50'
        } rounded-2xl overflow-hidden`}
      >
        <div className={`absolute inset-0 ${
          theme === 'dark' 
            ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-blue-500/20' 
            : 'bg-gradient-to-r from-emerald-300/20 via-teal-300/10 to-blue-300/20'
        }`} />
        <div className="relative px-8 py-8">
        <div className="flex items-center justify-between">
            <div className="text-center sm:text-left">
              <h1 className={`text-4xl font-bold mb-3 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent'
              }`}>
                {t('billing.title')}
            </h1>
              <p className={`text-lg ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
              {t('billing.subtitle')}
            </p>
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 mt-4">
                <div className={`px-4 py-2 rounded-full ${
                  theme === 'dark' 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-emerald-100 text-emerald-700'
                } border ${
                  theme === 'dark' ? 'border-emerald-400/30' : 'border-emerald-200'
                }`}>
                  💰 Credit Management
          </div>
                <div className={`px-4 py-2 rounded-full ${
                  theme === 'dark' 
                    ? 'bg-blue-500/20 text-blue-300' 
                    : 'bg-blue-100 text-blue-700'
                } border ${
                  theme === 'dark' ? 'border-blue-400/30' : 'border-blue-200'
                }`}>
                  📊 Usage Analytics
                </div>
                <div className={`px-4 py-2 rounded-full ${
                  theme === 'dark' 
                    ? 'bg-purple-500/20 text-purple-300' 
                    : 'bg-purple-100 text-purple-700'
                } border ${
                  theme === 'dark' ? 'border-purple-400/30' : 'border-purple-200'
                }`}>
                  🔐 Secure Billing
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
                className={`inline-flex items-center px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                  theme === 'dark' 
                    ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600' 
                    : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                }`}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                 {t('billing.refreshButton')}
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
                className={`inline-flex items-center px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-all duration-200 ${
                  theme === 'dark' 
                    ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600' 
                    : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                }`}
            >
              <History className="h-4 w-4 mr-2" />
                 {showHistory ? t('billing.hideHistory') : t('billing.showHistory')}
            </button>
            <button 
              onClick={() => handleDownloadInvoice()}
              disabled={downloadingInvoice}
                className={`inline-flex items-center px-4 py-2 rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                    : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600'
                } text-white`}
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
        </div>
      </motion.div>



      {/* Current Plan & Credits Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mb-8">
        {/* Current Plan */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`rounded-xl border p-6 ${
            theme === 'dark' 
              ? 'bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border-emerald-400/30' 
              : 'bg-gradient-to-br from-teal-50 to-blue-50 border-teal-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-emerald-500/20' : 'bg-teal-100'
              }`}>
                <Crown className={`w-6 h-6 ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-teal-600'
                }`} />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                   {t('billing.currentPlanTitle')}
                </h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {subscription?.billing_cycle === 'annual' ? t('billing.annualSubscription') : t('billing.monthlySubscription')}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
              subscription?.status === 'active' 
                ? theme === 'dark'
                  ? 'bg-green-500/20 text-green-300 border-green-400/30'
                  : 'bg-green-100 text-green-700 border-green-200'
                : subscription?.status === 'trialing'
                ? theme === 'dark'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                  : 'bg-blue-100 text-blue-700 border-blue-200'
                : theme === 'dark'
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'
                : 'bg-yellow-100 text-yellow-700 border-yellow-200'
            }`}>
              {subscription?.status === 'active' ? '✅' : subscription?.status === 'trialing' ? '🔄' : '⚠️'} {subscription?.status || 'Unknown'}
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{currentPlan?.display_name}</h4>
              <p className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}> {currentPlan?.credits_monthly?.toLocaleString()} Credits/Month</p>
            </div>
            
            <div className="flex items-center justify-between">
              <span className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-emerald-400' : 'text-teal-600'
              }`}>
                €{subscription?.billing_cycle === 'annual' 
                  ? (currentPlan?.price_annual || 0) / 12 
                  : currentPlan?.price_monthly}
              </span>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>/{t('billing.month')}</span>
            </div>
            
            <div className={`pt-4 border-t space-y-4 ${
              theme === 'dark' ? 'border-emerald-400/30' : 'border-teal-200'
            }`}>
              <div className="flex items-center justify-between text-sm">
                <span className={`${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                   {t('billing.nextBillingDate')}
                </span>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {subscription?.current_period_end ? formatDate(subscription.current_period_end) : 'N/A'}
                </span>
              </div>
              
              {/* Management Buttons */}
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
                  className={`flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                      : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600'
                  } text-white`}
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
                  className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                  }`}
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
        className={`rounded-xl shadow-lg border p-6 mb-8 ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' 
            : 'bg-white border-gray-100'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setPaymentMethodsExpanded(!paymentMethodsExpanded)}
            className="flex items-center space-x-2 group"
          >
            <h3 className={`text-lg font-semibold transition-colors ${
              theme === 'dark' ? 'text-white group-hover:text-emerald-400' : 'text-gray-900 group-hover:text-teal-600'
            }`}>
               {t('billing.paymentMethodsTitle')}
            </h3>
            <ChevronDown 
              className={`w-5 h-5 transition-transform duration-200 ${
                paymentMethodsExpanded ? 'rotate-180' : ''
              } ${
                theme === 'dark' ? 'text-gray-400 group-hover:text-emerald-400' : 'text-gray-500 group-hover:text-teal-600'
              }`}
            />
          </button>
          {paymentMethodsExpanded && (
            <button
              onClick={() => setShowAddPaymentMethod(true)}
              className={`inline-flex items-center px-4 py-2 rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200 ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                  : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600'
              } text-white`}
            >
              <Plus className="w-4 h-4 mr-2" />
               {t('billing.addPaymentMethod')}
            </button>
          )}
        </div>

        <AnimatePresence>
          {paymentMethodsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              {paymentMethods.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className={`w-12 h-12 mx-auto mb-3 ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                  <p className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {t('billing.noPaymentMethods')}
                  </p>
                  <p className={`text-sm mt-1 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
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
                    ? theme === 'dark'
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-teal-500 bg-teal-50'
                    : theme === 'dark'
                      ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-white border-gray-200'
                    }`}>
                      {getCardBrandIcon(method.brand)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                           •••• {method.last_four}
                        </span>
                        {method.is_default && (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            theme === 'dark'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-teal-600 text-white'
                          }`}>
                            ⭐ {t('billing.default')}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        ⏰ {t('billing.expires')} {method.exp_month}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.is_default && (
                      <button
                        onClick={() => handleSetDefaultPaymentMethod(method.id)}
                        className={`text-sm font-medium ${
                          theme === 'dark' 
                            ? 'text-emerald-400 hover:text-emerald-300' 
                            : 'text-teal-600 hover:text-teal-700'
                        }`}
                      >
                        ⭐ {t('billing.setAsDefault')}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemovePaymentMethod(method.id)}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        theme === 'dark' 
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20' 
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                      }`}
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
          )}
        </AnimatePresence>
      </motion.div>

      {/* Billing Type Toggle */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          <div className={`rounded-lg p-1 inline-flex ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
          }`}>
            <button
              onClick={() => setBillingType('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                billingType === 'monthly'
                  ? theme === 'dark'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
               {t('billing.monthly')}
            </button>
            <button
              onClick={() => setBillingType('annual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                billingType === 'annual'
                  ? theme === 'dark'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💰 {t('billing.annualTwoMonthsOffered')}
            </button>
          </div>
        </div>
      </div>

      {/* Regular Credit Packs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="text-center mb-8">
          <h2 className={`text-2xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
             {t('billing.chooseCreditPackTitle')}
          </h2>
          <p className={`${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {t('billing.chooseCreditPackSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages
            .filter(pack => 
              pack.plan_type !== 'enterprise' && 
              ![1000, 3000, 15000, 30000].includes(pack.credits_monthly)
            )
            .sort((a, b) => a.price_monthly - b.price_monthly)
            .map((pack) => {
            const monthlyPrice = billingType === 'annual' ? pack.price_annual / 12 : pack.price_monthly;
            const totalPrice = billingType === 'annual' ? pack.price_annual : pack.price_monthly;
            const savings = billingType === 'annual' ? (pack.price_monthly * 12) - pack.price_annual : 0;
            const isCurrentPack = currentPlan?.credits_monthly === pack.credits_monthly;
          
          return (
            <motion.div
                key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative rounded-xl shadow-lg border-2 transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900' 
                  : 'bg-white'
              } ${
                  pack.credits_monthly === 2000 
                  ? theme === 'dark'
                    ? 'border-emerald-500 shadow-xl scale-105' 
                    : 'border-teal-500 shadow-xl scale-105'
                    : isCurrentPack
                  ? 'border-green-500'
                  : theme === 'dark'
                    ? 'border-gray-600 hover:border-emerald-400'
                  : 'border-gray-200 hover:border-teal-300'
              }`}
            >
                {pack.credits_monthly === 2000 && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className={`px-4 py-1 rounded-full text-xs font-bold text-white ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                      : 'bg-gradient-to-r from-teal-600 to-teal-500'
                  }`}>
                    ⭐ {t('billing.mostPopular')}
                  </span>
                </div>
              )}
              
                {isCurrentPack && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    ✅ {t('billing.current')}
                  </span>
                </div>
              )}

              <div className="p-6">
                <div className="text-center mb-6">
                    <h3 className={`text-xl font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}> {pack.display_name}</h3>
                  <div className="mt-4">
                        <span className={`text-3xl font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                        €{(monthlyPrice || 0).toFixed(0)}
                        </span>
                      <span className={`${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>/{t('billing.month')}</span>
                      
                      {billingType === 'annual' && savings > 0 && (
                        <div className="mt-2">
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          }`}>
                             {t('billing.save')} €{(savings || 0).toFixed(0)}/{t('billing.year')}
                          </p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-green-300' : 'text-green-500'
                          }`}>
                             {t('billing.twoMonthsOffered')}
                          </p>
                      </div>
                    )}
                  </div>
                  
                    <p className={`text-sm mt-2 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {billingType === 'annual' ? (pack.credits_monthly * 12).toLocaleString() : pack.credits_monthly.toLocaleString()} 
                      {billingType === 'annual' ? t('billing.creditsPerYear') : t('billing.creditsPerMonth')}
                    </p>
                </div>

                  <div className="space-y-3 mb-6">
                    <div className={`flex items-center text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <Mail className={`w-4 h-4 mr-2 flex-shrink-0 ${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                      }`} />
                       {billingType === 'annual' ? (pack.credits_monthly * 12).toLocaleString() : pack.credits_monthly.toLocaleString()} {t('billing.emails')}
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <Phone className={`w-4 h-4 mr-2 flex-shrink-0 ${
                        theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                      }`} />
                       {billingType === 'annual' ? (Math.round(pack.credits_monthly / 10) * 12).toLocaleString() : Math.round(pack.credits_monthly / 10).toLocaleString()} {t('billing.phones')}
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <Check className={`w-4 h-4 mr-2 flex-shrink-0 ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-500'
                      }`} />
                       {t('billing.apiAccessIntegrations')}
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <Check className={`w-4 h-4 mr-2 flex-shrink-0 ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-500'
                      }`} />
                       {t('billing.chromeExtension')}
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <Check className={`w-4 h-4 mr-2 flex-shrink-0 ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-500'
                      }`} />
                       {t('billing.emailSupport')}
                    </div>
                  </div>

                <button
                    onClick={() => handlePlanUpgrade(pack.name, billingType)}
                    disabled={isCurrentPack || loading}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      isCurrentPack
                      ? theme === 'dark'
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600 cursor-not-allowed'
                        : pack.credits_monthly === 2000
                      ? theme === 'dark'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                      : theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : isCurrentPack ? (
                      ` ${t('billing.currentPack')}`
                ) : (
                      ` ${t('billing.buyThisPack')}`
                )}
              </button>
                  
                  {billingType === 'annual' && (
                    <p className={`text-xs text-center mt-2 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                       {formatMessage('billing.billedAnnually', { amount: (totalPrice || 0).toFixed(0) })}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
          </div>
        </motion.div>

      {/* Enterprise Section */}
      {packages.filter(pack => pack.plan_type === 'enterprise').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="text-center mb-8">
            <h2 className={`text-2xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              🏢 Enterprise Solutions
            </h2>
            <p className={`${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Custom solutions for large organizations with high-volume needs
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {packages.filter(pack => pack.plan_type === 'enterprise').map((pack) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-xl shadow-xl border-2 p-8 ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-purple-900/20 via-gray-800 to-blue-900/20 border-purple-500/50' 
                    : 'bg-gradient-to-br from-purple-50 via-white to-blue-50 border-purple-300'
                }`}
              >
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className={`px-6 py-2 rounded-full text-sm font-bold text-white ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500'
                      : 'bg-gradient-to-r from-purple-600 to-purple-500'
                  }`}>
                    👑 Enterprise
                  </span>
                </div>

                <div className="text-center mb-8">
                  <h3 className={`text-3xl font-bold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {pack.display_name}
                  </h3>
                  <div className="mb-6">
                    <span className={`text-4xl font-bold ${
                      theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                    }`}>
                      Custom Pricing
                    </span>
                    <p className={`text-lg mt-2 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Tailored to your organization's needs
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h4 className={`text-xl font-semibold mb-4 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      🚀 Premium Features
                    </h4>
                    <div className="space-y-3">
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Unlimited monthly credits (million+ scale)
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Advanced AI-powered enrichment algorithms
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Real-time data verification & scoring
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Custom data enrichment workflows
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Advanced analytics & reporting dashboards
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Custom API rate limits & webhooks
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        White-label & custom branding options
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Bulk export capabilities (CSV, Excel, API)
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className={`text-xl font-semibold mb-4 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      💼 What's Included
                    </h4>
                    <div className="space-y-3">
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Crown className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'
                        }`} />
                        High-volume credit packages (500K+ credits/month)
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Users className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                        }`} />
                        Team management & unlimited users
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Shield className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-green-400' : 'text-green-500'
                        }`} />
                        Advanced security & compliance (SOC2, GDPR)
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Headphones className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'
                        }`} />
                        Priority support & dedicated account manager
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        SSO/SAML integration & advanced user permissions
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Custom integrations (Salesforce, HubSpot, etc.)
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        99.9% SLA uptime guarantee
                      </div>
                      <div className={`flex items-center text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                        }`} />
                        Advanced data retention & compliance controls
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => window.open('mailto:sales@captely.com?subject=Enterprise Plan Inquiry&body=Hi, I am interested in learning more about Captely Enterprise plans for my organization.', '_blank')}
                    className={`inline-flex items-center px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-xl hover:shadow-2xl'
                        : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-xl hover:shadow-2xl'
                    }`}
                  >
                    <Mail className="w-6 h-6 mr-3" />
                    Contact Sales Team
                  </button>
                  <p className={`text-sm mt-3 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Get a custom quote tailored to your needs
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Credit Consumption Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-6 mb-8 ${
          theme === 'dark' 
            ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-400/30' 
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
        }`}
      >
        <div className="flex items-start space-x-4">
          <Info className={`w-6 h-6 flex-shrink-0 mt-1 ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`} />
          <div className="flex-1">
            <h3 className={`text-lg font-semibold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
               {t('billing.creditConsumptionLogicTitle')}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className={`text-sm flex items-center ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  <Zap className={`w-4 h-4 mr-2 ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                  }`} />
                  <strong> 1 email found = 1 credit</strong>
                </p>
                <p className={`text-sm flex items-center ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  <Zap className={`w-4 h-4 mr-2 ${
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
                  }`} />
                  <strong> 1 phone found = 10 credits</strong>
                </p>
                <p className={`text-sm flex items-center ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  <CheckCircle className={`w-4 h-4 mr-2 ${
                    theme === 'dark' ? 'text-green-400' : 'text-green-500'
                  }`} />
                  <strong> No result = No charge</strong>
                </p>
              </div>
            </div>
          </div>
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

      {/* Add Payment Method Modal with Stripe Elements */}
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
              className="max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <StripePaymentMethodSetup
                onSuccess={handlePaymentMethodSuccess}
                onCancel={() => setShowAddPaymentMethod(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BillingPage;