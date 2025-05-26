import React from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader } from 'lucide-react';
import { useJobs } from '../../hooks/useApi';

const BatchProgress: React.FC = () => {
  const { jobs, loading, error, refetch } = useJobs();

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-center">
            <Loader className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-300">Failed to load batch progress: {error}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Find the most recent processing job
  const currentBatch = jobs.find(job => job.status === 'processing') || jobs[0];

  if (!currentBatch) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            No Active Batches
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Start a new enrichment job to see progress here
          </p>
        </div>
      </div>
    );
  }

  const progress = currentBatch.total > 0 ? Math.round((currentBatch.completed / currentBatch.total) * 100) : 0;
  const successRate = currentBatch.success_rate ? Math.round(currentBatch.success_rate * 100) : 0;

  // Determine processing stages based on progress
  const getStages = () => {
    const stages = [
      { 
        name: "Import", 
        status: progress > 0 ? "completed" : "pending", 
        time: progress > 0 ? "00:30" : "00:00" 
      },
      { 
        name: "Enrichment", 
        status: progress >= 25 ? (progress >= 90 ? "completed" : "in_progress") : "pending", 
        time: progress >= 25 ? (progress >= 90 ? "02:45" : "01:30") : "00:00" 
      },
      { 
        name: "Verification", 
        status: progress >= 70 ? (progress >= 95 ? "completed" : "in_progress") : "pending", 
        time: progress >= 70 ? (progress >= 95 ? "01:15" : "00:45") : "00:00" 
      },
      { 
        name: "Export", 
        status: currentBatch.status === 'completed' ? "completed" : "pending", 
        time: currentBatch.status === 'completed' ? "00:15" : "00:00" 
      }
    ];

    // Handle failed status
    if (currentBatch.status === 'failed') {
      const failedStageIndex = Math.floor(progress / 25);
      if (failedStageIndex < stages.length) {
        stages[failedStageIndex].status = 'error';
      }
    }

    return stages;
  };
  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Current Batch Progress
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {currentBatch.file_name || `Job ${currentBatch.id.substring(0, 8)}`}
          </p>
        </div>
        <button 
          onClick={refetch}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </button>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Processing {currentBatch.completed} of {currentBatch.total} contacts
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-teal-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Contacts</div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">{currentBatch.total}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">{successRate}%</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{currentBatch.completed}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Credits Used</div>
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">{currentBatch.credits_used || 0}</div>
          </div>
        </div>
        
        {/* Stage progress */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Processing Stages
          </h4>
          <div className="space-y-4">
            {getStages().map((stage, index) => (
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
                  {index < getStages().length - 1 && (
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