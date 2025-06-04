import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Phone, 
  Mail, 
  Shield, 
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import api from '../../services/api';

interface VerificationStatsProps {
  jobId?: string;
}

const VerificationStats: React.FC<VerificationStatsProps> = ({ jobId }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await api.getVerificationStats(jobId);
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching verification stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load verification stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [jobId]);

  const handleVerifyContacts = async () => {
    if (!jobId) return;
    
    setVerifying(true);
    try {
      await api.verifyExistingContacts(jobId);
      setTimeout(fetchStats, 2000); // Refresh stats after 2 seconds
    } catch (err) {
      console.error('Error verifying contacts:', err);
      setError('Failed to start verification process');
    } finally {
      setVerifying(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="h-6 bg-gray-100 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-100 rounded-lg w-48 animate-pulse"></div>
        </div>
        <div className="border-t border-gray-100 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
            <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
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
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">Failed to load verification stats: {error}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const emailVerificationRate = stats?.total_emails > 0 
    ? (stats.verified_emails / stats.total_emails * 100) 
    : 0;

  const phoneVerificationRate = stats?.total_phones > 0 
    ? (stats.verified_phones / stats.total_phones * 100) 
    : 0;

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
        <div>
          <h3 className="text-lg leading-6 font-semibold text-gray-900 flex items-center">
            <Shield className="h-5 w-5 text-purple-600 mr-2" />
            Verification Stats
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Email and phone verification quality metrics
          </p>
        </div>
        {jobId && (
          <button 
            onClick={handleVerifyContacts}
            disabled={verifying || loading}
            className="inline-flex items-center px-4 py-2 border border-purple-200 shadow-sm text-sm font-medium rounded-lg text-purple-700 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${verifying ? 'animate-spin' : ''}`} />
            {verifying ? 'Verifying...' : 'Verify Contacts'}
          </button>
        )}
      </div>
      
      <div className="border-t border-gray-100 px-6 py-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Email Verification */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Mail className="h-6 w-6 text-blue-600 mr-2" />
                <h4 className="text-lg font-semibold text-blue-900">Email Verification</h4>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {Math.round(emailVerificationRate)}%
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Total Emails</span>
                <span className="font-semibold text-blue-900">{stats?.total_emails || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Verified
                </span>
                <span className="font-semibold text-green-700">{stats?.verified_emails || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700 flex items-center">
                  <XCircle className="h-4 w-4 mr-1" />
                  Invalid
                </span>
                <span className="font-semibold text-red-700">{stats?.invalid_emails || 0}</span>
              </div>
            </div>
          </div>

          {/* Phone Verification */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Phone className="h-6 w-6 text-green-600 mr-2" />
                <h4 className="text-lg font-semibold text-green-900">Phone Verification</h4>
              </div>
              <div className="text-2xl font-bold text-green-900">
                {Math.round(phoneVerificationRate)}%
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700">Total Phones</span>
                <span className="font-semibold text-green-900">{stats?.total_phones || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Verified
                </span>
                <span className="font-semibold text-green-700">{stats?.verified_phones || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700 flex items-center">
                  <XCircle className="h-4 w-4 mr-1" />
                  Invalid
                </span>
                <span className="font-semibold text-red-700">{stats?.invalid_phones || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Email Quality Breakdown */}
          <div>
            <h5 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-4 w-4 text-blue-600 mr-2" />
              Email Quality Distribution
            </h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-green-700 font-medium">Excellent (90-100%)</span>
                <span className="font-bold text-green-900">
                  {stats?.verification_scores?.email?.excellent || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700 font-medium">Good (70-89%)</span>
                <span className="font-bold text-blue-900">
                  {stats?.verification_scores?.email?.good || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm text-yellow-700 font-medium">Fair (50-69%)</span>
                <span className="font-bold text-yellow-900">
                  {stats?.verification_scores?.email?.fair || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-sm text-red-700 font-medium">Poor (0-49%)</span>
                <span className="font-bold text-red-900">
                  {stats?.verification_scores?.email?.poor || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Phone Type Breakdown */}
          <div>
            <h5 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
              <Phone className="h-4 w-4 text-green-600 mr-2" />
              Phone Type Distribution
            </h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-green-700 font-medium">Mobile</span>
                <span className="font-bold text-green-900">
                  {stats?.verification_scores?.phone?.mobile || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700 font-medium">Landline</span>
                <span className="font-bold text-blue-900">
                  {stats?.verification_scores?.phone?.landline || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-purple-700 font-medium">VoIP</span>
                <span className="font-bold text-purple-900">
                  {stats?.verification_scores?.phone?.voip || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-sm text-red-700 font-medium">Invalid</span>
                <span className="font-bold text-red-900">
                  {stats?.verification_scores?.phone?.invalid || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationStats; 