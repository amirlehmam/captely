import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader, Shield, Mail, Phone, DollarSign, Cog } from 'lucide-react';
import api from '../../services/api';
import VerificationStats from './VerificationStats';

const BatchProgress: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);

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
      <div className="space-y-6">
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
        
        {/* Show global verification stats */}
        <VerificationStats />
      </div>
    );
  }

  const progress = currentBatch.progress || 0;
  const successRate = currentBatch.success_rate || 0;
  const emailHitRate = currentBatch.email_hit_rate || 0;
  const phoneHitRate = currentBatch.phone_hit_rate || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
        <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h3 className="text-lg leading-6 font-semibold text-gray-900">
              Current Batch Progress
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Job {currentBatch.job_id?.substring(0, 8)} - Modern Enrichment Cascade
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowVerification(!showVerification)}
              className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                showVerification 
                  ? 'border-purple-300 text-purple-800 bg-purple-100 hover:bg-purple-200 focus:ring-purple-500' 
                  : 'border-purple-200 text-purple-700 bg-white hover:bg-purple-50 focus:ring-purple-500'
              }`}
            >
              <Shield className="h-4 w-4 mr-2" />
              {showVerification ? 'Hide' : 'Show'} Verification
            </button>
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
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
          
          {/* Enhanced Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Contacts</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{currentBatch.total}</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200">
              <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Completed</div>
              <div className="text-2xl font-bold text-indigo-900 mt-1">{currentBatch.completed}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="text-xs font-medium text-orange-600 uppercase tracking-wide flex items-center">
                <DollarSign className="h-3 w-3 mr-1" />
                Cost
              </div>
              <div className="text-xl font-bold text-orange-900 mt-1">
                {Math.round(currentBatch.credits_used || 0)} credits
              </div>
            </div>
          </div>
          
          {/* Stage progress */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="h-4 w-4 text-gray-600 mr-2" />
              Processing Stages
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Stage 1: Import */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">1. Import</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Status: Completed</div>
                  <div>Duration: ~30s</div>
                  <div>Contacts: {currentBatch.total}</div>
                </div>
              </div>

              {/* Stage 2: Enrichment */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">2. Enrichment</span>
                  {progress >= 100 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : progress > 0 ? (
                    <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Status: {progress >= 100 ? 'Completed' : progress > 0 ? 'Processing' : 'Pending'}</div>
                  <div>Progress: {Math.round(progress)}%</div>
                  <div>Found: {Math.round((currentBatch.emails_found || 0) / (currentBatch.total || 1) * 100)}% emails</div>
                </div>
              </div>

              {/* Stage 3: Email Verification */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">3. Email Verify</span>
                  {progress >= 100 && (currentBatch.emails_found || 0) > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : progress >= 100 ? (
                    <Loader className="h-4 w-4 text-orange-500 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Status: {progress >= 100 && (currentBatch.emails_found || 0) > 0 ? 'Verifying' : progress >= 100 ? 'Ready' : 'Waiting'}</div>
                  <div>Quality: Checking deliverability</div>
                  <div>Emails: {currentBatch.emails_found || 0} found</div>
                </div>
              </div>

              {/* Stage 4: Phone Verification */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">4. Phone Verify</span>
                  {progress >= 100 && (currentBatch.phones_found || 0) > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : progress >= 100 ? (
                    <Loader className="h-4 w-4 text-purple-500 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Status: {progress >= 100 && (currentBatch.phones_found || 0) > 0 ? 'Verifying' : progress >= 100 ? 'Ready' : 'Waiting'}</div>
                  <div>Type: Mobile/Landline detection</div>
                  <div>Phones: {currentBatch.phones_found || 0} found</div>
                </div>
              </div>

              {/* Stage 5: Export Ready */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">5. Export</span>
                  {progress >= 100 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Status: {progress >= 100 ? 'Ready' : 'Pending'}</div>
                  <div>Format: CSV/Excel/JSON</div>
                  <div>Quality: Verified data</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showVerification && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <VerificationStats jobId={currentBatch.job_id} />
        </div>
      )}
    </div>
  );
};

export default BatchProgress;