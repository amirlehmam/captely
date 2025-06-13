import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, FileDown, Code2, Settings, 
  CheckCircle, AlertCircle, Loader, ExternalLink, Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiService } from '../../services/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel' | 'json' | 'hubspot', filename?: string) => Promise<void>;
  title: string;
  description: string;
  exportCount?: number;
  type: 'batch' | 'crm' | 'contacts';
  jobId?: string;
  contactIds?: string[];
  originalFilename?: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  title,
  description,
  exportCount,
  type,
  jobId,
  contactIds,
  originalFilename
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json' | 'hubspot'>('csv');
  const [customFilename, setCustomFilename] = useState('');
  const [exporting, setExporting] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [checkingHubspot, setCheckingHubspot] = useState(true);

  useEffect(() => {
    if (isOpen && originalFilename) {
      const nameWithoutExtension = originalFilename.replace(/\.(csv|xlsx|xls)$/i, '');
      setCustomFilename(nameWithoutExtension);
    } else if (isOpen && !originalFilename) {
      const defaultName = type === 'batch' ? 'batch_export' : 'contacts_export';
      setCustomFilename(defaultName);
    }
  }, [isOpen, originalFilename, type]);

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const hubspotStatus = await apiService.getHubSpotIntegrationStatus();
        setHubspotConnected(hubspotStatus.connected);
        
        const savedSettings = localStorage.getItem('dataExportSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setSelectedFormat(settings.format || 'csv');
          setUserSettings(settings);
        } else {
          setSelectedFormat('csv');
        }
      } catch (error) {
        console.error('Error loading export settings:', error);
        setSelectedFormat('csv');
        setHubspotConnected(false);
      } finally {
        setLoadingSettings(false);
        setCheckingHubspot(false);
      }
    };

    if (isOpen) {
      loadUserSettings();
    }
  }, [isOpen]);

  const getFormatOptions = () => {
    const baseOptions = [
      {
        value: 'csv' as const,
        label: 'CSV',
        icon: FileDown,
        description: 'Comma-separated values - Excel compatible',
        bgClass: 'from-green-500/20 to-green-600/20 border-green-400/30',
        textClass: 'text-green-600',
        selectedClass: 'bg-gradient-to-r from-green-50 to-green-100 border-green-400'
      },
      {
        value: 'excel' as const,
        label: 'Excel',
        icon: FileDown,
        description: 'Microsoft Excel spreadsheet (.xlsx)',
        bgClass: 'from-blue-500/20 to-blue-600/20 border-blue-400/30',
        textClass: 'text-blue-600',
        selectedClass: 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400'
      },
      {
        value: 'json' as const,
        label: 'JSON',
        icon: Code2,
        description: 'JavaScript Object Notation - API friendly',
        bgClass: 'from-purple-500/20 to-purple-600/20 border-purple-400/30',
        textClass: 'text-purple-600',
        selectedClass: 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-400'
      }
    ];

    if (hubspotConnected) {
      baseOptions.push({
        value: 'hubspot' as const,
        label: 'HubSpot CRM',
        icon: ExternalLink,
        description: 'Export directly to your HubSpot account',
        bgClass: 'from-orange-500/20 to-orange-600/20 border-orange-400/30',
        textClass: 'text-orange-600',
        selectedClass: 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-400'
      });
    }

    return baseOptions;
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const finalFilename = customFilename.trim() || 'export';
      await onExport(selectedFormat, finalFilename);
      
      if (selectedFormat !== 'hubspot') {
        const currentSettings = userSettings || {};
        const updatedSettings = { ...currentSettings, format: selectedFormat };
        localStorage.setItem('dataExportSettings', JSON.stringify(updatedSettings));
      }
      
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setExporting(false);
    }
  };

  const containerVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.9,
      y: 20
    },
    visible: { 
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
        duration: 0.5
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.95,
      y: -10,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
        duration: 0.3
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] flex items-center justify-center p-4"
        style={{ zIndex: 999999 }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-blue-900/90 to-purple-900/95 backdrop-blur-2xl"
          onClick={onClose}
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-lg mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl transform scale-110" />
            
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
              
              <div className="relative px-8 py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
                  <div className="absolute top-4 left-8 w-2 h-2 bg-white/30 rounded-full animate-pulse" />
                  <div className="absolute top-12 right-12 w-1 h-1 bg-white/40 rounded-full animate-pulse delay-1000" />
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        type: "spring", 
                        damping: 15, 
                        stiffness: 300,
                        delay: 0.2 
                      }}
                      className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center"
                    >
                      <Download className="w-6 h-6 text-white" />
                    </motion.div>
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-wide">
                        📥 NEW DESIGN ACTIVE - {title}
                      </h2>
                      <p className="text-white/80 text-sm mt-1 font-medium">
                        {description}
                        {exportCount && (
                          <span className="ml-1 text-white/90">
                            ({exportCount} items)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-all duration-200"
                  >
                    <X className="w-4 h-4 text-white" />
                  </motion.button>
                </div>
              </div>

              <div className="px-8 py-8">
                {checkingHubspot ? (
                  <div className="text-center py-6">
                    <Loader className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                    <p className="mt-2 text-sm text-gray-600">
                      Loading export options...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        📝 Export Name
                      </label>
                      <div className="relative">
                        <Edit3 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={customFilename}
                          onChange={(e) => setCustomFilename(e.target.value)}
                          placeholder="Enter export name..."
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 hover:bg-white"
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        💡 Customize the name to help you track your exports
                      </p>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        📄 Select Export Format
                      </label>
                      
                      <div className="space-y-3">
                        {getFormatOptions().map((format) => (
                          <motion.button
                            key={format.value}
                            onClick={() => setSelectedFormat(format.value)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                              selectedFormat === format.value
                                ? format.selectedClass
                                : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${format.bgClass} flex items-center justify-center`}>
                                  <format.icon className={`h-5 w-5 ${format.textClass}`} />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">
                                    {format.label}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {format.description}
                                  </p>
                                </div>
                              </div>
                              {selectedFormat === format.value && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className={`w-6 h-6 rounded-full bg-gradient-to-r ${format.bgClass} flex items-center justify-center`}
                                >
                                  <CheckCircle className={`h-4 w-4 ${format.textClass}`} />
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h5 className="font-semibold text-blue-900 mb-2 text-sm">
                            ℹ️ Export Information
                          </h5>
                          <ul className="text-xs text-blue-700 space-y-1">
                            <li>• 📧 Enriched contact data included</li>
                            <li>• ✅ Verification status</li>
                            <li>• 🔢 Lead scores & ratings</li>
                            {type === 'batch' && <li>• 📊 Provider information</li>}
                            {type === 'crm' && <li>• 📁 Batch associations</li>}
                            {selectedFormat === 'hubspot' && (
                              <li>• 🚀 Direct HubSpot sync</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="flex-1 px-6 py-3 text-gray-700 font-semibold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all duration-200"
                  >
                    Cancel
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExport}
                    disabled={exporting || checkingHubspot || !customFilename.trim()}
                    className={`flex-1 px-6 py-3 font-semibold rounded-2xl transition-all duration-300 ${
                      exporting || checkingHubspot || !customFilename.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : selectedFormat === 'hubspot'
                          ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg hover:shadow-xl'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {exporting ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          />
                          <span>{selectedFormat === 'hubspot' ? 'Syncing...' : 'Exporting...'}</span>
                        </>
                      ) : (
                        <>
                          {selectedFormat === 'hubspot' ? (
                            <ExternalLink className="w-4 h-4" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>
                            {selectedFormat === 'hubspot' 
                              ? 'Export to HubSpot' 
                              : `Export ${selectedFormat.toUpperCase()}`
                            }
                          </span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExportModal; 