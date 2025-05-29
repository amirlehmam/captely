import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, Download, Clock, AlertTriangle, 
  Package, TrendingUp, Zap, Shield, Users, 
  Globe, CheckCircle, XCircle, Plus, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PricingCard from '../components/ui/PricingCard';

const BillingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'credits' | 'history'>('overview');
  const [packages, setPackages] = useState<any[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [creditPackages, setCreditPackages] = useState<any[]>([]);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [creditBalance, setCreditBalance] = useState<any>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Function to get user ID from JWT token
  const getUserIdFromToken = () => {
    try {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      if (!token) return null;
      
      // Decode JWT token to get user ID
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decoded = JSON.parse(jsonPayload);
      return decoded.sub || decoded.user_id || decoded.id;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Get the actual user ID from the JWT token
      const userId = getUserIdFromToken();
      
      const [packagesData, subscription, creditPkgs, history, credits] = await Promise.all([
        apiService.getPackages(),
        apiService.getCurrentSubscription().catch(() => null),
        apiService.getCreditPackages(),
        apiService.getBillingHistory().catch(() => ({ transactions: [] })), // Handle missing table gracefully
        userId ? apiService.getCreditBalance(userId).catch(() => ({ balance: 0, used_today: 0 })) : Promise.resolve({ balance: 0, used_today: 0 })
      ]);

      setPackages(Array.isArray(packagesData) ? packagesData : []);
      setCurrentSubscription(subscription);
      setCreditPackages(Array.isArray(creditPkgs) ? creditPkgs : []);
      setBillingHistory((history as any)?.transactions || []);
      setCreditBalance(credits);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Some billing information could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionChange = async (packageId: string) => {
    try {
      setLoading(true);
      await apiService.createSubscription(packageId, selectedBillingCycle);
      toast.success('Subscription updated successfully!');
      await fetchBillingData();
    } catch (error) {
      toast.error('Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCreditPurchase = async (packageId: string) => {
    try {
      // This would integrate with Stripe payment
      toast('Payment integration coming soon!');
    } catch (error) {
      toast.error('Failed to process payment');
    }
  };

  const packageFeatures: Record<string, string[]> = {
    free: [
      '100 credits/month',
      'IcyPeas enrichment only',
      '50 daily enrichment limit',
      '1 import per month',
      'Basic email support'
    ],
    starter: [
      '1,000 credits/month',
      'IcyPeas, Dropcontact, Hunter',
      '500 daily enrichment limit',
      '10 imports per month',
      'Priority email support',
      'CSV & Excel exports'
    ],
    professional: [
      '5,000 credits/month with rollover',
      'All enrichment providers',
      '2,000 daily enrichment limit',
      'Unlimited imports',
      'Team collaboration (5 members)',
      'Priority support',
      'API access',
      'Custom integrations'
    ],
    enterprise: [
      '20,000 credits/month with rollover',
      'All providers with higher limits',
      '10,000 daily enrichment limit',
      'Unlimited everything',
      'Unlimited team members',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom features'
    ]
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl border border-primary-200">
            <CreditCard className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Billing & Subscription
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your subscription, credits, and billing information
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8">
          {['overview', 'plans', 'credits', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`
                py-3 px-1 border-b-2 font-semibold text-sm capitalize transition-all duration-200
                ${activeTab === tab
                  ? 'border-primary-500 text-primary-600 bg-primary-50 rounded-t-lg px-4'
                  : 'border-transparent text-gray-600 hover:text-primary-600 hover:border-primary-300'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          {/* Credit Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-6 border border-teal-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide">Credit Balance</p>
                  <p className="text-3xl font-bold text-teal-900 mt-2">
                    {creditBalance?.balance?.toLocaleString() || '0'}
                  </p>
                  <div className="mt-4">
                    <div className="w-full bg-teal-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-teal-500 to-teal-400 h-3 rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${(creditBalance?.balance || 0) / (creditBalance?.limit_monthly || 1) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs font-medium text-teal-600 mt-2">
                      {Math.round((creditBalance?.balance || 0) / (creditBalance?.limit_monthly || 1) * 100)}% remaining
                    </p>
                  </div>
                </div>
                <Zap className="w-12 h-12 text-teal-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Current Plan</p>
                  <p className="text-2xl font-bold text-blue-900 mt-2">
                    {currentSubscription?.package?.display_name || 'Free'}
                  </p>
                  <div className="mt-3">
                    <div className="px-3 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-200">
                      {currentSubscription?.status || 'Active'}
                    </div>
                  </div>
                </div>
                <Package className="w-12 h-12 text-blue-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Usage Today</p>
                  <p className="text-2xl font-bold text-purple-900 mt-2">
                    {creditBalance?.used_today || 0}
                  </p>
                  <p className="text-xs font-medium text-purple-600 mt-2">
                    Daily limit: {creditBalance?.limit_daily?.toLocaleString() || 'Unlimited'}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Usage Warning */}
          {creditBalance?.balance < 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6 shadow-lg"
            >
              <div className="flex">
                <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-yellow-900">
                    Low Credit Balance
                  </h3>
                  <p className="mt-2 text-yellow-800 font-medium">
                    You have {creditBalance?.balance || 0} credits remaining. Consider upgrading your plan or purchasing additional credits to avoid interruption.
                  </p>
                  <div className="mt-4 space-x-3">
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      Upgrade Plan
                    </button>
                    <button
                      onClick={() => setActiveTab('credits')}
                      className="bg-white hover:bg-gray-50 text-yellow-800 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 border border-yellow-300 shadow-md hover:shadow-lg"
                    >
                      Buy Credits
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Monthly Usage Breakdown
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg">
                  <span className="font-medium text-gray-700">Enrichments</span>
                  <span className="font-bold text-gray-900 text-lg">2,450</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg">
                  <span className="font-medium text-gray-700">Verifications</span>
                  <span className="font-bold text-gray-900 text-lg">1,200</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg">
                  <span className="font-medium text-gray-700">Exports</span>
                  <span className="font-bold text-gray-900 text-lg">15</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Provider Usage
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">IcyPeas</span>
                    <span className="text-sm font-bold text-teal-600">40%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-teal-500 to-teal-400 h-3 rounded-full shadow-sm" style={{ width: '40%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Dropcontact</span>
                    <span className="text-sm font-bold text-blue-600">30%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full shadow-sm" style={{ width: '30%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Hunter</span>
                    <span className="text-sm font-bold text-purple-600">30%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-400 h-3 rounded-full shadow-sm" style={{ width: '30%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'plans' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Billing Cycle Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-100 rounded-xl p-1 inline-flex shadow-inner">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`
                  px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200
                  ${selectedBillingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedBillingCycle('yearly')}
                className={`
                  px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 relative
                  ${selectedBillingCycle === 'yearly'
                    ? 'bg-white text-gray-900 shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                Yearly (Save 20%)
                <Star className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg) => (
              <PricingCard
                key={pkg.id}
                name={pkg.display_name}
                price={selectedBillingCycle === 'monthly' ? pkg.price_monthly : pkg.price_yearly}
                period={selectedBillingCycle}
                credits={pkg.credits_monthly}
                features={packageFeatures[pkg.name || ''] || []}
                isPopular={pkg.name === 'professional'}
                isCurrent={currentSubscription?.package_id === pkg.id}
                onSelect={() => handleSubscriptionChange(pkg.id)}
                loading={loading}
              />
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'credits' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Purchase Additional Credits
            </h2>
            <p className="text-gray-600">
              Need more credits? Purchase one-time credit packages
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {creditPackages.map((pkg) => (
              <div key={pkg.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {pkg.name}
                  </h3>
                  <p className="text-3xl font-bold text-primary-600 mb-2">
                    {pkg.credits.toLocaleString()}
                  </p>
                  <p className="text-gray-600 mb-4 font-medium">credits</p>
                  <p className="text-2xl font-bold text-gray-900 mb-6">
                    ${pkg.price}
                  </p>
                  <button
                    onClick={() => handleCreditPurchase(pkg.id)}
                    className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Purchase
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'history' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Billing History</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Invoice
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {billingHistory.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200">
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transaction.description}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-gray-900">
                          ${transaction.amount}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            transaction.status === 'succeeded' 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {transaction.status}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm">
                          <button className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200">
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BillingPage;