import React from 'react';
import { CreditCard, TrendingUp, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { useCreditContext } from '../../contexts/CreditContext';
import { useLanguage } from '../../contexts/LanguageContext';

const CreditUsage: React.FC = () => {
  const { t, formatMessage } = useLanguage();
  const { creditData, loading, error, refreshCredits } = useCreditContext();

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5 flex justify-between items-center">
          <div>
            <div className="h-6 bg-gray-100 rounded-lg animate-pulse"></div>
            <div className="h-4 bg-gray-100 rounded-lg mt-2 w-32 animate-pulse"></div>
          </div>
          <div className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse"></div>
        </div>
        <div className="border-t border-gray-100 px-6 py-6">
          <div className="flex justify-center mb-6">
            <Loader className="h-12 w-12 animate-spin text-primary-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !creditData) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">
                  {error || t('failed_to_load_credit_info')}
                </span>
              </div>
              <button 
                onClick={refreshCredits}
                className="flex items-center text-red-600 hover:text-red-800 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate usage percentage
  const usagePercent = creditData.limit_monthly > 0 
    ? Math.round(((creditData.limit_monthly - creditData.balance) / creditData.limit_monthly) * 100) 
    : 0;

  // Calculate used credits
  const usedCredits = creditData.limit_monthly - creditData.balance;

  // Calculate projections based on current usage
  const avgDailyUsage = creditData.used_this_month / 30;
  const daysRemaining = avgDailyUsage > 0 
    ? Math.floor(creditData.balance / avgDailyUsage) 
    : null;

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-primary-50 to-secondary-50">
        <div>
          <h3 className="text-lg leading-6 font-semibold text-gray-900">
            {t('credit_usage')}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t('plan', creditData.subscription.package_name)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={refreshCredits}
            className="inline-flex items-center px-3 py-1 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-600 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('refresh')}
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-primary-200 shadow-sm text-sm font-medium rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
            <CreditCard className="h-4 w-4 mr-2" />
            {t('buy_credits')}
          </button>
        </div>
      </div>
      
      <div className="border-t border-gray-100 px-6 py-6">
        {/* Credit circle progress */}
        <div className="flex justify-center mb-8">
          <div className="relative h-40 w-40 flex items-center justify-center">
            {/* SVG circle progress */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle 
                className="text-gray-200" 
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
                r="45"
                cx="50"
                cy="50"
              />
              {/* Foreground circle */}
              <circle 
                className={`transition-all duration-1000 ease-in-out ${
                  usagePercent > 80 ? 'text-red-500' : 
                  usagePercent > 60 ? 'text-yellow-500' : 'text-green-500'
                }`}
                strokeWidth="6"
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="45"
                cx="50"
                cy="50"
                strokeDasharray="282.7"
                strokeDashoffset={`${282.7 * (1 - usagePercent / 100)}`}
                transform="rotate(-90 50 50)"
                style={{
                  filter: 'drop-shadow(0 4px 6px rgba(15, 118, 110, 0.2))'
                }}
              />
            </svg>
            
            {/* Center text */}
            <div className="relative text-center">
              <div className="text-3xl font-bold text-gray-900">
                {Math.max(0, 100 - usagePercent)}%
              </div>
              <div className="text-sm text-gray-600 font-medium">
                {t('remaining')}
              </div>
            </div>
          </div>
        </div>
        
        {/* Credit stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">{t('total')}</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{creditData.limit_monthly.toLocaleString()}</div>
          </div>
          <div className="text-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="text-sm font-medium text-blue-600 uppercase tracking-wide">{t('used')}</div>
            <div className="text-xl font-bold text-blue-900 mt-1">{Math.max(0, usedCredits).toLocaleString()}</div>
          </div>
          <div className="text-center bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="text-sm font-medium text-green-600 uppercase tracking-wide">{t('left')}</div>
            <div className="text-xl font-bold text-green-900 mt-1">{creditData.balance.toLocaleString()}</div>
          </div>
        </div>
        
        {/* Usage projection */}
        {daysRemaining !== null && daysRemaining < 30 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-800">
                  {t('usage_alert')}
                </h4>
                <p className="mt-1 text-sm text-yellow-700">
                  {formatMessage('usage_alert_message', { days: daysRemaining })}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Performance stats */}
        <div className="border-t border-gray-100 pt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            {t('performance_stats')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{creditData.statistics.email_hit_rate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">{t('email_hit_rate')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{creditData.statistics.success_rate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">{t('success_rate')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditUsage;