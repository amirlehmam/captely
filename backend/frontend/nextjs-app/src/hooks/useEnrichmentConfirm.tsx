import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import EnrichmentConfirmModal, { EnrichmentType } from '../components/modals/EnrichmentConfirmModal';

interface UseEnrichmentConfirmOptions {
  fileName?: string;
}

export const useEnrichmentConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<UseEnrichmentConfirmOptions>({});
  const [resolveCallback, setResolveCallback] = useState<((value: EnrichmentType | null) => void) | null>(null);

  const confirm = (fileName?: string): Promise<EnrichmentType | null> => {
    setOptions({ fileName });
    setIsOpen(true);
    
    return new Promise<EnrichmentType | null>((resolve) => {
      setResolveCallback(() => resolve);
    });
  };

  const handleConfirm = (enrichmentType: EnrichmentType) => {
    setIsOpen(false);
    if (resolveCallback) {
      resolveCallback(enrichmentType);
      setResolveCallback(null);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolveCallback) {
      resolveCallback(null); // Return null when cancelled
      setResolveCallback(null);
    }
  };

  const EnrichmentConfirmDialog = () => (
    <AnimatePresence>
      {isOpen && (
        <EnrichmentConfirmModal
          isOpen={isOpen}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          fileName={options.fileName}
        />
      )}
    </AnimatePresence>
  );

  return {
    confirm,
    EnrichmentConfirmDialog
  };
};

export default useEnrichmentConfirm; 