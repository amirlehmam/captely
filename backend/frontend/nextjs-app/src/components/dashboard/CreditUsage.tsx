import React from 'react';
import { CreditCard, TrendingUp, AlertCircle, Loader } from 'lucide-react';
import { useCreditBalance, useCreditAnalytics, useUserProfile } from '../../hooks/useApi';

const CreditUsage: React.FC = () => {
  const { profile } = useUserProfile();
  const { balance, loading: balanceLoading, error: balanceError } = useCreditBalance(profile?.id || '');
  const { analytics, loading: analyticsLoading } = useCreditAnalytics(profile?.id || '', '30d');

  const loading = balanceLoading || analyticsLoading;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2 w-32 animate-pulse"></div>
          </div>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
          <div className="flex justify-center mb-6">
            <Loader className="h-12 w-12 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (balanceError) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-300">Failed to load credit info: {balanceError}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  // Calculate usage percentage
  const usagePercent = (balance.total_credits || 0) > 0 
    ? Math.round(((balance.remaining_credits || 0) / (balance.total_credits || 1)) * 100) 
    : 0;

  // Format daily usage data from analytics
  const dailyUsage = analytics?.daily_usage?.slice(-10) || [];

  // Calculate projections
  const avgDailyUsage = analytics?.period_stats?.total_spent 
    ? analytics.period_stats.total_spent / 30 
    : 0;
  const daysRemaining = avgDailyUsage > 0 
    ? Math.floor((balance.remaining_credits || 0) / avgDailyUsage) 
    : null;
  const estimatedMonthlyUsage = analytics?.predictions?.estimated_monthly_usage || 0;
  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Credit Usage
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Current billing period
          </p>
        </div>
        <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          <CreditCard className="h-3.5 w-3.5 mr-1" />
          Buy Credits
        </button>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
        {/* Credit circle progress */}
        <div className="flex justify-center mb-6">
          <div className="relative h-36 w-36 flex items-center justify-center">
            {/* SVG circle progress */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle 
                className="text-gray-200 dark:text-gray-700" 
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="45"
                cx="50"
                cy="50"
              />
              {/* Foreground circle */}
              <circle 
                className="text-teal-500 dark:text-teal-400 transition-all duration-1000 ease-in-out" 
                strokeWidth="8"
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="45"
                cx="50"
                cy="50"
                // strokeDasharray is the circumference of the circle
                strokeDasharray="282.7"
                // strokeDashoffset is how much of the circle is "empty"
                strokeDashoffset={`${282.7 * (1 - usagePercent / 100)}`}
                // This rotates the circle so the progress starts from the top
                transform="rotate(-90 50 50)"
              />
            </svg>
            
            {/* Center text */}
            <div className="relative text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {usagePercent}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Remaining
              </div>
            </div>
          </div>
        </div>
        
        {/* Credit stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">{(balance.total_credits || 0).toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">Used</div>
            <div className="text-lg font-medium text-blue-600 dark:text-blue-400">{(balance.used_credits || 0).toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">Left</div>
            <div className="text-lg font-medium text-green-600 dark:text-green-400">{(balance.remaining_credits || 0).toLocaleString()}</div>
          </div>
        </div>
        
        {/* Usage projection */}
        {daysRemaining !== null && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Projected Usage
                </h4>
                <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                  At your current rate, you'll use approximately <strong>{(estimatedMonthlyUsage || 0).toLocaleString()}</strong> credits by the end of this billing cycle ({daysRemaining} days remaining).
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Usage history graph (simplified) */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Daily Usage
          </h4>
          <div className="h-24 flex items-end space-x-1">
            {dailyUsage.map((day: any, index: number) => {
              // Calculate bar height based on max value in history
              const maxCredits = Math.max(...dailyUsage.map((d: any) => d.credits_used || 0));
              const heightPercent = maxCredits > 0 ? (day.credits_used / maxCredits) * 100 : 0;
              
              return (
                <div key={day.date || index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-teal-500 dark:bg-teal-600 rounded-t transition-all hover:bg-teal-600 dark:hover:bg-teal-500"
                    style={{ height: `${heightPercent}%` }}
                  ></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">
                    {day.date ? new Date(day.date).getDate() : index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditUsage;