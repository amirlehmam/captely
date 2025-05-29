import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, Download, Clock, AlertTriangle, 
  Package, TrendingUp, Zap, Shield, Users, 
  Globe, CheckCircle, XCircle, Plus
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

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [packagesData, subscription, creditPkgs, history, credits] = await Promise.all([
        apiService.getPackages(),
        apiService.getCurrentSubscription().catch(() => null),
        apiService.getCreditPackages(),
        apiService.getBillingHistory(),
        apiService.getCreditBalance('user') // Will be replaced with actual user ID
      ]);

      setPackages(Array.isArray(packagesData) ? packagesData : []);
      setCurrentSubscription(subscription);
      setCreditPackages(Array.isArray(creditPkgs) ? creditPkgs : []);
      setBillingHistory((history as any)?.transactions || []);
      setCreditBalance(credits);
    } catch (error) {
      toast.error('Failed to load billing information');
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Billing & Subscription
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your subscription, credits, and billing information
        </p>
      </motion.div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="flex space-x-8">
          {['overview', 'plans', 'credits', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm capitalize
                ${activeTab === tab
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
                transition-all duration-200
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
          className="space-y-6"
        >
          {/* Credit Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card gradient>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Credit Balance</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {creditBalance?.balance?.toLocaleString() || '0'}
                  </p>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full"
                        style={{ width: `${(creditBalance?.balance || 0) / (creditBalance?.limit_monthly || 1) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {Math.round((creditBalance?.balance || 0) / (creditBalance?.limit_monthly || 1) * 100)}% remaining
                    </p>
                  </div>
                </div>
                <Zap className="w-12 h-12 text-teal-500" />
              </div>
            </Card>

            <Card gradient>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current Plan</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {currentSubscription?.package?.display_name || 'Free'}
                  </p>
                  <Badge variant="success" className="mt-2">
                    {currentSubscription?.status || 'Active'}
                  </Badge>
                </div>
                <Package className="w-12 h-12 text-blue-500" />
              </div>
            </Card>

            <Card gradient>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Usage Today</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {creditBalance?.used_today || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Daily limit: {creditBalance?.limit_daily?.toLocaleString() || 'Unlimited'}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-purple-500" />
              </div>
            </Card>
          </div>

          {/* Usage Warning */}
          {creditBalance?.balance < 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6"
            >
              <div className="flex">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300">
                    Low Credit Balance
                  </h3>
                  <p className="mt-2 text-yellow-800 dark:text-yellow-400">
                    You have {creditBalance?.balance || 0} credits remaining. Consider upgrading your plan or purchasing additional credits to avoid interruption.
                  </p>
                  <div className="mt-4 space-x-3">
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Upgrade Plan
                    </button>
                    <button
                      onClick={() => setActiveTab('credits')}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-yellow-900 dark:text-yellow-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-yellow-300 dark:border-yellow-700"
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
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Monthly Usage Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Enrichments</span>
                  <span className="font-medium text-gray-900 dark:text-white">2,450</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Verifications</span>
                  <span className="font-medium text-gray-900 dark:text-white">1,200</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Exports</span>
                  <span className="font-medium text-gray-900 dark:text-white">15</span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Provider Usage
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">IcyPeas</span>
                    <span className="text-sm font-medium">40%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-teal-600 h-2 rounded-full" style={{ width: '40%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Dropcontact</span>
                    <span className="text-sm font-medium">30%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Hunter</span>
                    <span className="text-sm font-medium">30%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>
              </div>
            </Card>
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
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 inline-flex">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`
                  px-6 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${selectedBillingCycle === 'monthly'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                  }
                `}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedBillingCycle('yearly')}
                className={`
                  px-6 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${selectedBillingCycle === 'yearly'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                  }
                `}
              >
                Yearly (Save 20%)
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
          className="space-y-6"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Purchase Additional Credits
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Need more credits? Purchase one-time credit packages
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {creditPackages.map((pkg) => (
              <Card key={pkg.id} hover>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {pkg.name}
                  </h3>
                  <p className="text-3xl font-bold text-teal-600 mb-1">
                    {pkg.credits.toLocaleString()}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">credits</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                    ${pkg.price}
                  </p>
                  <button
                    onClick={() => handleCreditPurchase(pkg.id)}
                    className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Purchase
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'history' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {billingHistory.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {transaction.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        ${transaction.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge 
                          variant={transaction.status === 'succeeded' ? 'success' : 'danger'}
                        >
                          {transaction.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default BillingPage;