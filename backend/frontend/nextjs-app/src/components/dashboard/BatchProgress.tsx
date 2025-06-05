import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader, Shield, Mail, Phone, DollarSign, Cog } from 'lucide-react';
import api from '../../services/api';
import VerificationStats from './VerificationStats';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

const BatchProgress: React.FC = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
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
    // Silent refresh - no loading state shown
    await fetchDashboardData();
  };

  // Always render the container - never return early to avoid flashing
  const currentBatch = dashboardData?.current_batch;
  const progress = currentBatch?.progress || 0;

  return (
    <div className="space-y-6">
      <div className={`overflow-hidden shadow-lg rounded-xl border transition-all duration-300 hover:shadow-xl ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <div className={`px-6 py-5 flex justify-between items-center ${
          isDark ? 'bg-gradient-to-r from-gray-800 to-gray-750' : 'bg-gradient-to-r from-gray-50 to-white'
        }`}>
          <div>
            <h3 className={`text-lg leading-6 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('common.current_batch_progress')}
            </h3>
            <p className={`mt-1 max-w-2xl text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('common.follow_the_entire_processus')}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowVerification(!showVerification)}
              className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                showVerification 
                  ? isDark
                    ? 'border-purple-600 text-purple-300 bg-purple-900/30 hover:bg-purple-900/50 focus:ring-purple-500'
                    : 'border-purple-300 text-purple-800 bg-purple-100 hover:bg-purple-200 focus:ring-purple-500'
                  : isDark
                    ? 'border-purple-700 text-purple-400 bg-gray-700 hover:bg-purple-900/20 focus:ring-purple-500'
                    : 'border-purple-200 text-purple-700 bg-white hover:bg-purple-50 focus:ring-purple-500'
              }`}
            >
              <Shield className="h-4 w-4 mr-2" />
              {showVerification ? t('common.hide') : t('common.show')} {t('common.verification')}
            </button>
          </div>
        </div>
        
        <div className={`border-t px-6 py-6 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
          {/* Show content based on state but keep structure stable */}
          {loading && !dashboardData ? (
            // Initial loading state
            <div className="space-y-6">
              <div className={`h-6 rounded-lg animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              <div className={`h-4 rounded-lg w-48 animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
                <div className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
                <div className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className={`border rounded-xl p-4 ${
              isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className={isDark ? 'text-red-400' : 'text-red-700'}>
                  {t('common.failed_to_load_batch_progress')}: {error}
                </span>
              </div>
            </div>
          ) : !currentBatch ? (
            // No batch state
            <div className="text-center py-8">
              <h3 className={`text-lg leading-6 font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('common.no_active_batches')}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('common.start_new_enrichment_job')}
              </p>
            </div>
          ) : (
            // Active batch content - structure remains the same
            <>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('common.processing')} {currentBatch.completed || 0} {t('common.of')} {currentBatch.total || 0} {t('common.contacts')}
                  </span>
                  <span className="text-sm font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400 px-3 py-1 rounded-full">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className={`w-full rounded-full h-3 overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div 
                    className="bg-gradient-to-r from-primary-500 to-primary-400 h-3 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Stats grid - keep structure stable */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className={`p-4 rounded-xl border ${
                  isDark 
                    ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/30 border-blue-700/50' 
                    : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
                }`}>
                  <div className={`text-xs font-medium uppercase tracking-wide ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    {t('common.contacts')}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                    {currentBatch.total || 0}
                  </div>
                </div>
                <div className={`p-4 rounded-xl border ${
                  isDark 
                    ? 'bg-gradient-to-br from-indigo-900/30 to-indigo-800/30 border-indigo-700/50' 
                    : 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200'
                }`}>
                  <div className={`text-xs font-medium uppercase tracking-wide ${
                    isDark ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>
                    {t('common.completed')}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${isDark ? 'text-indigo-300' : 'text-indigo-900'}`}>
                    {currentBatch.completed || 0}
                  </div>
                </div>
                <div className={`p-4 rounded-xl border ${
                  isDark 
                    ? 'bg-gradient-to-br from-orange-900/30 to-orange-800/30 border-orange-700/50' 
                    : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
                }`}>
                  <div className={`text-xs font-medium uppercase tracking-wide flex items-center ${
                    isDark ? 'text-orange-400' : 'text-orange-600'
                  }`}>
                    <DollarSign className="h-3 w-3 mr-1" />
                    {t('common.cost')}
                  </div>
                  <div className={`text-xl font-bold mt-1 ${isDark ? 'text-orange-300' : 'text-orange-900'}`}>
                    {Math.round(currentBatch.credits_used || 0)} credits
                  </div>
                </div>
              </div>
              
              {/* Stage progress - keep structure stable */}
              <div className="mb-6">
                <h4 className={`text-sm font-semibold mb-4 flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Clock className={`h-4 w-4 mr-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  {t('common.processing_stages')}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Fixed structure for all stages */}
                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        1. {t('common.import')}
                      </span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>{t('common.status')}: {t('common.completed')}</div>
                      <div>{t('common.duration')}: ~30s</div>
                      <div>{t('common.contacts')}: {currentBatch.total || 0}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        2. {t('common.enrichment')}
                      </span>
                      {progress >= 100 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : progress > 0 ? (
                        <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>{t('common.status')}: {progress >= 100 ? t('common.completed') : progress > 0 ? t('common.processing') : t('common.pending')}</div>
                      <div>{t('common.progress')}: {Math.round(progress)}%</div>
                      <div>{t('common.found')}: {Math.round((currentBatch.emails_found || 0) / (currentBatch.total || 1) * 100)}% {t('common.emails')}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        3. {t('common.email_verify')}
                      </span>
                      {progress >= 100 && (currentBatch.emails_found || 0) > 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : progress >= 100 ? (
                        <Loader className="h-4 w-4 text-orange-500 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>{t('common.status')}: {progress >= 100 && (currentBatch.emails_found || 0) > 0 ? t('common.verifying') : progress >= 100 ? t('common.ready') : t('common.waiting')}</div>
                      <div>{t('common.quality')}: {t('common.checking_deliverability')}</div>
                      <div>{t('common.emails')}: {currentBatch.emails_found || 0} {t('common.found')}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        4. {t('common.phone_verify')}
                      </span>
                      {progress >= 100 && (currentBatch.phones_found || 0) > 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : progress >= 100 ? (
                        <Loader className="h-4 w-4 text-purple-500 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>{t('common.status')}: {progress >= 100 && (currentBatch.phones_found || 0) > 0 ? t('common.verifying') : progress >= 100 ? t('common.ready') : t('common.waiting')}</div>
                      <div>{t('common.type')}: {t('common.mobile_landline_detection')}</div>
                      <div>{t('common.phones')}: {currentBatch.phones_found || 0} {t('common.found')}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        5. {t('common.export')}
                      </span>
                      {progress >= 100 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>{t('common.status')}: {progress >= 100 ? t('common.ready') : t('common.pending')}</div>
                      <div>{t('common.format')}: CSV/Excel/JSON</div>
                      <div>{t('common.quality')}: {t('common.verified_data')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showVerification && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <VerificationStats jobId={currentBatch?.job_id} />
        </div>
      )}
    </div>
  );
};

export default BatchProgress;