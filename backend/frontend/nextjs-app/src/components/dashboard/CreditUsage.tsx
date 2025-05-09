import React from 'react';
import { CreditCard, TrendingUp, AlertCircle } from 'lucide-react';

// Mock data for credit usage
const creditUsage = {
  total: 5000,
  used: 1550,
  remaining: 3450,
  percent: 72,
  history: [
    { date: "May 1", credits: 120 },
    { date: "May 2", credits: 85 },
    { date: "May 3", credits: 210 },
    { date: "May 4", credits: 150 },
    { date: "May 5", credits: 195 },
    { date: "May 6", credits: 245 },
    { date: "May 7", credits: 170 },
    { date: "May 8", credits: 220 },
    { date: "May 9", credits: 90 },
    { date: "May 10", credits: 65 },
  ],
  projection: {
    daysRemaining: 21,
    estimatedUsage: 4200,
  }
};

const CreditUsage: React.FC = () => {
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
                strokeDashoffset={`${282.7 * (1 - creditUsage.percent / 100)}`}
                // This rotates the circle so the progress starts from the top
                transform="rotate(-90 50 50)"
              />
            </svg>
            
            {/* Center text */}
            <div className="relative text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {creditUsage.percent}%
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
            <div className="text-lg font-medium text-gray-900 dark:text-white">{creditUsage.total}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">Used</div>
            <div className="text-lg font-medium text-blue-600 dark:text-blue-400">{creditUsage.used}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">Left</div>
            <div className="text-lg font-medium text-green-600 dark:text-green-400">{creditUsage.remaining}</div>
          </div>
        </div>
        
        {/* Usage projection */}
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Projected Usage
              </h4>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                At your current rate, you'll use approximately <strong>{creditUsage.projection.estimatedUsage}</strong> credits by the end of this billing cycle ({creditUsage.projection.daysRemaining} days remaining).
              </p>
            </div>
          </div>
        </div>
        
        {/* Usage history graph (simplified) */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Daily Usage
          </h4>
          <div className="h-24 flex items-end space-x-1">
            {creditUsage.history.map((day) => {
              // Calculate bar height based on max value in history
              const maxCredits = Math.max(...creditUsage.history.map(d => d.credits));
              const heightPercent = (day.credits / maxCredits) * 100;
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-teal-500 dark:bg-teal-600 rounded-t transition-all hover:bg-teal-600 dark:hover:bg-teal-500"
                    style={{ height: `${heightPercent}%` }}
                  ></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">
                    {day.date.split(' ')[1]}
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