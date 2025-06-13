import React, { useState, useRef } from 'react';
import EnrichmentConfirmModal, { EnrichmentType } from '../components/modals/EnrichmentConfirmModal';

interface UseEnrichmentConfirmOptions {
  fileName?: string;
}

export const useEnrichmentConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | undefined>();
  const [resolveCallback, setResolveCallback] = useState<((value: EnrichmentType | null) => void) | null>(null);
  
  // Prevent multiple simultaneous calls and infinite loops
  const isProcessingRef = useRef(false);
  const lastCallRef = useRef(0);
  const mountedRef = useRef(true);

  const confirm = (fileNameParam?: string): Promise<EnrichmentType | null> => {
    const now = Date.now();
    
    // Safety check: Component must be mounted
    if (!mountedRef.current) {
      console.log('🚫 Component unmounted, aborting modal');
      return Promise.resolve(null);
    }
    
    // Debounce: Prevent calls within 1000ms of each other (increased from 500ms)
    if (now - lastCallRef.current < 1000) {
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
    
    // Safety check: Component must be mounted
    if (!mountedRef.current) {
      console.log('🚫 Component unmounted during confirm');
      return;
    }
    
    setIsOpen(false);
    isProcessingRef.current = false;
    
    if (resolveCallback) {
      resolveCallback(enrichmentType);
      setResolveCallback(null);
    }
  };

  const handleClose = () => {
    console.log('❌ Modal closed/cancelled');
    
    // Safety check: Component must be mounted
    if (!mountedRef.current) {
      console.log('🚫 Component unmounted during close');
      return;
    }
    
    setIsOpen(false);
    isProcessingRef.current = false;
    
    if (resolveCallback) {
      resolveCallback(null);
      setResolveCallback(null);
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isProcessingRef.current = false;
    };
  }, []);

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