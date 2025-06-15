import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, FileDown, Code2, Settings, 
  CheckCircle, AlertCircle, Loader, ExternalLink, Database, Globe, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiService } from '../../services/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel' | 'json' | 'hubspot' | 'lemlist' | 'zapier') => Promise<void>;
  title: string;
  description: string;
  exportCount?: number;
  type: 'batch' | 'crm' | 'contacts';
  jobId?: string;
  contactIds?: string[];
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
  contactIds
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json' | 'hubspot' | 'lemlist' | 'zapier'>('csv');
  const [exporting, setExporting] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [integrationStatuses, setIntegrationStatuses] = useState({
    hubspot: { connected: false },
    lemlist: { connected: false },
    zapier: { connected: false }
  });
  const [checkingIntegrations, setCheckingIntegrations] = useState(true);

  // Load user's export preferences and check integration statuses
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
        
        // Check all integration statuses in parallel
        const [hubspotResponse, lemlistResponse, zapierResponse] = await Promise.allSettled([
          fetch('/api/integrations/hubspot/status', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/export/lemlist/status', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/export/zapier/status', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const statuses = { hubspot: { connected: false }, lemlist: { connected: false }, zapier: { connected: false } };

        // Process HubSpot
        if (hubspotResponse.status === 'fulfilled' && hubspotResponse.value.ok) {
          const hubspotData = await hubspotResponse.value.json();
          statuses.hubspot = hubspotData;
        }

        // Process Lemlist
        if (lemlistResponse.status === 'fulfilled' && lemlistResponse.value.ok) {
          const lemlistData = await lemlistResponse.value.json();
          statuses.lemlist = lemlistData;
        }

        // Process Zapier
        if (zapierResponse.status === 'fulfilled' && zapierResponse.value.ok) {
          const zapierData = await zapierResponse.value.json();
          statuses.zapier = zapierData;
        }

        setIntegrationStatuses(statuses);
        
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
        setIntegrationStatuses({
          hubspot: { connected: false },
          lemlist: { connected: false },
          zapier: { connected: false }
        });
      } finally {
        setLoadingSettings(false);
        setCheckingIntegrations(false);
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
        color: isDark ? 'text-green-400' : 'text-green-600',
        bgColor: isDark ? 'bg-green-500/20 border-green-400/30' : 'bg-green-50 border-green-200',
        type: 'file'
      },
      {
        value: 'excel' as const,
        label: 'Excel',
        icon: FileDown,
        description: 'Microsoft Excel spreadsheet (.xlsx)',
        color: isDark ? 'text-blue-400' : 'text-blue-600',
        bgColor: isDark ? 'bg-blue-500/20 border-blue-400/30' : 'bg-blue-50 border-blue-200',
        type: 'file'
      },
      {
        value: 'json' as const,
        label: 'JSON',
        icon: Code2,
        description: 'JavaScript Object Notation - API friendly',
        color: isDark ? 'text-purple-400' : 'text-purple-600',
        bgColor: isDark ? 'bg-purple-500/20 border-purple-400/30' : 'bg-purple-50 border-purple-200',
        type: 'file'
      }
    ];

    // Add integration options if connected
    if (integrationStatuses.hubspot.connected) {
      baseOptions.push({
        value: 'hubspot' as const,
        label: 'HubSpot CRM',
        icon: Database,
        description: 'Export directly to your HubSpot account',
        color: isDark ? 'text-orange-400' : 'text-orange-600',
        bgColor: isDark ? 'bg-orange-500/20 border-orange-400/30' : 'bg-orange-50 border-orange-200',
        type: 'integration'
      });
    }

    if (integrationStatuses.lemlist.connected) {
      baseOptions.push({
        value: 'lemlist' as const,
        label: 'Lemlist',
        icon: Globe,
        description: 'Export to your Lemlist campaigns',
        color: isDark ? 'text-purple-400' : 'text-purple-600',
        bgColor: isDark ? 'bg-purple-500/20 border-purple-400/30' : 'bg-purple-50 border-purple-200',
        type: 'integration'
      });
    }

    if (integrationStatuses.zapier.connected) {
      baseOptions.push({
        value: 'zapier' as const,
        label: 'Zapier',
        icon: Zap,
        description: 'Send to your Zapier workflows',
        color: isDark ? 'text-amber-400' : 'text-amber-600',
        bgColor: isDark ? 'bg-amber-500/20 border-amber-400/30' : 'bg-amber-50 border-amber-200',
        type: 'integration'
      });
    }

    return baseOptions;
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await onExport(selectedFormat);
      
      // Save user's format preference (only for file formats)
      if (!['hubspot', 'lemlist', 'zapier'].includes(selectedFormat)) {
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

  const isIntegrationFormat = ['hubspot', 'lemlist', 'zapier'].includes(selectedFormat);
  const connectedIntegrationsCount = Object.values(integrationStatuses).filter(status => status.connected).length;

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
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative max-w-lg w-full rounded-2xl shadow-2xl border overflow-hidden ${
            isDark 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`px-6 py-4 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {title}
                </h3>
                <p className={`text-sm mt-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {description}
                  {exportCount && ` (${exportCount} ${exportCount === 1 ? 'item' : 'items'})`}
                </p>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {loadingSettings || checkingIntegrations ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-primary-500" />
                <span className={`ml-2 text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Loading export options...
                </span>
              </div>
            ) : (
              <>
                {/* Format Options */}
                <div className="space-y-3 mb-4">
                  <h4 className={`font-medium text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Select Export Format
                  </h4>
                  {getFormatOptions().map((format) => (
                    <motion.button
                      key={format.value}
                      onClick={() => setSelectedFormat(format.value)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full p-3 rounded-lg border-2 transition-all duration-200 ${
                        selectedFormat === format.value
                          ? format.bgColor
                          : isDark
                            ? 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <format.icon className={`h-5 w-5 ${
                            selectedFormat === format.value
                              ? format.color
                              : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`} />
                          <div className="text-left">
                            <div className={`font-medium ${
                              selectedFormat === format.value
                                ? format.color
                                : isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              {format.label}
                              {format.type === 'integration' && (
                                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                  isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                }`}>
                                  Connected
                                </span>
                              )}
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

                {/* Integration Notice if none connected */}
                {connectedIntegrationsCount === 0 && (
                  <div className={`p-3 rounded-lg border mb-3 ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-start">
                      <AlertCircle className={`h-4 w-4 mt-0.5 mr-2 flex-shrink-0 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <div>
                        <h5 className={`font-medium mb-1 text-sm ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          🔗 Integration Options
                        </h5>
                        <p className={`text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Connect <span className="font-medium text-orange-500">HubSpot</span>, <span className="font-medium text-purple-500">Lemlist</span>, or <span className="font-medium text-amber-500">Zapier</span> in{' '}
                          <span className="font-medium">Integrations</span> to export directly to your tools
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className={`p-3 rounded-lg border ${
                  isDark 
                    ? 'bg-blue-500/20 border-blue-400/30' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start">
                    <AlertCircle className={`h-4 w-4 mt-0.5 mr-2 flex-shrink-0 ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <div>
                      <h5 className={`font-medium mb-1 text-sm ${
                        isDark ? 'text-blue-300' : 'text-blue-900'
                      }`}>
                        ℹ️ Export Information
                      </h5>
                      <ul className={`text-xs space-y-0.5 ${
                        isDark ? 'text-blue-200' : 'text-blue-700'
                      }`}>
                        <li>• 📧 Enriched contact data included</li>
                        <li>• ✅ Verification status</li>
                        <li>• 🔢 Lead scores & ratings</li>
                        {type === 'batch' && <li>• 📊 Provider information</li>}
                        {type === 'crm' && <li>• 📁 Batch associations</li>}
                        {isIntegrationFormat && (
                          <li>• 🚀 Direct integration sync</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 border-t ${
            isDark ? 'border-gray-700' : 'border-gray-100'
          }`}>
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
                  isIntegrationFormat
                    ? selectedFormat === 'hubspot'
                      ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600'
                      : selectedFormat === 'lemlist'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600'
                        : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                } text-white shadow-lg hover:shadow-xl`}
              >
                {exporting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                    {isIntegrationFormat ? 'Syncing...' : 'Exporting...'}
                  </>
                ) : (
                  <>
                    {isIntegrationFormat ? (
                      <ExternalLink className="h-4 w-4 mr-2 inline" />
                    ) : (
                      <Download className="h-4 w-4 mr-2 inline" />
                    )}
                    {isIntegrationFormat 
                      ? `Export to ${selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1)}` 
                      : `Export ${selectedFormat.toUpperCase()}`
                    }
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

