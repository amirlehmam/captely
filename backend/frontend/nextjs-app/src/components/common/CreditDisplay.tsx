import React from 'react';
import { CreditCard, AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { useCreditContext } from '../../contexts/CreditContext';
import { useTheme } from '../../contexts/ThemeContext';

interface CreditDisplayProps {
  variant?: 'compact' | 'detailed';
  showRefresh?: boolean;
}

const CreditDisplay: React.FC<CreditDisplayProps> = ({ 
  variant = 'compact', 
  showRefresh = true 
}) => {
  const { creditData, loading, error, refreshCredits } = useCreditContext();
  const { isDark } = useTheme();

  // Stable structure - no early returns for loading state in compact mode
  const isLowCredits = creditData ? creditData.balance < 100 : false;
  const isCriticalCredits = creditData ? creditData.balance < 20 : false;
  const displayBalance = creditData?.balance || 0;
  const displayPlan = creditData?.subscription?.package_name || 'Free';
  
  // Don't show error state if we're still loading or if plan is "Loading..."
  const isRealError = error && !loading && displayPlan !== 'Loading...';

  if (variant === 'compact') {
    return (
      <div className="flex items-center space-x-3" style={{ minWidth: '200px', height: '40px' }}>
        {/* Credit balance - Always present with stable dimensions to prevent flashing */}
        <div className="flex items-center space-x-2" style={{ minWidth: '120px' }}>
          <div className={`p-2 rounded-lg transition-colors duration-200 ${
            isRealError ? isDark ? 'bg-red-900/20' : 'bg-red-100' :
            isCriticalCredits ? isDark ? 'bg-red-900/20' : 'bg-red-100' : 
            isLowCredits ? isDark ? 'bg-yellow-900/20' : 'bg-yellow-100' : 
            isDark ? 'bg-green-900/20' : 'bg-green-100'
          }`}
          style={{ 
            willChange: 'background-color',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isRealError ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <CreditCard className={`h-4 w-4 transition-colors duration-200 ${
                isCriticalCredits ? 'text-red-600' : 
                isLowCredits ? 'text-yellow-600' : 'text-green-600'
              }`} 
              style={{ willChange: 'color' }} />
            )}
          </div>
          <div style={{ minWidth: '80px' }}>
            <div className="flex items-center space-x-1">
              {loading || displayPlan === 'Loading...' ? (
                <span className={`font-semibold ${isDark ? 'text-gray-400' : 'text-gray-400'}`}
                style={{ display: 'inline-block', width: '40px' }}>•••</span>
              ) : isRealError ? (
                <span className="text-red-600 font-semibold" style={{ display: 'inline-block', minWidth: '40px' }}>Error</span>
              ) : (
                <span className={`font-semibold transition-colors duration-200 ${
                  isCriticalCredits ? 'text-red-600' : 
                  isLowCredits ? 'text-yellow-600' : 
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
                style={{ 
                  willChange: 'color',
                  display: 'inline-block',
                  minWidth: '40px',
                  textAlign: 'right'
                }}>
                  {displayBalance.toLocaleString()}
                </span>
              )}
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>credits</span>
            </div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            style={{ 
              height: '14px',
              display: 'flex',
              alignItems: 'center'
            }}>
              {loading || displayPlan === 'Loading...' ? 'Loading...' : isLowCredits ? `${displayPlan} Plan` : ''}
              </div>
          </div>
        </div>

        {/* Actions - Always present with fixed dimensions */}
        <div className="flex items-center space-x-1" style={{ minWidth: '70px' }}>
          {showRefresh && (
            <button 
              onClick={refreshCredits}
              disabled={loading}
              className={`p-1 rounded transition-colors duration-200 ${
                loading 
                  ? isDark ? 'text-gray-600' : 'text-gray-300' 
                  : isDark 
                    ? 'hover:bg-gray-800 text-gray-400' 
                    : 'hover:bg-gray-100 text-gray-400'
              }`}
              style={{ 
                willChange: 'background-color, color',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Refresh credit balance"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          <button 
            disabled={loading}
            className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
              loading 
                ? isDark ? 'text-blue-400 bg-blue-900/20' : 'text-blue-400 bg-blue-25' 
                : isDark 
                  ? 'text-blue-300 bg-blue-900/30 hover:bg-blue-900/50' 
                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
            }`}
            style={{ 
              willChange: 'background-color, color',
              minWidth: '42px',
              height: '24px'
            }}
            title="Buy more credits"
          >
            <Plus className="h-3 w-3 mr-1" />
            Buy
          </button>
        </div>
      </div>
    );
  }

  // Detailed variant - can show loading state since it's not in header
  if (loading) {
    return (
      <div className={`rounded-lg border p-4 shadow-sm ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className={`h-4 rounded w-24 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className={`h-4 w-4 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          </div>
          <div className="space-y-2">
            <div className={`h-6 rounded w-16 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className="space-y-1">
              <div className={`h-3 rounded w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              <div className={`h-3 rounded w-3/4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !creditData) {
    return (
      <div className={`rounded-lg border p-4 shadow-sm ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className={`text-sm text-red-600 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            Failed to load credits
          </span>
          {showRefresh && (
            <button 
              onClick={refreshCredits}
              className={`p-1 rounded transition-colors ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
              title="Retry loading credits"
            >
              <RefreshCw className={`h-3 w-3 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Credit Balance
        </h3>
        {showRefresh && (
          <button 
            onClick={refreshCredits}
            className={`p-1 rounded transition-colors ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Refresh credit balance"
          >
            <RefreshCw className={`h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Main balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className={`h-5 w-5 ${
              isCriticalCredits ? 'text-red-500' : 
              isLowCredits ? 'text-yellow-500' : 'text-green-500'
            }`} />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Available</span>
          </div>
          <span className={`text-lg font-bold ${
            isCriticalCredits ? 'text-red-600' : 
            isLowCredits ? 'text-yellow-600' : 
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {creditData.balance.toLocaleString()}
          </span>
        </div>

        {/* Usage stats */}
        <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="flex justify-between">
            <span>Used today:</span>
            <span>{creditData.used_today}</span>
          </div>
          <div className="flex justify-between">
            <span>Used this month:</span>
            <span>{creditData.used_this_month}</span>
          </div>
          <div className="flex justify-between">
            <span>Monthly limit:</span>
            <span>{creditData.limit_monthly.toLocaleString()}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              creditData.used_this_month / creditData.limit_monthly > 0.8 ? 'bg-red-500' :
              creditData.used_this_month / creditData.limit_monthly > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ 
              width: `${Math.min(100, (creditData.used_this_month / creditData.limit_monthly) * 100)}%` 
            }}
          ></div>
        </div>

        {/* Plan info */}
        <div className={`flex items-center justify-between pt-2 border-t ${
          isDark ? 'border-gray-700' : 'border-gray-100'
        }`}>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {creditData.subscription.package_name} Plan
          </span>
          <button className={`text-xs font-medium ${
            isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
          }`}>
            Upgrade
          </button>
        </div>

        {/* Low credit warning */}
        {isLowCredits && (
          <div className={`p-2 rounded-md text-xs ${
            isCriticalCredits 
              ? isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-700'
              : isDark ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
          }`}>
            {isCriticalCredits ? (
              <>⚠️ Critical: Only {creditData.balance} credits left!</>
            ) : (
              <>⚡ Low credits: Consider buying more soon</>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditDisplay; 