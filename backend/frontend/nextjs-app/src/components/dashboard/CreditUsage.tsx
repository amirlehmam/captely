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

  if (balanceError) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">Failed to load credit info: {balanceError}</span>
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
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-primary-50 to-secondary-50">
        <div>
          <h3 className="text-lg leading-6 font-semibold text-gray-900">
            Credit Usage
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Current billing period
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 border border-primary-200 shadow-sm text-sm font-medium rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
          <CreditCard className="h-4 w-4 mr-2" />
          Buy Credits
        </button>
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
                className="text-primary-500 transition-all duration-1000 ease-in-out" 
                strokeWidth="6"
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
                style={{
                  filter: 'drop-shadow(0 4px 6px rgba(15, 118, 110, 0.2))'
                }}
              />
            </svg>
            
            {/* Center text */}
            <div className="relative text-center">
              <div className="text-3xl font-bold text-gray-900">
                {usagePercent}%
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Remaining
              </div>
            </div>
          </div>
        </div>
        
        {/* Credit stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{(balance.total_credits || 0).toLocaleString()}</div>
          </div>
          <div className="text-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="text-sm font-medium text-blue-600 uppercase tracking-wide">Used</div>
            <div className="text-xl font-bold text-blue-900 mt-1">{(balance.used_credits || 0).toLocaleString()}</div>
          </div>
          <div className="text-center bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="text-sm font-medium text-green-600 uppercase tracking-wide">Left</div>
            <div className="text-xl font-bold text-green-900 mt-1">{(balance.remaining_credits || 0).toLocaleString()}</div>
          </div>
        </div>
        
        {/* Usage projection */}
        {daysRemaining !== null && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-800">
                  Projected Usage
                </h4>
                <p className="mt-1 text-sm text-yellow-700">
                  At your current rate, you'll use approximately <strong>{(estimatedMonthlyUsage || 0).toLocaleString()}</strong> credits by the end of this billing cycle ({daysRemaining} days remaining).
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Usage history graph (simplified) */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Daily Usage
          </h4>
          <div className="h-28 flex items-end space-x-2 bg-gradient-to-t from-gray-50 to-transparent rounded-lg p-3">
            {dailyUsage.map((day: any, index: number) => {
              // Calculate bar height based on max value in history
              const maxCredits = Math.max(...dailyUsage.map((d: any) => d.credits_used || 0));
              const heightPercent = maxCredits > 0 ? (day.credits_used / maxCredits) * 100 : 0;
              
              return (
                <div key={day.date || index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-gradient-to-t from-primary-500 to-primary-400 rounded-t-md transition-all hover:from-primary-600 hover:to-primary-500 shadow-sm"
                    style={{ height: `${heightPercent}%` }}
                  ></div>
                  <div className="text-xs text-gray-500 mt-2 font-medium">
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