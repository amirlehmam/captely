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
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

interface VerificationStatsProps {
  jobId?: string;
}

const VerificationStats: React.FC<VerificationStatsProps> = ({ jobId }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Calculate rates with safe defaults
  const emailVerificationRate = stats?.total_emails > 0 
    ? (stats.verified_emails / stats.total_emails * 100) 
    : 0;

  const phoneVerificationRate = stats?.total_phones > 0 
    ? (stats.verified_phones / stats.total_phones * 100) 
    : 0;

  // Always render container - never return early to avoid flashing
  return (
    <div className={`overflow-hidden shadow-lg rounded-xl border transition-all duration-300 hover:shadow-xl ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
    }`}>
      <div className={`px-6 py-4 flex justify-between items-center ${
        isDark ? 'bg-gradient-to-r from-gray-800 to-gray-750' : 'bg-gradient-to-r from-purple-50 to-white'
      }`}>
        <div>
          <h3 className={`text-lg leading-6 font-semibold flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Shield className={`h-5 w-5 mr-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            {t('common.verification_stats')}
          </h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('common.email_and_phone_verification_quality_metrics')}
          </p>
        </div>
      </div>
      
      <div className={`border-t px-6 py-5 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
        {/* Conditional content but stable structure */}
        {loading && !stats ? (
          // Initial loading state
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`h-32 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              <div className={`h-32 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`h-40 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              <div className={`h-40 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
            </div>
          </div>
        ) : error ? (
          // Error state
          <div className={`border rounded-xl p-3 ${
            isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
              <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                Failed to load verification stats: {error}
              </span>
            </div>
          </div>
        ) : (
          // Main verification content - stable structure
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              {/* Email Verification */}
              <div className={`rounded-xl p-5 border ${
                isDark 
                  ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/30 border-blue-700/50' 
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Mail className={`h-5 w-5 mr-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <h4 className={`text-base font-semibold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                      {t('common.email_verification')}
                    </h4>
                  </div>
                  <div className={`text-xl font-bold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                    {Math.round(emailVerificationRate)}%
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      {t('common.total_emails')}
                    </span>
                    <span className={`font-semibold ${isDark ? 'text-blue-200' : 'text-blue-900'}`}>
                      {stats?.total_emails || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm flex items-center ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('common.verified')}
                    </span>
                    <span className="font-semibold text-green-600">
                      {stats?.verified_emails || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm flex items-center ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      <XCircle className="h-3 w-3 mr-1" />
                      {t('common.invalid')}
                    </span>
                    <span className="font-semibold text-red-600">
                      {stats?.invalid_emails || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phone Verification */}
              <div className={`rounded-xl p-5 border ${
                isDark 
                  ? 'bg-gradient-to-br from-green-900/30 to-green-800/30 border-green-700/50' 
                  : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Phone className={`h-5 w-5 mr-2 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <h4 className={`text-base font-semibold ${isDark ? 'text-green-300' : 'text-green-900'}`}>
                      {t('common.phone_verification')}
                    </h4>
                  </div>
                  <div className={`text-xl font-bold ${isDark ? 'text-green-300' : 'text-green-900'}`}>
                    {Math.round(phoneVerificationRate)}%
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                      {t('common.total_phones')}
                    </span>
                    <span className={`font-semibold ${isDark ? 'text-green-200' : 'text-green-900'}`}>
                      {stats?.total_phones || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm flex items-center ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('common.verified')}
                    </span>
                    <span className="font-semibold text-green-600">
                      {stats?.verified_phones || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm flex items-center ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                      <XCircle className="h-3 w-3 mr-1" />
                      {t('common.invalid')}
                    </span>
                    <span className="font-semibold text-red-600">
                      {stats?.invalid_phones || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Email Quality Breakdown */}
              <div>
                <h5 className={`text-sm font-semibold mb-3 flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <TrendingUp className={`h-4 w-4 mr-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  {t('common.email_quality_distribution')}
                </h5>
                <div className="space-y-2">
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-green-900/20' : 'bg-green-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                      {t('common.excellent')} (90-100%)
                    </span>
                    <span className={`font-bold ${isDark ? 'text-green-300' : 'text-green-900'}`}>
                      {stats?.verification_scores?.email?.excellent || 0}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-blue-900/20' : 'bg-blue-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                      {t('common.good')} (70-89%)
                    </span>
                    <span className={`font-bold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                      {stats?.verification_scores?.email?.good || 0}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      {t('common.fair')} (50-69%)
                    </span>
                    <span className={`font-bold ${isDark ? 'text-yellow-300' : 'text-yellow-900'}`}>
                      {stats?.verification_scores?.email?.fair || 0}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-red-900/20' : 'bg-red-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                      {t('common.poor')} (0-49%)
                    </span>
                    <span className={`font-bold ${isDark ? 'text-red-300' : 'text-red-900'}`}>
                      {stats?.verification_scores?.email?.poor || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phone Type Breakdown */}
              <div>
                <h5 className={`text-sm font-semibold mb-3 flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Phone className={`h-4 w-4 mr-2 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                  {t('common.phone_type_distribution')}
                </h5>
                <div className="space-y-2">
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-green-900/20' : 'bg-green-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                      {t('common.mobile')}
                    </span>
                    <span className={`font-bold ${isDark ? 'text-green-300' : 'text-green-900'}`}>
                      {stats?.verification_scores?.phone?.mobile || 0}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-blue-900/20' : 'bg-blue-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                      {t('common.landline')}
                    </span>
                    <span className={`font-bold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                      {stats?.verification_scores?.phone?.landline || 0}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-purple-900/20' : 'bg-purple-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                      {t('common.voip')}
                    </span>
                    <span className={`font-bold ${isDark ? 'text-purple-300' : 'text-purple-900'}`}>
                      {stats?.verification_scores?.phone?.voip || 0}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded-lg ${
                    isDark ? 'bg-red-900/20' : 'bg-red-50'
                  }`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                      Invalid
                    </span>
                    <span className={`font-bold ${isDark ? 'text-red-300' : 'text-red-900'}`}>
                      {stats?.verification_scores?.phone?.invalid || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerificationStats; 