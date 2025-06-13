import React, { useState, useRef } from 'react';
import EnrichmentConfirmModal, { EnrichmentType } from '../components/modals/EnrichmentConfirmModal';

interface UseEnrichmentConfirmOptions {
  fileName?: string;
}

export const useEnrichmentConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | undefined>();
  const [resolveCallback, setResolveCallback] = useState<((value: EnrichmentType | null) => void) | null>(null);
  
  // Prevent multiple simultaneous calls
  const isProcessingRef = useRef(false);
  const lastCallRef = useRef(0);

  const confirm = (fileNameParam?: string): Promise<EnrichmentType | null> => {
    const now = Date.now();
    
    // Debounce: Prevent calls within 500ms of each other
    if (now - lastCallRef.current < 500) {
      console.log('🚫 Debounced: Too soon after last call');
      return Promise.resolve(null);
    }
    
    // Prevent multiple simultaneous modal instances
    if (isProcessingRef.current || isOpen) {
      console.log('🚫 Modal already open or processing');
      return Promise.resolve(null);
    }
    
    lastCallRef.current = now;
    isProcessingRef.current = true;
    
    console.log('🔥 Opening enrichment modal for:', fileNameParam);
    setFileName(fileNameParam);
    setIsOpen(true);
    
    return new Promise<EnrichmentType | null>((resolve) => {
      setResolveCallback(() => resolve);
    });
  };

  const handleConfirm = (enrichmentType: EnrichmentType) => {
    console.log('✅ Modal confirmed with:', enrichmentType);
    setIsOpen(false);
    isProcessingRef.current = false;
    
    if (resolveCallback) {
      resolveCallback(enrichmentType);
      setResolveCallback(null);
    }
  };

  const handleClose = () => {
    console.log('❌ Modal closed/cancelled');
    setIsOpen(false);
    isProcessingRef.current = false;
    
    if (resolveCallback) {
      resolveCallback(null);
      setResolveCallback(null);
    }
  };

  const EnrichmentConfirmDialog = () => (
    <EnrichmentConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      fileName={fileName}
    />
  );

  return {
    confirm,
    EnrichmentConfirmDialog,
    isOpen // Expose for debugging
  };
};

export default useEnrichmentConfirm; 