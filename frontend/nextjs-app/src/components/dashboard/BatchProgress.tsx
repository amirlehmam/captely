import React from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';

// Mock data for a current batch
const currentBatch = {
  id: "batch-12345",
  name: "Sales Navigator - Tech Leaders",
  status: "processing",
  progress: 65,
  totalContacts: 150,
  processed: 98,
  successRate: 87,
  emailsFound: 85,
  phonesFound: 62,
  startTime: "2025-05-12T10:30:00Z",
  stages: [
    { name: "Import", status: "completed", time: "00:05" },
    { name: "Enrichment", status: "completed", time: "01:12" },
    { name: "Verification", status: "in_progress", time: "00:47" },
    { name: "Export", status: "pending", time: "00:00" }
  ]
};

const BatchProgress: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Current Batch Progress
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {currentBatch.name}
          </p>
        </div>
        <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </button>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Processing {currentBatch.processed} of {currentBatch.totalContacts} contacts
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentBatch.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-teal-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${currentBatch.progress}%` }}
            ></div>
          </div>
        </div>
        
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Contacts</div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">{currentBatch.totalContacts}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">{currentBatch.successRate}%</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Emails Found</div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{currentBatch.emailsFound}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Phones Found</div>
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">{currentBatch.phonesFound}</div>
          </div>
        </div>
        
        {/* Stage progress */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Processing Stages
          </h4>
          <div className="space-y-4">
            {currentBatch.stages.map((stage, index) => (
              <div key={stage.name} className="flex items-center">
                <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center">
                  {stage.status === 'completed' && (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  )}
                  {stage.status === 'in_progress' && (
                    <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
                  )}
                  {stage.status === 'pending' && (
                    <Clock className="h-6 w-6 text-gray-400" />
                  )}
                  {stage.status === 'error' && (
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {stage.name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {stage.time}
                    </span>
                  </div>
                  {index < currentBatch.stages.length - 1 && (
                    <div className="ml-3 mt-1 mb-1 w-0.5 h-4 bg-gray-200 dark:bg-gray-600"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchProgress;