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
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'down':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <RefreshCw className="h-5 w-5 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'operational':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'degraded':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'down':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const ProviderStatus: React.FC = () => {
  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
        <div>
          <h3 className="text-lg leading-6 font-semibold text-gray-900">
            Provider Status
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            API service health & response times
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>
      
      <div className="border-t border-gray-100 px-6 py-6">
        <div className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.name} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200">
              <div className="flex items-center">
                <div className="mr-4">
                  {getStatusIcon(provider.status)}
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900">
                    {provider.name}
                  </span>
                  <div className={`inline-block ml-3 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(provider.status)}`}>
                    {provider.status.charAt(0).toUpperCase() + provider.status.slice(1)}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className={`text-sm font-semibold ${
                    provider.status === 'operational' 
                      ? 'text-green-700' 
                      : provider.status === 'degraded' 
                        ? 'text-yellow-700' 
                        : 'text-red-700'
                  }`}>
                    {provider.responseTime}
                  </div>
                  <div className="text-xs text-gray-500">
                    Response time
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-700">
                    {provider.lastCheck}
                  </div>
                  <div className="text-xs text-gray-500">
                    Last check
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100 text-center">
        <span className="text-sm font-medium text-gray-700">
          Last updated at {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default ProviderStatus;