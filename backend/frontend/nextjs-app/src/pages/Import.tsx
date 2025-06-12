import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  Download,
  Users,
  Mail,
  Phone,
  X,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  ArrowRight,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Plus,
  UserPlus,
  Building,
  Trash2,
  Edit3
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// Enhanced notification system
import { showManualImportStarted, showError } from '../components/notifications/NotificationManager';

// Updated hooks for production
import { useFileUpload, useJobs, useJob } from '../hooks/useApi';
import { useEnrichmentConfirm } from '../hooks/useEnrichmentConfirm';
import { EnrichmentType } from '../components/modals/EnrichmentConfirmModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

// Type for manual contacts
interface ManualContact {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  position?: string;
  location?: string;
  industry?: string;
}

const ImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, formatMessage } = useLanguage();
  const { isDark } = useTheme();
  
  // File upload state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  // Manual contact entry state
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [currentContact, setCurrentContact] = useState<Partial<ManualContact>>({
    first_name: '',
    last_name: '',
    company: '',
    position: '',
    location: '',
    industry: ''
  });
  const [manualContactErrors, setManualContactErrors] = useState<string[]>([]);
  const [isStartingManualEnrichment, setIsStartingManualEnrichment] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  
  // Hooks
  const { uploadFile, uploading, progress, error: uploadError, reset } = useFileUpload();
  const { jobs, loading: jobsLoading, refetch: refetchJobs } = useJobs();
  const { job: currentJob, loading: jobLoading } = useJob(currentJobId);
  const { confirm, EnrichmentConfirmDialog } = useEnrichmentConfirm();

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Reset states when component mounts
  useEffect(() => {
    reset();
    setUploadSuccess(false);
    setCurrentJobId(null);
    setValidationErrors([]);
  }, [reset]);

  // File validation
  const validateFile = useCallback((file: File): string[] => {
    const errors: string[] = [];
    
    // Check file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const isValidType = allowedTypes.includes(file.type) || 
                       file.name.toLowerCase().endsWith('.csv') || 
                       file.name.toLowerCase().endsWith('.xlsx') ||
                       file.name.toLowerCase().endsWith('.xls');
    
    if (!isValidType) {
      errors.push(t('import.validation.csvOrExcel'));
    }
    
    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      errors.push(t('import.validation.maxSize'));
    }
    
    // Check if file is not empty
    if (file.size === 0) {
      errors.push(t('import.validation.notEmpty'));
    }
    
    return errors;
  }, [t]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setValidationErrors([]);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const errors = validateFile(file);
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }
      
      setSelectedFile(file);
    }
  }, [validateFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationErrors([]);
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const errors = validateFile(file);
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        e.target.value = ''; // Clear the input
        return;
      }
      
      setSelectedFile(file);
    }
  }, [validateFile]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      // Show enrichment confirmation modal
      const enrichmentType = await confirm(selectedFile.name);
      
      // If user cancelled the modal, enrichmentType will be null
      if (!enrichmentType) {
        return;
      }

      // Proceed with upload using selected enrichment type
      const result = await uploadFile(selectedFile, enrichmentType);
      setCurrentJobId(result.job_id);
      setUploadSuccess(true);
      setSelectedFile(null);
      refetchJobs(); // Refresh the jobs list
      
      // Auto-navigate to batches page after 3 seconds
      setTimeout(() => {
        navigate(`/batches`);
      }, 3000);
      
    } catch (err) {
      console.error('Upload failed:', err);
      // Error is already handled by the hook and API service
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadSuccess(false);
    setCurrentJobId(null);
    setValidationErrors([]);
    reset();
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      ['first_name', 'last_name', 'company', 'position', 'profile_url', 'location', 'industry'],
      ['John', 'Doe', 'TechCorp Inc', 'CEO', 'https://linkedin.com/in/johndoe', 'San Francisco, CA', 'Technology'],
      ['Jane', 'Smith', 'MarketCorp', 'VP Marketing', 'https://linkedin.com/in/janesmith', 'New York, NY', 'Marketing'],
      ['Mike', 'Johnson', 'SalesCorp', 'Sales Director', '', 'Chicago, IL', 'Sales'],
      ['Sarah', 'Wilson', 'DataCorp', 'Data Scientist', 'https://linkedin.com/in/sarahwilson', 'Austin, TX', 'Technology']
    ];
    
    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captely_sample_contacts.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success(t('success.fileUploaded'));
  };

  // Manual contact functions
  const validateManualContact = (contact: Partial<ManualContact>): string[] => {
    const errors: string[] = [];
    
    if (!contact.first_name?.trim()) {
      errors.push(t('import.manual.validation.firstName'));
    }
    if (!contact.last_name?.trim()) {
      errors.push(t('import.manual.validation.lastName'));
    }
    if (!contact.company?.trim()) {
      errors.push(t('import.manual.validation.company'));
    }
    
    return errors;
  };

  const addManualContact = () => {
    const errors = validateManualContact(currentContact);
    setManualContactErrors(errors);
    
    if (errors.length > 0) {
      return;
    }
    
    const newContact: ManualContact = {
      id: Date.now().toString(),
      first_name: currentContact.first_name!.trim(),
      last_name: currentContact.last_name!.trim(),
      company: currentContact.company!.trim(),
      position: currentContact.position?.trim() || '',
      location: currentContact.location?.trim() || '',
      industry: currentContact.industry?.trim() || ''
    };
    
    setManualContacts(prev => [...prev, newContact]);
    setCurrentContact({
      first_name: '',
      last_name: '',
      company: '',
      position: '',
      location: '',
      industry: ''
    });
    setManualContactErrors([]);
    
    toast.success(t('import.manual.contactAdded'));
  };

  const removeManualContact = (id: string) => {
    setManualContacts(prev => prev.filter(contact => contact.id !== id));
    toast.success(t('import.manual.contactRemoved'));
  };

  const clearAllManualContacts = () => {
    setManualContacts([]);
    toast.success(t('import.manual.allContactsCleared'));
  };

  const startManualEnrichment = async () => {
    if (manualContacts.length === 0) {
      toast.error(t('import.manual.noContactsToEnrich'));
      return;
    }

    try {
      setIsStartingManualEnrichment(true);
      
      // Show enrichment confirmation modal
      const enrichmentType = await confirm(`${manualContacts.length} manually added contacts`);
      
      if (!enrichmentType) {
        setIsStartingManualEnrichment(false);
        return;
      }

      // Send manual contacts to backend for enrichment
      const response = await fetch('/api/import/imports/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt')}`
        },
        body: JSON.stringify({
          contacts: manualContacts,
          enrichment_config: enrichmentType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start manual enrichment');
      }

      const result = await response.json();
      setCurrentJobId(result.job_id);
      setUploadSuccess(true);
      setManualContacts([]);
      refetchJobs();
      
      showManualImportStarted(manualContacts.length);
      
      // Auto-navigate to batches page after 3 seconds
      setTimeout(() => {
        navigate(`/batches`);
      }, 3000);
      
    } catch (error) {
      console.error('Manual enrichment failed:', error);
      showError(
        'Manual Import Failed ❌',
        'Failed to start enrichment for manually added contacts. Please try again.'
      );
    } finally {
      setIsStartingManualEnrichment(false);
    }
  };

  // Calculate recent stats
  const recentJobs = jobs.slice(0, 5);
  const totalContactsProcessed = jobs.reduce((sum, job) => sum + job.completed, 0);
  const avgSuccessRate = jobs.length > 0 
    ? jobs.reduce((sum, job) => sum + (job.success_rate || 0), 0) / jobs.length 
    : 0;
  
  return (
    <div className={`min-h-screen transition-all duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Enrichment Confirmation Modal */}
      <EnrichmentConfirmDialog />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('import.title')}
        </h1>
        <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {t('import.subtitle')}
        </p>
      </motion.div>

      {/* Quick Stats */}
      {jobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <motion.div 
            whileHover={{ scale: 1.02, y: -4 }}
            className={`rounded-xl p-6 border shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-700/50 hover:shadow-blue-500/20' 
                : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-blue-500/20'
            }`}
          >
            <div className="flex items-center">
              <Users className={`h-8 w-8 mr-3 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{t('import.stats.totalProcessed')}</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>{totalContactsProcessed.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.02, y: -4 }}
            className={`rounded-xl p-6 border shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-700/50 hover:shadow-green-500/20' 
                : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-green-500/20'
            }`}
          >
            <div className="flex items-center">
              <TrendingUp className={`h-8 w-8 mr-3 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-700'}`}>{t('import.stats.avgSuccessRate')}</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-green-100' : 'text-green-900'}`}>{(avgSuccessRate || 0).toFixed(1)}%</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.02, y: -4 }}
            className={`rounded-xl p-6 border shadow-lg transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-700/50 hover:shadow-purple-500/20' 
                : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-purple-500/20'
            }`}
          >
            <div className="flex items-center">
              <BarChart3 className={`h-8 w-8 mr-3 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{t('import.stats.totalBatches')}</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-purple-100' : 'text-purple-900'}`}>{jobs.length}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Tabs for Upload vs Manual Entry */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-xl shadow-lg border overflow-hidden transition-all duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
            : 'bg-white border-gray-100 shadow-gray-200/50'
        }`}
      >
        {/* Tab Navigation */}
        <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <nav className="flex space-x-8 px-8 pt-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'upload'
                  ? isDark
                    ? 'border-primary-400 text-primary-400'
                    : 'border-primary-500 text-primary-600'
                  : isDark
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Upload className="h-4 w-4 mr-2" />
                {t('import.tabs.fileUpload')}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'manual'
                  ? isDark
                    ? 'border-primary-400 text-primary-400'
                    : 'border-primary-500 text-primary-600'
                  : isDark
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <UserPlus className="h-4 w-4 mr-2" />
                {t('import.tabs.manualEntry')}
                {manualContacts.length > 0 && (
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-800'
                  }`}>
                    {manualContacts.length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {!uploadSuccess ? (
            <>
              {/* File Upload Tab */}
              {activeTab === 'upload' && (
                <>
                  {/* Validation Errors */}
              <AnimatePresence>
                {validationErrors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mb-6 border rounded-xl p-4 ${
                      isDark 
                        ? 'bg-red-900/20 border-red-700/50' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                      <div>
                        <h4 className={`text-sm font-semibold ${
                          isDark ? 'text-red-300' : 'text-red-800'
                        }`}>
                          {t('import.validation.title')}
                        </h4>
                        <ul className={`mt-2 text-sm list-disc list-inside ${
                          isDark ? 'text-red-400' : 'text-red-700'
                        }`}>
                          {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                  dragActive
                    ? isDark 
                      ? 'border-primary-400 bg-primary-900/20 shadow-lg shadow-primary-500/20' 
                      : 'border-primary-500 bg-primary-50 shadow-md'
                    : selectedFile
                    ? isDark
                      ? 'border-green-400 bg-green-900/20 shadow-lg shadow-green-500/20'
                      : 'border-green-500 bg-green-50 shadow-md'
                    : validationErrors.length > 0
                    ? isDark
                      ? 'border-red-400 bg-red-900/20'
                      : 'border-red-300 bg-red-50'
                    : isDark
                    ? 'border-gray-600 hover:border-primary-400 hover:bg-gray-700/50'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      {selectedFile.name.toLowerCase().endsWith('.csv') ? (
                        <FileText className="h-16 w-16 text-green-500" />
                      ) : (
                        <FileSpreadsheet className="h-16 w-16 text-green-500" />
                      )}
                    </div>
                    <div>
                      <p className={`text-xl font-semibold ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {selectedFile.name}
                      </p>
                      <p className={`text-sm mt-1 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <p className={`text-xs mt-1 ${
                        isDark ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {selectedFile.type || 'File type detected'}
                      </p>
                    </div>
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-all duration-200"
                      >
                        {uploading ? (
                          <>
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                            {t('import.upload.uploading')}
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {t('import.buttons.startEnrichment')}
                          </>
                        )}
                      </button>
                      <button
                        onClick={clearFile}
                        disabled={uploading}
                        className={`inline-flex items-center px-6 py-3 border text-sm font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 ${
                          isDark 
                            ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-offset-gray-800' 
                            : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t('import.buttons.removeFile')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <Upload className={`h-16 w-16 ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className={`text-xl font-semibold ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {t('import.dropzone.title')}
                      </p>
                      <p className={`text-sm mt-2 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {t('import.dropzone.subtitle')}
                      </p>
                      <p className={`text-xs mt-1 ${
                        isDark ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {t('import.dropzone.fileTypes')}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 cursor-pointer transition-all duration-200"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {t('common.browse')}
                    </label>
                  </div>
                )}
              </div>
              
              {/* Upload Progress */}
              <AnimatePresence>
                {uploading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-8"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-sm font-semibold ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {t('import.upload.uploading')}
                      </span>
                      <span className="text-sm font-semibold text-primary-500">
                        {progress}%
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-3 overflow-hidden ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <motion.div
                        className="bg-gradient-to-r from-primary-500 to-primary-400 h-3 rounded-full shadow-sm"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className={`text-xs mt-2 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {t('import.upload.progress')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Display */}
              <AnimatePresence>
                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mt-8 border rounded-xl p-4 ${
                      isDark 
                        ? 'bg-red-900/20 border-red-700/50' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                        <span className={isDark ? 'text-red-300' : 'text-red-700'}>
                          {formatMessage('import.upload.error', { error: uploadError })}
                        </span>
                      </div>
                      <button
                        onClick={() => reset()}
                        className={`text-sm font-medium transition-colors ${
                          isDark 
                            ? 'text-red-400 hover:text-red-300' 
                            : 'text-red-600 hover:text-red-800'
                        }`}
                      >
                        {t('common.retry')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
                </>
              )}

              {/* Manual Entry Tab */}
              {activeTab === 'manual' && (
                <>
                  {/* Manual Contact Validation Errors */}
                  <AnimatePresence>
                    {manualContactErrors.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`mb-6 border rounded-xl p-4 ${
                          isDark 
                            ? 'bg-red-900/20 border-red-700/50' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                          <div>
                            <h4 className={`text-sm font-semibold ${
                              isDark ? 'text-red-300' : 'text-red-800'
                            }`}>
                              {t('import.manual.validation.title')}
                            </h4>
                            <ul className={`mt-2 text-sm list-disc list-inside ${
                              isDark ? 'text-red-400' : 'text-red-700'
                            }`}>
                              {manualContactErrors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Manual Entry Form */}
                  <div className={`border-2 border-dashed rounded-xl p-8 ${
                    isDark 
                      ? 'border-gray-600 bg-gray-700/50' 
                      : 'border-gray-300 bg-gray-50'
                  }`}>
                    <div className="text-center mb-6">
                      <UserPlus className={`h-12 w-12 mx-auto mb-3 ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                      <h3 className={`text-lg font-semibold ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {t('import.manual.title')}
                      </h3>
                      <p className={`text-sm mt-1 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {t('import.manual.subtitle')}
                      </p>
                    </div>

                    {/* Contact Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {t('import.manual.form.firstName')} *
                        </label>
                        <input
                          type="text"
                          value={currentContact.first_name || ''}
                          onChange={(e) => setCurrentContact(prev => ({ ...prev, first_name: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            isDark 
                              ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder="John"
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {t('import.manual.form.lastName')} *
                        </label>
                        <input
                          type="text"
                          value={currentContact.last_name || ''}
                          onChange={(e) => setCurrentContact(prev => ({ ...prev, last_name: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            isDark 
                              ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder="Doe"
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {t('import.manual.form.company')} *
                        </label>
                        <input
                          type="text"
                          value={currentContact.company || ''}
                          onChange={(e) => setCurrentContact(prev => ({ ...prev, company: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            isDark 
                              ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder="TechCorp Inc"
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {t('import.manual.form.position')}
                        </label>
                        <input
                          type="text"
                          value={currentContact.position || ''}
                          onChange={(e) => setCurrentContact(prev => ({ ...prev, position: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            isDark 
                              ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder="CEO"
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {t('import.manual.form.location')}
                        </label>
                        <input
                          type="text"
                          value={currentContact.location || ''}
                          onChange={(e) => setCurrentContact(prev => ({ ...prev, location: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            isDark 
                              ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder="San Francisco, CA"
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {t('import.manual.form.industry')}
                        </label>
                        <input
                          type="text"
                          value={currentContact.industry || ''}
                          onChange={(e) => setCurrentContact(prev => ({ ...prev, industry: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            isDark 
                              ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder="Technology"
                        />
                      </div>
                    </div>

                    {/* Add Contact Button */}
                    <div className="text-center">
                      <button
                        onClick={addManualContact}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('import.manual.buttons.addContact')}
                      </button>
                    </div>
                  </div>

                  {/* Manual Contacts List */}
                  {manualContacts.length > 0 && (
                    <div className="mt-8">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className={`text-lg font-semibold ${
                          isDark ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {formatMessage('import.manual.contactsAdded', { count: manualContacts.length })}
                        </h4>
                        <button
                          onClick={clearAllManualContacts}
                          className={`text-sm font-medium transition-colors ${
                            isDark 
                              ? 'text-red-400 hover:text-red-300' 
                              : 'text-red-600 hover:text-red-800'
                          }`}
                        >
                          {t('import.manual.buttons.clearAll')}
                        </button>
                      </div>

                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {manualContacts.map((contact) => (
                          <motion.div
                            key={contact.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`flex items-center justify-between p-4 border rounded-lg ${
                              isDark 
                                ? 'bg-gray-700 border-gray-600' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                                isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-700'
                              }`}>
                                <Users className="h-5 w-5" />
                              </div>
                              <div>
                                <p className={`font-medium ${
                                  isDark ? 'text-gray-100' : 'text-gray-900'
                                }`}>
                                  {contact.first_name} {contact.last_name}
                                </p>
                                <p className={`text-sm ${
                                  isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  {contact.company}
                                  {contact.position && ` • ${contact.position}`}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeManualContact(contact.id)}
                              className={`p-2 rounded-full transition-colors ${
                                isDark 
                                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20' 
                                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </motion.div>
                        ))}
                      </div>

                      {/* Start Enrichment Button */}
                      <div className="mt-6 text-center">
                        <button
                          onClick={startManualEnrichment}
                          disabled={isStartingManualEnrichment}
                          className="inline-flex items-center px-8 py-3 border border-transparent text-base font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-all duration-200"
                        >
                          {isStartingManualEnrichment ? (
                            <>
                              <Loader className="h-5 w-5 mr-2 animate-spin" />
                              {t('import.manual.buttons.startingEnrichment')}
                            </>
                          ) : (
                            <>
                              <ArrowRight className="h-5 w-5 mr-2" />
                              {formatMessage('import.manual.buttons.startEnrichment', { count: manualContacts.length })}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* Success State */
            <div className="text-center space-y-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
              >
                <CheckCircle className="h-20 w-20 text-green-500 mx-auto" />
              </motion.div>
              
              <div>
                <h3 className={`text-2xl font-bold ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {t('import.upload.success.title')}
                </h3>
                <p className={`mt-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {t('import.upload.success.subtitle')}
                </p>
              </div>
              
              {/* Job Progress (if available) */}
              {currentJob && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-6 border ${
                    isDark 
                      ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-700/50' 
                      : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className={`text-2xl font-bold ${
                        isDark ? 'text-blue-300' : 'text-blue-900'
                      }`}>
                        {currentJob.total}
                      </div>
                      <div className={`text-sm font-medium ${
                        isDark ? 'text-blue-400' : 'text-blue-700'
                      }`}>{t('batches.table.contacts')}</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${
                        isDark ? 'text-green-300' : 'text-green-900'
                      }`}>
                        {currentJob.completed}
                      </div>
                      <div className={`text-sm font-medium ${
                        isDark ? 'text-green-400' : 'text-green-700'
                      }`}>Processed</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${
                        isDark ? 'text-purple-300' : 'text-purple-900'
                      }`}>
                        {(currentJob.progress || 0).toFixed(1)}%
                      </div>
                      <div className={`text-sm font-medium ${
                        isDark ? 'text-purple-400' : 'text-purple-700'
                      }`}>{t('batches.table.progress')}</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${
                        isDark ? 'text-yellow-300' : 'text-yellow-900'
                      }`}>
                        {(currentJob.status || 'unknown').charAt(0).toUpperCase() + (currentJob.status || 'unknown').slice(1)}
                      </div>
                      <div className={`text-sm font-medium ${
                        isDark ? 'text-yellow-400' : 'text-yellow-700'
                      }`}>{t('batches.table.status')}</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className={`w-full rounded-full h-2 ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${currentJob.progress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex justify-center space-x-4">
                <Link
                  to="/batches"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 transition-all duration-200"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {t('import.buttons.viewProgress')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
                
                <button
                  onClick={() => {
                    setUploadSuccess(false);
                    setCurrentJobId(null);
                  }}
                  className={`inline-flex items-center px-6 py-3 border text-sm font-semibold rounded-lg transition-all duration-200 ${
                    isDark 
                      ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600' 
                      : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('import.buttons.uploadAnother')}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={`border rounded-xl p-8 ${
          isDark 
            ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-700/50' 
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
        }`}
      >
        <h3 className={`text-lg font-bold mb-6 ${
          isDark ? 'text-blue-300' : 'text-blue-900'
        }`}>
          {t('import.requirements.title')}
        </h3>
        <div className="space-y-4">
          <p className={`font-medium ${
            isDark ? 'text-blue-400' : 'text-blue-800'
          }`}>
            {t('import.requirements.subtitle')}
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className={`rounded-lg p-4 border ${
              isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-blue-200'
            }`}>
              <h4 className={`font-semibold mb-3 flex items-center ${
                isDark ? 'text-gray-200' : 'text-blue-900'
              }`}>
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                {t('import.requirements.required')}
              </h4>
              <ul className={`list-disc list-inside text-sm space-y-1 ${
                isDark ? 'text-gray-300' : 'text-blue-800'
              }`}>
                <li><code className={`px-1 rounded ${
                  isDark ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>first_name</code></li>
                <li><code className={`px-1 rounded ${
                  isDark ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>last_name</code></li>
                <li><code className={`px-1 rounded ${
                  isDark ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>company</code></li>
              </ul>
            </div>
            <div className={`rounded-lg p-4 border ${
              isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-blue-200'
            }`}>
              <h4 className={`font-semibold mb-3 flex items-center ${
                isDark ? 'text-gray-200' : 'text-blue-900'
              }`}>
                <Clock className="h-4 w-4 text-yellow-500 mr-2" />
                {t('import.requirements.optional')}
              </h4>
              <ul className={`list-disc list-inside text-sm space-y-1 ${
                isDark ? 'text-gray-300' : 'text-blue-800'
              }`}>
                <li><code className={`px-1 rounded ${
                  isDark ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>position</code></li>
                <li><code className={`px-1 rounded ${
                  isDark ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>profile_url</code> (LinkedIn URL)</li>
                <li><code className={`px-1 rounded ${
                  isDark ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>location</code></li>
                <li><code className={`px-1 rounded ${
                  isDark ? 'bg-gray-700 text-gray-200' : 'bg-blue-100 text-blue-800'
                }`}>industry</code></li>
              </ul>
            </div>
          </div>
          <div className="pt-4">
            <button
              onClick={downloadSampleCSV}
              className={`inline-flex items-center px-4 py-2 border text-sm font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                isDark 
                  ? 'border-blue-600 text-blue-300 bg-blue-900/20 hover:bg-blue-800/30 focus:ring-blue-500 focus:ring-offset-gray-800' 
                  : 'border-blue-300 text-blue-700 bg-white hover:bg-blue-50 focus:ring-blue-500'
              }`}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('import.requirements.downloadSample')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className={`rounded-xl shadow-lg border overflow-hidden transition-all duration-300 ${
            isDark 
              ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
              : 'bg-white border-gray-100 shadow-gray-200/50'
          }`}
        >
          <div className={`px-8 py-6 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-bold ${
                isDark ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {t('import.recentJobs.title')}
              </h3>
              <Link
                to="/batches"
                className={`text-sm font-medium flex items-center transition-colors ${
                  isDark 
                    ? 'text-primary-400 hover:text-primary-300' 
                    : 'text-primary-600 hover:text-primary-700'
                }`}
              >
                {t('import.recentJobs.viewAll')}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
          </div>
          <div className="p-8">
            <div className="space-y-6">
              {recentJobs.map((job) => {
                const getStatusBadge = (status: string) => {
                  if (isDark) {
                    switch (status) {
                      case 'completed':
                        return 'bg-green-900/30 text-green-300 border-green-700/50';
                      case 'processing':
                        return 'bg-blue-900/30 text-blue-300 border-blue-700/50';
                      case 'failed':
                        return 'bg-red-900/30 text-red-300 border-red-700/50';
                      case 'pending':
                        return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50';
                      default:
                        return 'bg-gray-700 text-gray-300 border-gray-600';
                    }
                  } else {
                  switch (status) {
                    case 'completed':
                      return 'bg-green-100 text-green-800 border-green-200';
                    case 'processing':
                      return 'bg-blue-100 text-blue-800 border-blue-200';
                    case 'failed':
                      return 'bg-red-100 text-red-800 border-red-200';
                    case 'pending':
                      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    default:
                      return 'bg-gray-100 text-gray-800 border-gray-200';
                    }
                  }
                };
                
                return (
                  <motion.div 
                    key={job.id} 
                    className={`border rounded-xl p-6 transition-all duration-200 ${
                      isDark 
                        ? 'border-gray-700 hover:shadow-lg hover:shadow-gray-900/30 hover:border-gray-600' 
                        : 'border-gray-200 hover:shadow-md hover:border-gray-300'
                    }`}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className={`font-semibold flex items-center ${
                          isDark ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          <FileText className={`h-4 w-4 mr-2 ${
                            isDark ? 'text-gray-500' : 'text-gray-400'
                          }`} />
                          {job.file_name || `Job ${job.id.substring(0, 8)}`}
                        </h4>
                        <p className={`text-sm mt-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(job.status)}`}>
                        {(job.status || 'unknown').charAt(0).toUpperCase() + (job.status || 'unknown').slice(1)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className={`font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>{t('import.recentJobs.progress')}</span>
                        <div className="mt-1">
                          <span className={`font-semibold ${
                            isDark ? 'text-gray-100' : 'text-gray-900'
                          }`}>{job.completed}/{job.total}</span>
                          <div className={`w-full rounded-full h-2 mt-1 ${
                            isDark ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <span className={`font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>{t('import.recentJobs.successRate')}</span>
                        <p className="font-semibold text-green-500">{job.success_rate?.toFixed(1) || 0}%</p>
                      </div>
                      
                      <div>
                        <span className={`font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>{t('import.recentJobs.emailsFound')}</span>
                        <p className="font-semibold text-blue-500">{job.emails_found || 0}</p>
                      </div>
                      
                      <div>
                        <span className={`font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>{t('import.recentJobs.creditsUsed')}</span>
                        <p className="font-semibold text-purple-500">{job.credits_used || 0}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
      </div>
    </div>
  );
};

export default ImportPage;