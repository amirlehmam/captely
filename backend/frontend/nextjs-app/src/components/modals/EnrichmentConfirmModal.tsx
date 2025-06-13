import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

interface EnrichmentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (enrichmentType: EnrichmentType) => void;
  fileName?: string;
}

export interface EnrichmentType {
  email: boolean;
  phone: boolean;
}

const EnrichmentConfirmModal: React.FC<EnrichmentConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName
}) => {
  const { t, formatMessage } = useLanguage();
  const { isDark } = useTheme();
  
  const [enrichmentType, setEnrichmentType] = useState<EnrichmentType>({
    email: true,
    phone: true
  });

  const handleSubmit = () => {
    // Validate that at least one option is selected
    if (!enrichmentType.email && !enrichmentType.phone) {
      return; // Don't proceed if nothing is selected
    }
    onConfirm(enrichmentType);
  };

  const handleCheckboxChange = (type: 'email' | 'phone') => {
    setEnrichmentType(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const hasSelection = enrichmentType.email || enrichmentType.phone;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Enhanced Backdrop with proper positioning and anti-layout-shift */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            style={{ 
              backdropFilter: 'blur(8px)',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              willChange: 'opacity'
            }}
          />

          {/* Modal with anti-layout-shift positioning */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              willChange: 'transform, opacity'
            }}
          >
            <div className={`rounded-2xl shadow-2xl border w-full max-w-md mx-4 relative transition-all duration-300 ${
              isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
            style={{
              maxWidth: '28rem',
              width: '100%',
              margin: '0 1rem',
              willChange: 'transform'
            }}>
              {/* Header */}
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg mr-3">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        📤 {t('enrichment.modal.title')}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className={`transition-colors p-1 rounded-full ${
                      isDark 
                        ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    style={{ willChange: 'background-color, color' }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                {fileName && (
                  <div className={`mb-6 p-4 border rounded-xl ${
                    isDark 
                      ? 'bg-blue-900/20 border-blue-700/50' 
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-blue-300' : 'text-blue-900'
                      }`}>
                        {formatMessage('enrichment.modal.fileSelected', { fileName })}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h4 className={`text-base font-semibold mb-4 ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {t('enrichment.modal.chooseEnrichment')}
                  </h4>
                  
                  <div className="space-y-3">
                    {/* Email Option */}
                    <label className={`cursor-pointer border border-solid rounded-xl p-4 transition-all duration-200 flex items-start ${
                      enrichmentType.email 
                        ? isDark
                          ? 'border-green-600 bg-green-900/20 shadow-sm' 
                          : 'border-green-300 bg-green-50 shadow-sm'
                        : isDark
                          ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700' 
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    style={{ willChange: 'background-color, border-color' }}>
                      <input
                        type="checkbox"
                        checked={enrichmentType.email}
                        onChange={() => handleCheckboxChange('email')}
                        className="sr-only"
                      />
                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                        enrichmentType.email 
                          ? 'bg-green-500 border-green-500' 
                          : isDark ? 'border-gray-500' : 'border-gray-300'
                      }`}>
                        {enrichmentType.email && (
                          <CheckCircle className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center flex-1">
                        <Mail className={`h-5 w-5 mr-3 ${
                          enrichmentType.email 
                            ? 'text-green-600' 
                            : isDark ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                        <div>
                          <span className={`font-medium ${
                            enrichmentType.email 
                              ? isDark ? 'text-green-300' : 'text-green-900'
                              : isDark ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            ☑️ {t('enrichment.modal.email.label')}
                          </span>
                          <p className={`text-sm ${
                            enrichmentType.email 
                              ? isDark ? 'text-green-400' : 'text-green-700'
                              : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {t('enrichment.modal.email.description')}
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Phone Option */}
                    <label className={`cursor-pointer border border-solid rounded-xl p-4 transition-all duration-200 flex items-start ${
                      enrichmentType.phone 
                        ? isDark
                          ? 'border-blue-600 bg-blue-900/20 shadow-sm' 
                          : 'border-blue-300 bg-blue-50 shadow-sm'
                        : isDark
                          ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700' 
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    style={{ willChange: 'background-color, border-color' }}>
                      <input
                        type="checkbox"
                        checked={enrichmentType.phone}
                        onChange={() => handleCheckboxChange('phone')}
                        className="sr-only"
                      />
                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                        enrichmentType.phone 
                          ? 'bg-blue-500 border-blue-500' 
                          : isDark ? 'border-gray-500' : 'border-gray-300'
                      }`}>
                        {enrichmentType.phone && (
                          <CheckCircle className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center flex-1">
                        <Phone className={`h-5 w-5 mr-3 ${
                          enrichmentType.phone 
                            ? 'text-blue-600' 
                            : isDark ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                        <div>
                          <span className={`font-medium ${
                            enrichmentType.phone 
                              ? isDark ? 'text-blue-300' : 'text-blue-900'
                              : isDark ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            ☑️ {t('enrichment.modal.phone.label')}
                          </span>
                          <p className={`text-sm ${
                            enrichmentType.phone 
                              ? isDark ? 'text-blue-400' : 'text-blue-700'
                              : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {t('enrichment.modal.phone.description')}
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Both Selected Indicator */}
                    {enrichmentType.email && enrichmentType.phone && (
                      <div className={`p-3 border rounded-xl ${
                        isDark 
                          ? 'bg-purple-900/20 border-purple-700/50' 
                          : 'bg-purple-50 border-purple-200'
                      }`}>
                        <div className="flex items-center">
                          <Zap className="h-4 w-4 text-purple-600 mr-2" />
                          <span className={`text-sm font-medium ${
                            isDark ? 'text-purple-400' : 'text-purple-900'
                          }`}>
                            ☑️ {t('enrichment.modal.both')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Warning if nothing selected */}
                {!hasSelection && (
                  <div className={`mb-4 p-3 border rounded-xl ${
                    isDark 
                      ? 'bg-red-900/20 border-red-700/50' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-red-400' : 'text-red-900'
                      }`}>
                        {t('enrichment.modal.selectAtLeastOne')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all duration-200 ${
                      isDark 
                        ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600' 
                        : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                    style={{ willChange: 'background-color, border-color' }}
                  >
                    {t('enrichment.modal.cancel')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!hasSelection}
                    className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      hasSelection
                        ? 'text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                        : isDark 
                          ? 'text-gray-500 bg-gray-700 cursor-not-allowed' 
                        : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                    }`}
                    style={{ willChange: 'background, box-shadow' }}
                  >
                    {t('enrichment.modal.startEnrichment')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EnrichmentConfirmModal; 