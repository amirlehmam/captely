import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, Zap, CheckCircle, AlertCircle } from 'lucide-react';

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
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg mr-3">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    📤 IMPORT CSV & SCRAPING
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Le traitement n'est plus automatique à l'import
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {fileName && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium text-blue-900">
                    Fichier sélectionné: {fileName}
                  </span>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-900 mb-4">
                Souhaitez-vous enrichir avec :
              </h4>
              
              <div className="space-y-3">
                {/* Email Option */}
                <label className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  enrichmentType.email 
                    ? 'border-green-300 bg-green-50 shadow-sm' 
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={enrichmentType.email}
                    onChange={() => handleCheckboxChange('email')}
                    className="sr-only"
                  />
                  <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                    enrichmentType.email 
                      ? 'bg-green-500 border-green-500' 
                      : 'border-gray-300'
                  }`}>
                    {enrichmentType.email && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="flex items-center flex-1">
                    <Mail className={`h-5 w-5 mr-3 ${
                      enrichmentType.email ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <span className={`font-medium ${
                        enrichmentType.email ? 'text-green-900' : 'text-gray-700'
                      }`}>
                        ☑️ Email
                      </span>
                      <p className={`text-sm ${
                        enrichmentType.email ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        Rechercher et vérifier les adresses email
                      </p>
                    </div>
                  </div>
                </label>

                {/* Phone Option */}
                <label className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  enrichmentType.phone 
                    ? 'border-blue-300 bg-blue-50 shadow-sm' 
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={enrichmentType.phone}
                    onChange={() => handleCheckboxChange('phone')}
                    className="sr-only"
                  />
                  <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                    enrichmentType.phone 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'border-gray-300'
                  }`}>
                    {enrichmentType.phone && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="flex items-center flex-1">
                    <Phone className={`h-5 w-5 mr-3 ${
                      enrichmentType.phone ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <span className={`font-medium ${
                        enrichmentType.phone ? 'text-blue-900' : 'text-gray-700'
                      }`}>
                        ☑️ Téléphone
                      </span>
                      <p className={`text-sm ${
                        enrichmentType.phone ? 'text-blue-700' : 'text-gray-500'
                      }`}>
                        Rechercher et vérifier les numéros de téléphone
                      </p>
                    </div>
                  </div>
                </label>

                {/* Both Selected Indicator */}
                {enrichmentType.email && enrichmentType.phone && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center">
                      <Zap className="h-4 w-4 text-purple-600 mr-2" />
                      <span className="text-sm font-medium text-purple-900">
                        ☑️ Les deux - Enrichissement complet activé
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Warning if nothing selected */}
            {!hasSelection && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-sm font-medium text-red-900">
                    Veuillez sélectionner au moins une option d'enrichissement
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!hasSelection}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  hasSelection
                    ? 'text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                }`}
              >
                Démarrer l'enrichissement
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default EnrichmentConfirmModal; 