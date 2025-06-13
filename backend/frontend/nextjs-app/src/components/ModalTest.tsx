import React, { useState } from 'react';
import { useEnrichmentConfirm } from '../hooks/useEnrichmentConfirm';

const ModalTest: React.FC = () => {
  const { confirm, EnrichmentConfirmDialog } = useEnrichmentConfirm();
  
  const handleTestModal = async () => {
    console.log('🔥 Testing modal...');
    const result = await confirm('test-file.csv');
    console.log('🔥 Modal result:', result);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Modal Test Page</h1>
      <button 
        onClick={handleTestModal}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Test Modal
      </button>
      
      <EnrichmentConfirmDialog />
    </div>
  );
};

export default ModalTest; 