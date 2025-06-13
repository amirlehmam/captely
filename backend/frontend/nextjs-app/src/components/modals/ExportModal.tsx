import React, { useState, useEffect } from 'react';
import { X, Download, FileDown, Code2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiService } from '../../services/api';

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
  
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json' | 'hubspot'>('csv');
  const [exporting, setExporting] = useState(false);
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHubSpotStatus = async () => {
      if (isOpen) {
        try {
          const hubspotStatus = await apiService.getHubSpotIntegrationStatus();
          setHubspotConnected(hubspotStatus.connected);
        } catch (error) {
          console.error('Error loading HubSpot status:', error);
          setHubspotConnected(false);
        } finally {
          setLoading(false);
        }
      }
    };

    loadHubSpotStatus();
  }, [isOpen]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await onExport(selectedFormat);
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className={`relative w-full max-w-md ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
              {description}
              {exportCount && <span className="ml-1">({exportCount} items)</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-md hover:bg-gray-100 ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'text-gray-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Loading export options...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                  Select Export Format
                </label>
                
                <div className="space-y-2">
                  {/* CSV Option */}
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${isDark ? 'hover:bg-gray-700 border-gray-600' : 'border-gray-200'} ${selectedFormat === 'csv' ? 'border-blue-500 bg-blue-50' : ''}`}>
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={selectedFormat === 'csv'}
                      onChange={(e) => setSelectedFormat(e.target.value as any)}
                      className="mr-3"
                    />
                    <FileDown className="w-5 h-5 text-green-600 mr-3" />
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>CSV</p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Comma-separated values</p>
                    </div>
                  </label>

                  {/* Excel Option */}
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${isDark ? 'hover:bg-gray-700 border-gray-600' : 'border-gray-200'} ${selectedFormat === 'excel' ? 'border-blue-500 bg-blue-50' : ''}`}>
                    <input
                      type="radio"
                      name="format"
                      value="excel"
                      checked={selectedFormat === 'excel'}
                      onChange={(e) => setSelectedFormat(e.target.value as any)}
                      className="mr-3"
                    />
                    <FileDown className="w-5 h-5 text-blue-600 mr-3" />
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Excel</p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Microsoft Excel spreadsheet</p>
                    </div>
                  </label>

                  {/* JSON Option */}
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${isDark ? 'hover:bg-gray-700 border-gray-600' : 'border-gray-200'} ${selectedFormat === 'json' ? 'border-blue-500 bg-blue-50' : ''}`}>
                    <input
                      type="radio"
                      name="format"
                      value="json"
                      checked={selectedFormat === 'json'}
                      onChange={(e) => setSelectedFormat(e.target.value as any)}
                      className="mr-3"
                    />
                    <Code2 className="w-5 h-5 text-purple-600 mr-3" />
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>JSON</p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>JavaScript Object Notation</p>
                    </div>
                  </label>

                  {/* HubSpot Option - Only show if connected */}
                  {hubspotConnected && (
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${isDark ? 'hover:bg-gray-700 border-gray-600' : 'border-gray-200'} ${selectedFormat === 'hubspot' ? 'border-orange-500 bg-orange-50' : ''}`}>
                      <input
                        type="radio"
                        name="format"
                        value="hubspot"
                        checked={selectedFormat === 'hubspot'}
                        onChange={(e) => setSelectedFormat(e.target.value as any)}
                        className="mr-3"
                      />
                      <ExternalLink className="w-5 h-5 text-orange-600 mr-3" />
                      <div>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>HubSpot CRM</p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Export directly to HubSpot</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`flex space-x-3 px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Cancel
          </button>
          
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-md ${
              exporting || loading
                ? 'bg-gray-400 cursor-not-allowed'
                : selectedFormat === 'hubspot'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {exporting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {selectedFormat === 'hubspot' ? 'Exporting to HubSpot...' : 'Exporting...'}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                {selectedFormat === 'hubspot' ? (
                  <ExternalLink className="w-4 h-4 mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {selectedFormat === 'hubspot' ? 'Export to HubSpot' : `Export ${selectedFormat.toUpperCase()}`}
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal; 