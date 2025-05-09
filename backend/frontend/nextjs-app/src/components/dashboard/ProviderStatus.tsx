import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

// Mock data for provider status
const providers = [
  { name: "Icypeas", status: "operational", responseTime: "120ms", lastCheck: "1m ago" },
  { name: "Dropcontact", status: "operational", responseTime: "185ms", lastCheck: "2m ago" },
  { name: "Kaspr", status: "operational", responseTime: "210ms", lastCheck: "3m ago" },
  { name: "Clearbit", status: "degraded", responseTime: "450ms", lastCheck: "2m ago" },
  { name: "Hunter.io", status: "operational", responseTime: "175ms", lastCheck: "4m ago" },
  { name: "Apollo", status: "down", responseTime: "N/A", lastCheck: "5m ago" },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'operational':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'down':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <RefreshCw className="h-4 w-4 text-gray-500" />;
  }
};

const ProviderStatus: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Provider Status
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            API service health & response times
          </p>
        </div>
        <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </button>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {providers.map((provider) => (
            <li key={provider.name} className="py-3 flex justify-between items-center">
              <div className="flex items-center">
                {getStatusIcon(provider.status)}
                <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                  {provider.name}
                </span>
              </div>
              <div className="flex items-center">
                <span className={`text-xs mr-2 ${
                  provider.status === 'operational' 
                    ? 'text-green-600 dark:text-green-400' 
                    : provider.status === 'degraded' 
                      ? 'text-yellow-600 dark:text-yellow-400' 
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {provider.responseTime}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {provider.lastCheck}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-center text-xs text-gray-500 dark:text-gray-400">
        Updated at 12:45 PM
      </div>
    </div>
  );
};

export default ProviderStatus;