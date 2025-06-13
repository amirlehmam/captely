import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, FileDown, Code2, Settings, 
  CheckCircle, AlertCircle, Loader, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';

@@ -12,13 +12,14 @@ import { apiService } from '../../services/api';
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel' | 'json' | 'hubspot') => Promise<void>;
  title: string;
  description: string;
  exportCount?: number;
  type: 'batch' | 'crm' | 'contacts';
  jobId?: string;
  contactIds?: string[];

}

const ExportModal: React.FC<ExportModalProps> = ({

@@ -30,34 +31,42 @@ const ExportModal: React.FC<ExportModalProps> = ({
  exportCount,
  type,
  jobId,
  contactIds

}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json' | 'hubspot'>('csv');

  const [exporting, setExporting] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [checkingHubspot, setCheckingHubspot] = useState(true);

  // Load user's export preferences and check HubSpot status









  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        // Check HubSpot integration status
        const hubspotStatus = await apiService.getHubSpotIntegrationStatus();
        setHubspotConnected(hubspotStatus.connected);
        
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

@@ -82,40 +91,39 @@ const ExportModal: React.FC<ExportModalProps> = ({
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

    // Add HubSpot option if connected
    if (hubspotConnected) {
      baseOptions.push({
        value: 'hubspot' as const,
        label: 'HubSpot CRM',
        icon: ExternalLink,
        description: 'Export directly to your HubSpot account',
        color: isDark ? 'text-orange-400' : 'text-orange-600',
        bgColor: isDark ? 'bg-orange-500/20 border-orange-400/30' : 'bg-orange-50 border-orange-200',
        type: 'crm'
      });
    }


@@ -125,9 +133,10 @@ const ExportModal: React.FC<ExportModalProps> = ({
  const handleExport = async () => {
    try {
      setExporting(true);
      await onExport(selectedFormat);
      
      // Save user's format preference (only for file formats)


      if (selectedFormat !== 'hubspot') {
        const currentSettings = userSettings || {};
        const updatedSettings = { ...currentSettings, format: selectedFormat };

@@ -142,239 +151,269 @@ const ExportModal: React.FC<ExportModalProps> = ({
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
          <div className="p-4">
            {loadingSettings ? (
              <div className="text-center py-6">
                <Loader className={`h-6 w-6 animate-spin mx-auto ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Loading export preferences...
                </p>
              </div>
            ) : (
              <>
                {/* Format Selection */}
                <div className="space-y-2 mb-4">
                  <label className={`block text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    📄 Select Export Destination
                  </label>
                  
                  {getFormatOptions().map((format) => (
                    <motion.button
                      key={format.value}
                      onClick={() => setSelectedFormat(format.value)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-left ${
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
                              {format.value === 'hubspot' && (
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

                {/* HubSpot Notice if not connected */}
                {!hubspotConnected && !checkingHubspot && (
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
                          🟠 HubSpot Integration
                        </h5>
                        <p className={`text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Connect HubSpot in{' '}
                          <span className="font-medium text-orange-500">Integrations</span>{' '}
                          to export directly to your CRM
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

          {/* Footer */}
          <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
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
                  selectedFormat === 'hubspot'
                    ? isDark
                      ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600'
                      : 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600'
                    : isDark
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                      : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
                } text-white shadow-lg hover:shadow-xl`}
              >
                {exporting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                    {selectedFormat === 'hubspot' ? 'Syncing...' : 'Exporting...'}
                  </>
                ) : (
                  <>
                    {selectedFormat === 'hubspot' ? (
                      <ExternalLink className="h-4 w-4 mr-2 inline" />
                    ) : (
                      <Download className="h-4 w-4 mr-2 inline" />
                    )}
                    {selectedFormat === 'hubspot' 
                      ? 'Export to HubSpot' 
                      : `Export ${selectedFormat.toUpperCase()}`
                    }
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

