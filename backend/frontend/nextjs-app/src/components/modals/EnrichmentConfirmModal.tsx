import React, { useState } from 'react';
import { X, Mail, Phone, CheckCircle } from 'lucide-react';
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
    if (!enrichmentType.email && !enrichmentType.phone) {
      return;
    }
    onConfirm(enrichmentType);
  };

  const handleCheckboxChange = (type: 'email' | 'phone') => {
    setEnrichmentType(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Simple backdrop */}
      <div 
        className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-80"
        style={{ zIndex: 999999 }}
        onClick={onClose}
      />
      
      {/* Simple modal */}
      <div 
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 max-w-full"
        style={{ zIndex: 999999 }}
      >
        <div className={`rounded-lg shadow-xl p-6 ${
          isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        }`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Choose Enrichment Options</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* File name */}
          {fileName && (
            <div className={`mb-4 p-3 rounded ${
              isDark ? 'bg-blue-900/20' : 'bg-blue-50'
            }`}>
              <p className="text-sm">File: {fileName}</p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3 mb-6">
            {/* Email Option */}
            <label className={`flex items-center p-3 border rounded cursor-pointer ${
              enrichmentType.email 
                ? isDark ? 'border-green-500 bg-green-900/20' : 'border-green-500 bg-green-50'
                : isDark ? 'border-gray-600' : 'border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={enrichmentType.email}
                onChange={() => handleCheckboxChange('email')}
                className="mr-3"
              />
              <Mail className="h-5 w-5 mr-2" />
              <div>
                <div className="font-medium">Email Enrichment</div>
                <div className="text-sm opacity-75">Find and verify email addresses</div>
              </div>
            </label>

            {/* Phone Option */}
            <label className={`flex items-center p-3 border rounded cursor-pointer ${
              enrichmentType.phone 
                ? isDark ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50'
                : isDark ? 'border-gray-600' : 'border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={enrichmentType.phone}
                onChange={() => handleCheckboxChange('phone')}
                className="mr-3"
              />
              <Phone className="h-5 w-5 mr-2" />
              <div>
                <div className="font-medium">Phone Enrichment</div>
                <div className="text-sm opacity-75">Find and verify phone numbers</div>
              </div>
            </label>
          </div>

          {/* Warning */}
          {!enrichmentType.email && !enrichmentType.phone && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              Please select at least one enrichment option
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded ${
                isDark 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!enrichmentType.email && !enrichmentType.phone}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Enrichment
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EnrichmentConfirmModal; 