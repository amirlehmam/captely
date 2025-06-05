import React from 'react';
import { CreditCard, AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { useCreditContext } from '../../contexts/CreditContext';

interface CreditDisplayProps {
  variant?: 'compact' | 'detailed';
  showRefresh?: boolean;
}

const CreditDisplay: React.FC<CreditDisplayProps> = ({ 
  variant = 'compact', 
  showRefresh = true 
}) => {
  const { creditData, loading, error, refreshCredits } = useCreditContext();

  // Stable structure - no early returns for loading state in compact mode
  const isLowCredits = creditData ? creditData.balance < 100 : false;
  const isCriticalCredits = creditData ? creditData.balance < 20 : false;
  const displayBalance = creditData?.balance || 0;
  const displayPlan = creditData?.subscription?.package_name || 'Free';

  if (variant === 'compact') {
    return (
      <div className="flex items-center space-x-3">
        {/* Credit balance - Always present to prevent flashing */}
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-lg ${
            error ? 'bg-red-100' :
            isCriticalCredits ? 'bg-red-100' : 
            isLowCredits ? 'bg-yellow-100' : 'bg-green-100'
          }`}>
            {error ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <CreditCard className={`h-4 w-4 ${
                isCriticalCredits ? 'text-red-600' : 
                isLowCredits ? 'text-yellow-600' : 'text-green-600'
              }`} />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1">
              {loading ? (
                <span className="text-gray-400 font-semibold">•••</span>
              ) : error ? (
                <span className="text-red-600 font-semibold">Error</span>
              ) : (
                <span className={`font-semibold ${
                  isCriticalCredits ? 'text-red-700' : 
                  isLowCredits ? 'text-yellow-700' : 'text-gray-900'
                }`}>
                  {displayBalance.toLocaleString()}
                </span>
              )}
              <span className="text-xs text-gray-500">credits</span>
            </div>
            {(isLowCredits || loading) && (
              <div className="text-xs text-gray-500">
                {loading ? 'Loading...' : `${displayPlan} Plan`}
              </div>
            )}
          </div>
        </div>

        {/* Actions - Always present */}
        <div className="flex items-center space-x-1">
          {showRefresh && (
            <button 
              onClick={refreshCredits}
              disabled={loading}
              className={`p-1 rounded transition-colors ${
                loading ? 'text-gray-300' : 'hover:bg-gray-100 text-gray-400'
              }`}
              title="Refresh credit balance"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          <button 
            disabled={loading}
            className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              loading ? 'text-blue-400 bg-blue-25' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
            }`}
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
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 w-4 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-16"></div>
            <div className="space-y-1">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !creditData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-600">Failed to load credits</span>
          {showRefresh && (
            <button 
              onClick={refreshCredits}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Retry loading credits"
            >
              <RefreshCw className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Credit Balance</h3>
        {showRefresh && (
          <button 
            onClick={refreshCredits}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Refresh credit balance"
          >
            <RefreshCw className="h-4 w-4 text-gray-400" />
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
            <span className="text-sm text-gray-600">Available</span>
          </div>
          <span className={`text-lg font-bold ${
            isCriticalCredits ? 'text-red-700' : 
            isLowCredits ? 'text-yellow-700' : 'text-gray-900'
          }`}>
            {creditData.balance.toLocaleString()}
          </span>
        </div>

        {/* Usage stats */}
        <div className="text-xs text-gray-500 space-y-1">
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
        <div className="w-full bg-gray-200 rounded-full h-2">
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
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {creditData.subscription.package_name} Plan
          </span>
          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            Upgrade
          </button>
        </div>

        {/* Low credit warning */}
        {isLowCredits && (
          <div className={`p-2 rounded-md text-xs ${
            isCriticalCredits ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
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