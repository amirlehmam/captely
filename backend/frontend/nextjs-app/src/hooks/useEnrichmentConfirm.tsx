import React, { useState } from 'react';
import EnrichmentConfirmModal, { EnrichmentType } from '../components/modals/EnrichmentConfirmModal';

interface UseEnrichmentConfirmOptions {
  fileName?: string;
}

export const useEnrichmentConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | undefined>();
  const [resolveCallback, setResolveCallback] = useState<((value: EnrichmentType | null) => void) | null>(null);

  const confirm = (fileNameParam?: string): Promise<EnrichmentType | null> => {
    console.log('🔥 Opening enrichment modal for:', fileNameParam);
    setFileName(fileNameParam);
    setIsOpen(true);
    
    return new Promise<EnrichmentType | null>((resolve) => {
      setResolveCallback(() => resolve);
    });
  };

  const handleConfirm = (enrichmentType: EnrichmentType) => {
    console.log('✅ Enrichment confirmed:', enrichmentType);
    setIsOpen(false);
    if (resolveCallback) {
      resolveCallback(enrichmentType);
      setResolveCallback(null);
    }
  };

  const handleCancel = () => {
    console.log('❌ Enrichment cancelled');
    setIsOpen(false);
    if (resolveCallback) {
      resolveCallback(null);
      setResolveCallback(null);
    }
  };

  const EnrichmentConfirmDialog = () => {
    console.log('🎨 Rendering modal - isOpen:', isOpen, 'fileName:', fileName);
    return (
      <EnrichmentConfirmModal
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        fileName={fileName}
      />
    );
  };

  return {
    confirm,
    EnrichmentConfirmDialog
  };
};

export default useEnrichmentConfirm; 