import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Calendar, TrendingUp, Clock, Star, Check, X, 
  AlertCircle, Info, ChevronRight, Download, RefreshCw, Zap,
  Target, BarChart3, Users, Shield, Headphones, Globe, Crown,
  ArrowRight, CheckCircle, XCircle, Timer, History, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';

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

interface Plan {
  id: string;
  name: string;
  type: 'starter' | 'pro' | 'enterprise';
  credits_monthly: number;
  price_monthly: number;
  price_annual: number;
  features: string[];
  popular?: boolean;
  current?: boolean;
}

interface EnrichmentHistory {
  id: string;
  type: 'email' | 'phone';
  status: 'success' | 'failed' | 'cached';
  credits_used: number;
  source: 'internal' | 'apollo' | 'hunter' | 'clearbit';
  created_at: string;
  contact_name?: string;
  result?: string;
}

const BillingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // State
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [creditUsage, setCreditUsage] = useState<CreditUsage | null>(null);
  const [enrichmentHistory, setEnrichmentHistory] = useState<EnrichmentHistory[]>([]);
  const [proPlans] = useState<Plan[]>([
    { id: 'pro-1k', name: 'Pro 1K', type: 'pro', credits_monthly: 1000, price_monthly: 38, price_annual: 364.8, features: [] },
    { id: 'pro-2k', name: 'Pro 2K', type: 'pro', credits_monthly: 2000, price_monthly: 76, price_annual: 729.6, features: [] },
    { id: 'pro-3k', name: 'Pro 3K', type: 'pro', credits_monthly: 3000, price_monthly: 113, price_annual: 1084.8, features: [] },
    { id: 'pro-5k', name: 'Pro 5K', type: 'pro', credits_monthly: 5000, price_monthly: 186, price_annual: 1785.6, features: [], popular: true },
    { id: 'pro-10k', name: 'Pro 10K', type: 'pro', credits_monthly: 10000, price_monthly: 366, price_annual: 3513.6, features: [] },
    { id: 'pro-15k', name: 'Pro 15K', type: 'pro', credits_monthly: 15000, price_monthly: 542, price_annual: 5203.2, features: [] },
    { id: 'pro-20k', name: 'Pro 20K', type: 'pro', credits_monthly: 20000, price_monthly: 701, price_annual: 6729.6, features: [] },
    { id: 'pro-30k', name: 'Pro 30K', type: 'pro', credits_monthly: 30000, price_monthly: 1018, price_annual: 9772.8, features: [] },
    { id: 'pro-50k', name: 'Pro 50K', type: 'pro', credits_monthly: 50000, price_monthly: 1683, price_annual: 16156.8, features: [] }
  ]);

  const mainPlans: Plan[] = [
    {
      id: 'starter',
      name: 'Starter',
      type: 'starter',
      credits_monthly: 500,
      price_monthly: 19,
      price_annual: 182.4,
      features: [
        'Import CSV files',
        'API enrichment',
        'Chrome extension',
        'Shared database access',
        'Standard support',
        'All platform features'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      type: 'pro',
      credits_monthly: 5000,
      price_monthly: 186,
      price_annual: 1785.6,
      popular: true,
      features: [
        'All Starter features',
        'Modular credit volumes',
        'Priority support',
        'Advanced analytics',
        'Bulk operations',
        'Custom integrations'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      type: 'enterprise',
      credits_monthly: 0,
      price_monthly: 0,
      price_annual: 0,
      features: [
        'All Pro features',
        'Custom credit volumes',
        'SSO integration',
        'Enhanced security',
        'Dedicated support',
        'Custom API endpoints',
        'White-label options'
      ]
    }
  ];

  useEffect(() => {
    fetchBillingData();
    fetchCreditUsage();
    fetchEnrichmentHistory();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      // Mock current plan - replace with actual API call
      setCurrentPlan({
        id: 'pro-5k',
        name: 'Pro 5K',
        type: 'pro',
        credits_monthly: 5000,
        price_monthly: 186,
        price_annual: 1785.6,
        features: [],
        current: true
      });
    } catch (error) {
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCreditUsage = async () => {
    try {
      // Mock credit usage - replace with actual API call
      setCreditUsage({
        total_credits: 15000,
        used_credits: 8240,
        remaining_credits: 6760,
        expired_credits: 120,
        credits_by_month: [
          { month: 'Jan 2024', allocated: 5000, remaining: 1200, expires_at: '2024-04-30' },
          { month: 'Feb 2024', allocated: 5000, remaining: 2560, expires_at: '2024-05-31' },
          { month: 'Mar 2024', allocated: 5000, remaining: 3000, expires_at: '2024-06-30' }
        ]
      });
    } catch (error) {
      toast.error('Failed to load credit usage');
    }
  };

  const fetchEnrichmentHistory = async () => {
    try {
      // Mock enrichment history - replace with actual API call
      setEnrichmentHistory([
        {
          id: '1',
          type: 'email',
          status: 'success',
          credits_used: 1,
          source: 'apollo',
          created_at: '2024-03-15T10:30:00Z',
          contact_name: 'John Smith',
          result: 'john.smith@techcorp.com'
        },
        {
          id: '2',
          type: 'phone',
          status: 'success',
          credits_used: 10,
          source: 'hunter',
          created_at: '2024-03-15T10:25:00Z',
          contact_name: 'Sarah Johnson',
          result: '+1-555-0123'
        },
        {
          id: '3',
          type: 'email',
          status: 'cached',
          credits_used: 1,
          source: 'internal',
          created_at: '2024-03-15T10:20:00Z',
          contact_name: 'Mike Chen',
          result: 'mike@techstart.io'
        },
        {
          id: '4',
          type: 'phone',
          status: 'failed',
          credits_used: 0,
          source: 'clearbit',
          created_at: '2024-03-15T10:15:00Z',
          contact_name: 'Alice Brown'
        }
      ]);
    } catch (error) {
      toast.error('Failed to load enrichment history');
    }
  };

  const handlePlanUpgrade = async (planId: string, billing: 'monthly' | 'annual') => {
    try {
      setLoading(true);
      // API call to initiate upgrade/Stripe checkout
      toast.success('Redirecting to checkout...');
      // Redirect to Stripe checkout or open modal
    } catch (error) {
      toast.error('Failed to initiate upgrade');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cached': return <Eye className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'internal': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'apollo': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'hunter': return 'bg-green-100 text-green-700 border-green-200';
      case 'clearbit': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const calculateAnnualSavings = (monthlyPrice: number) => {
    const annualPrice = monthlyPrice * 12 * 0.8;
    const savings = (monthlyPrice * 12) - annualPrice;
    return { annualPrice, savings };
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto bg-white min-h-screen">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading billing information...</p>
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
              Billing & Credits
            </h1>
            <p className="text-gray-600 mt-2">
              Manage your subscription and monitor credit usage
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
            >
              <History className="h-4 w-4 mr-2" />
              {showHistory ? 'Hide' : 'Show'} History
            </button>
            <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl text-sm font-medium transition-all duration-200">
              <Download className="h-4 w-4 mr-2" />
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
                <p className="text-sm text-gray-600">Active subscription</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium border border-green-200">
              Active
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-2xl font-bold text-gray-900">{currentPlan?.name}</h4>
              <p className="text-gray-600">{currentPlan?.credits_monthly?.toLocaleString()} credits/month</p>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-teal-600">€{currentPlan?.price_monthly}</span>
              <span className="text-sm text-gray-600">/month</span>
            </div>
            
            <div className="pt-4 border-t border-teal-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Next billing date</span>
                <span className="font-medium text-gray-900">April 15, 2024</span>
              </div>
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
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200">
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

      {/* Credit Expiration Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Credit Expiration Schedule</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {creditUsage?.credits_by_month.map((month, index) => (
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
                  <span className="font-medium text-red-600">{new Date(month.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          const isCurrentPlan = currentPlan?.type === plan.type;
          
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
                  : 'border-gray-200 hover:border-teal-300 hover:shadow-xl'
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
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-4">
                    {plan.type === 'enterprise' ? (
                      <div>
                        <span className="text-3xl font-bold text-gray-900">Custom</span>
                        <p className="text-sm text-gray-600 mt-1">Contact us for pricing</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-gray-900">
                          €{billingType === 'annual' ? annualPrice.toFixed(0) : plan.price_monthly}
                        </span>
                        <span className="text-gray-600">
                          /{billingType === 'annual' ? 'year' : 'month'}
                        </span>
                        {billingType === 'annual' && (
                          <p className="text-sm text-green-600 mt-1">
                            Save €{savings.toFixed(0)}/year
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {plan.type !== 'enterprise' && (
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
                  disabled={isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {isCurrentPlan ? 'Current Plan' : plan.type === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pro Plans Expansion */}
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
                    : 'border-gray-200 hover:border-teal-300'
                }`}
                onClick={() => setSelectedPlan(plan.id)}
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
                    €{billingType === 'annual' ? annualPrice.toFixed(0) : plan.price_monthly}
                  </p>
                  <p className="text-xs text-gray-600">
                    /{billingType === 'annual' ? 'year' : 'month'}
                  </p>
                  {billingType === 'annual' && (
                    <p className="text-xs text-green-600 mt-1">
                      Save €{savings.toFixed(0)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {selectedPlan && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => handlePlanUpgrade(selectedPlan, billingType)}
              className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl font-medium transition-all duration-200"
            >
              Upgrade to Selected Plan
            </button>
          </div>
        )}
      </motion.div>

      {/* Enrichment History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.type === 'email' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {item.type}
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
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.result || '-'}
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
    </div>
  );
};

export default BillingPage;