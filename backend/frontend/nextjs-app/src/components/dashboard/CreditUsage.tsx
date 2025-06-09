import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, TrendingUp, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { useCreditContext } from '../../contexts/CreditContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

const CreditUsage: React.FC = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { creditData, loading, error, refreshCredits } = useCreditContext();
  const navigate = useNavigate();

  // Calculate values with safe defaults to prevent flashing
  const usagePercent = creditData?.limit_monthly && creditData.limit_monthly > 0 
    ? Math.round((creditData.used_this_month / creditData.limit_monthly) * 100) 
    : 0;

  const usedCredits = creditData?.used_this_month || 0;

  // Calculate projections
  const avgDailyUsage = creditData?.used_this_month ? creditData.used_this_month / 30 : 0;
  const daysRemaining = avgDailyUsage > 0 && creditData?.balance !== undefined
    ? Math.floor(creditData.balance / avgDailyUsage) 
    : null;

  // Always render container - never return early to avoid flashing
  return (
    <div className={`overflow-hidden shadow-lg rounded-xl border transition-all duration-300 hover:shadow-xl ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
    }`}>
      <div className={`px-6 py-5 flex justify-between items-center ${
        isDark ? 'bg-gradient-to-r from-gray-800 to-gray-750' : 'bg-gradient-to-r from-primary-50 to-secondary-50'
      }`}>
        <div>
          <h3 className={`text-lg leading-6 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('common.credit_usage')}
          </h3>
          <p className={`mt-1 max-w-2xl text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {creditData?.subscription?.package_name || 'Loading...'} Plan
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => navigate('/billing')}
            className={`inline-flex items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
              isDark 
                ? 'border-primary-600 text-primary-300 bg-primary-900/30 hover:bg-primary-900/50' 
                : 'border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100'
            }`}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {t('common.buy_credits')}
          </button>
        </div>
      </div>
      
      <div className={`border-t px-6 py-6 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
        {/* Conditional content but stable structure */}
        {loading && !creditData ? (
          // Initial loading state
          <div className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className={`h-40 w-40 rounded-full animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              <div className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              <div className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
            </div>
          </div>
        ) : error || !creditData ? (
          // Error state
          <div className={`border rounded-xl p-4 ${
            isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className={isDark ? 'text-red-400' : 'text-red-700'}>
                  {error || 'Failed to load credit info'}
                </span>
              </div>
              <button 
                onClick={refreshCredits}
                className={`flex items-center transition-colors ${
                  isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'
                }`}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </button>
            </div>
          </div>
        ) : (
          // Main credit usage content - stable structure
          <>
            {/* Credit circle progress */}
            <div className="flex justify-center mb-8">
              <div className="relative h-40 w-40 flex items-center justify-center">
                {/* SVG circle progress */}
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle 
                    className={isDark ? 'text-gray-600' : 'text-gray-200'} 
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
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {usagePercent}%
                  </div>
                  <div className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('common.used')}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Credit stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className={`text-center rounded-xl p-4 border ${
                isDark 
                  ? 'bg-gradient-to-br from-gray-700 to-gray-600 border-gray-600' 
                  : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
              }`}>
                <div className={`text-sm font-medium uppercase tracking-wide ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {t('common.total')}
                </div>
                <div className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {creditData?.limit_monthly?.toLocaleString() || '0'}
                </div>
              </div>
              <div className={`text-center rounded-xl p-4 border ${
                isDark 
                  ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/30 border-blue-700/50' 
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
              }`}>
                <div className={`text-sm font-medium uppercase tracking-wide ${
                  isDark ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {t('common.used')}
                </div>
                <div className={`text-xl font-bold mt-1 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                  {usedCredits.toLocaleString()}
                </div>
              </div>
              <div className={`text-center rounded-xl p-4 border ${
                isDark 
                  ? 'bg-gradient-to-br from-green-900/30 to-green-800/30 border-green-700/50' 
                  : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
              }`}>
                <div className={`text-sm font-medium uppercase tracking-wide ${
                  isDark ? 'text-green-400' : 'text-green-600'
                }`}>
                  {t('common.left')}
                </div>
                <div className={`text-xl font-bold mt-1 ${isDark ? 'text-green-300' : 'text-green-900'}`}>
                  {creditData?.balance?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
            
            {/* Usage projection */}
            {daysRemaining !== null && daysRemaining < 30 && (
              <div className={`border rounded-xl p-4 mb-6 ${
                isDark 
                  ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-700/50' 
                  : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
              }`}>
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className={`text-sm font-semibold ${isDark ? 'text-yellow-400' : 'text-yellow-800'}`}>
                      {t('common.usage_alert')}
                    </h4>
                    <p className={`mt-1 text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                      At your current rate, you'll run out of credits in approximately <strong>{daysRemaining} days</strong>. 
                      Consider upgrading your plan or purchasing additional credits.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Performance stats */}
            <div className={`border-t pt-6 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <h4 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('common.performance_stats')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {creditData?.statistics?.email_hit_rate?.toFixed(1) || '0.0'}%
                  </div>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('common.email_hit_rate')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {creditData?.statistics?.success_rate?.toFixed(1) || '0.0'}%
                  </div>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('common.success_rate')}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreditUsage;