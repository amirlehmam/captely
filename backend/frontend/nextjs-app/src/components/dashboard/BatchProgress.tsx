import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader } from 'lucide-react';
import api from '../../services/api';

const BatchProgress: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const data = await api.getDashboardStats();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchDashboardData();
  };

  if (loading && !dashboardData) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="h-6 bg-gray-100 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-100 rounded-lg w-48 animate-pulse"></div>
        </div>
        <div className="border-t border-gray-100 p-6">
          <div className="flex justify-center">
            <Loader className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">Failed to load batch progress: {error}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get current batch from analytics
  const currentBatch = dashboardData?.current_batch;

  if (!currentBatch) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <h3 className="text-lg leading-6 font-semibold text-gray-900">
            No Active Batches
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Start a new enrichment job to see progress here
          </p>
        </div>
      </div>
    );
  }

  const progress = currentBatch.progress || 0;
  const successRate = currentBatch.success_rate || 0;

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
        <div>
          <h3 className="text-lg leading-6 font-semibold text-gray-900">
            Current Batch Progress
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Job {currentBatch.job_id?.substring(0, 8)}
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      <div className="border-t border-gray-100 px-6 py-6">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-700">
              Processing {currentBatch.completed} of {currentBatch.total} contacts
            </span>
            <span className="text-sm font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary-500 to-primary-400 h-3 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Contacts</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{currentBatch.total}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
            <div className="text-xs font-medium text-green-600 uppercase tracking-wide">Success Rate</div>
            <div className="text-2xl font-bold text-green-900 mt-1">{Math.round(successRate)}%</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
            <div className="text-xs font-medium text-purple-600 uppercase tracking-wide">Completed</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">{currentBatch.completed}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
            <div className="text-xs font-medium text-orange-600 uppercase tracking-wide">Credits Used</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">{currentBatch.credits_used || 0}</div>
          </div>
        </div>
        
        {/* Stage progress */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Processing Stages
          </h4>
          <div className="space-y-4">
            {dashboardData.processing_stages?.map((stage: any, index: number) => (
              <div key={stage.name} className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-white border-2 border-gray-200">
                  {stage.status === 'completed' && (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  )}
                  {stage.status === 'in_progress' && (
                    <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
                  )}
                  {stage.status === 'pending' && (
                    <Clock className="h-6 w-6 text-gray-400" />
                  )}
                  {stage.status === 'error' && (
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {stage.name}
                    </span>
                    <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {stage.duration}
                    </span>
                  </div>
                  {index < (dashboardData.processing_stages?.length || 0) - 1 && (
                    <div className="ml-5 mt-2 mb-2 w-0.5 h-4 bg-gray-200"></div>
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