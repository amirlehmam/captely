import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, FileDown, Code2, Settings, 
  CheckCircle, AlertCircle, Loader
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiService } from '../../services/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel' | 'json') => Promise<void>;
  title: string;
  description: string;
  exportCount?: number;
  type: 'batch' | 'crm';
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  title,
  description,
  exportCount,
  type
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load user's export preferences
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        // Try to get user's export settings from localStorage first
        const savedSettings = localStorage.getItem('dataExportSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setSelectedFormat(settings.format || 'csv');
          setUserSettings(settings);
        } else {
          // Fallback to default
          setSelectedFormat('csv');
        }
      } catch (error) {
        console.error('Error loading export settings:', error);
        setSelectedFormat('csv');
      } finally {
        setLoadingSettings(false);
      }
    };

    if (isOpen) {
      loadUserSettings();
    }
  }, [isOpen]);

  const formatOptions = [
    {
      value: 'csv' as const,
      label: 'CSV',
      icon: FileDown,
      description: 'Comma-separated values - Excel compatible',
      color: isDark ? 'text-green-400' : 'text-green-600',
      bgColor: isDark ? 'bg-green-500/20 border-green-400/30' : 'bg-green-50 border-green-200'
    },
    {
      value: 'excel' as const,
      label: 'Excel',
      icon: FileDown,
      description: 'Microsoft Excel spreadsheet (.xlsx)',
      color: isDark ? 'text-blue-400' : 'text-blue-600',
      bgColor: isDark ? 'bg-blue-500/20 border-blue-400/30' : 'bg-blue-50 border-blue-200'
    },
    {
      value: 'json' as const,
      label: 'JSON',
      icon: Code2,
      description: 'JavaScript Object Notation - API friendly',
      color: isDark ? 'text-purple-400' : 'text-purple-600',
      bgColor: isDark ? 'bg-purple-500/20 border-purple-400/30' : 'bg-purple-50 border-purple-200'
    }
  ];

  const handleExport = async () => {
    try {
      setExporting(true);
      await onExport(selectedFormat);
      
      // Save user's format preference
      const currentSettings = userSettings || {};
      const updatedSettings = { ...currentSettings, format: selectedFormat };
      localStorage.setItem('dataExportSettings', JSON.stringify(updatedSettings));
      
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setExporting(false);
    }
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
          className={`rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  📥 {title}
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {description}
                  {exportCount && (
                    <span className={`ml-1 font-medium ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>
                      ({exportCount} items)
                    </span>
                  )}
                </p>
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
            {loadingSettings ? (
              <div className="text-center py-8">
                <Loader className={`h-8 w-8 animate-spin mx-auto ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Loading export preferences...
                </p>
              </div>
            ) : (
              <>
                {/* Format Selection */}
                <div className="space-y-3 mb-6">
                  <label className={`block text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    📄 Select Export Format
                  </label>
                  
                  {formatOptions.map((format) => (
                    <motion.button
                      key={format.value}
                      onClick={() => setSelectedFormat(format.value)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                        selectedFormat === format.value
                          ? format.bgColor
                          : isDark
                            ? 'border-gray-600 bg-gray-700 hover:bg-gray-650'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <format.icon className={`h-5 w-5 ${
                            selectedFormat === format.value
                              ? format.color
                              : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`} />
                          <div>
                            <div className={`font-medium ${
                              selectedFormat === format.value
                                ? format.color
                                : isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              {format.label}
                            </div>
                            <div className={`text-xs ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {format.description}
                            </div>
                          </div>
                        </div>
                        {selectedFormat === format.value && (
                          <CheckCircle className={`h-5 w-5 ${format.color}`} />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Additional Info */}
                <div className={`p-4 rounded-lg border ${
                  isDark 
                    ? 'bg-blue-500/20 border-blue-400/30' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start">
                    <AlertCircle className={`h-5 w-5 mt-0.5 mr-3 flex-shrink-0 ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <div>
                      <h5 className={`font-medium mb-1 ${
                        isDark ? 'text-blue-300' : 'text-blue-900'
                      }`}>
                        ℹ️ Export Information
                      </h5>
                      <ul className={`text-sm space-y-1 ${
                        isDark ? 'text-blue-200' : 'text-blue-700'
                      }`}>
                        <li>• 📧 Includes all enriched contact data</li>
                        <li>• ✅ Email and phone verification status</li>
                        <li>• 🔢 Lead scores and reliability ratings</li>
                        {type === 'batch' && <li>• 📊 Enrichment provider information</li>}
                        {type === 'crm' && <li>• 📁 Batch and campaign associations</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className={`p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isDark 
                    ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' 
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              
              <button
                onClick={handleExport}
                disabled={exporting || loadingSettings}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 ${
                  isDark
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                } text-white shadow-lg hover:shadow-xl`}
              >
                {exporting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2 inline" />
                    Export {selectedFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExportModal; 