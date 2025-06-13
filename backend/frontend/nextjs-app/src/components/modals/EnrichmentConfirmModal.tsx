import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, CheckCircle, AlertCircle, ArrowRight, Edit3 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

export type EnrichmentType = {
  email: boolean;
  phone: boolean;
};

interface EnrichmentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (enrichmentType: EnrichmentType, customFilename?: string) => void;
  fileName?: string;
}

const EnrichmentConfirmModal: React.FC<EnrichmentConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName
}) => {
  const { t, formatMessage } = useLanguage();
  const { isDark } = useTheme();
  
  const [selectedEmail, setSelectedEmail] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState(true);
  const [customFilename, setCustomFilename] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Set default filename when modal opens
  useEffect(() => {
    if (isOpen && fileName) {
      // Remove file extension and set as default
      const nameWithoutExtension = fileName.replace(/\.(csv|xlsx|xls)$/i, '');
      setCustomFilename(nameWithoutExtension);
    } else if (isOpen && !fileName) {
      setCustomFilename('imported_contacts');
    }
  }, [isOpen, fileName]);

  // Disable page scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    
    // Pass the custom filename to the parent
    setTimeout(() => {
      onConfirm({
        email: selectedEmail,
        phone: selectedPhone
      }, customFilename.trim() || fileName);
      setIsConfirming(false);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ⚡ Import CSV & Enrichment
                </h3>
                {fileName && (
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    📄 File selected: {fileName}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Filename Input Section */}
            <div className="mb-6">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                📝 Batch Name
              </label>
              <div className="relative">
                <Edit3 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder="Enter batch name..."
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-all duration-200 ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 hover:bg-white'
                  } focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                💡 Customize the name to help you track your batches
              </p>
            </div>

            {/* Enrichment Options */}
            <div className="mb-6">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                Choose your enrichment options:
              </label>

              <div className="space-y-3">
                {/* Email Option */}
                <motion.button
                  onClick={() => setSelectedEmail(!selectedEmail)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedEmail
                      ? isDark 
                        ? 'bg-green-500/20 border-green-400/30' 
                        : 'bg-green-50 border-green-200'
                      : isDark
                        ? 'border-gray-600 bg-gray-700 hover:bg-gray-650'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedEmail 
                          ? isDark ? 'bg-green-600' : 'bg-green-600'
                          : isDark ? 'bg-gray-600' : 'bg-gray-200'
                      }`}>
                        {selectedEmail ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <Mail className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        )}
                      </div>
                      <div>
                        <h4 className={`font-semibold ${
                          selectedEmail 
                            ? isDark ? 'text-green-400' : 'text-green-700' 
                            : isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          📧 Email
                        </h4>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Find and verify email addresses
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.button>

                {/* Phone Option */}
                <motion.button
                  onClick={() => setSelectedPhone(!selectedPhone)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedPhone
                      ? isDark 
                        ? 'bg-blue-500/20 border-blue-400/30' 
                        : 'bg-blue-50 border-blue-200'
                      : isDark
                        ? 'border-gray-600 bg-gray-700 hover:bg-gray-650'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedPhone 
                          ? isDark ? 'bg-blue-600' : 'bg-blue-600'
                          : isDark ? 'bg-gray-600' : 'bg-gray-200'
                      }`}>
                        {selectedPhone ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <Phone className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        )}
                      </div>
                      <div>
                        <h4 className={`font-semibold ${
                          selectedPhone 
                            ? isDark ? 'text-blue-400' : 'text-blue-700' 
                            : isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          📱 Phone
                        </h4>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Find and verify phone numbers
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.button>

                {/* Both selected info */}
                {selectedEmail && selectedPhone && (
                  <div className={`p-3 rounded-lg border ${
                    isDark 
                      ? 'bg-purple-500/20 border-purple-400/30' 
                      : 'bg-purple-50 border-purple-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      isDark ? 'text-purple-300' : 'text-purple-800'
                    }`}>
                      🎉 Both - Complete enrichment enabled - Maximum enrichment!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Warning if nothing selected */}
            {!selectedEmail && !selectedPhone && (
              <div className={`p-3 rounded-lg border mb-4 ${
                isDark 
                  ? 'bg-amber-500/20 border-amber-400/30' 
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <AlertCircle className={`w-4 h-4 ${
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  }`} />
                  <p className={`text-sm ${
                    isDark ? 'text-amber-300' : 'text-amber-700'
                  }`}>
                    Please select at least one enrichment option
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isDark 
                    ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' 
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              
              <button
                onClick={handleConfirm}
                disabled={(!selectedEmail && !selectedPhone) || isConfirming || !customFilename.trim()}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 ${
                  (!selectedEmail && !selectedPhone) || isConfirming || !customFilename.trim()
                    ? 'bg-gray-400 text-gray-300 cursor-not-allowed'
                    : isDark
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
                      : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
                } text-white shadow-lg hover:shadow-xl`}
              >
                <div className="flex items-center justify-center space-x-2">
                  {isConfirming ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Enrichment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EnrichmentConfirmModal; 