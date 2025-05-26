import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  X
} from 'lucide-react';
import { useFileUpload, useJobs } from '../hooks/useApi';

const ImportPage: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  const { uploadFile, uploading, progress, error } = useFileUpload();
  const { jobs, refetch } = useJobs();

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV file only');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV file only');
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const result = await uploadFile(selectedFile);
      setUploadResult(result);
      setUploadSuccess(true);
      setSelectedFile(null);
      refetch(); // Refresh the jobs list
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadSuccess(false);
    setUploadResult(null);
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      ['first_name', 'last_name', 'company', 'position', 'profile_url', 'location', 'industry'],
      ['John', 'Doe', 'TechCorp Inc', 'CEO', 'https://linkedin.com/in/johndoe', 'San Francisco, CA', 'Technology'],
      ['Jane', 'Smith', 'MarketCorp', 'VP Marketing', 'https://linkedin.com/in/janesmith', 'New York, NY', 'Marketing'],
      ['Mike', 'Johnson', 'SalesCorp', 'Sales Director', '', 'Chicago, IL', 'Sales']
    ];
    
    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_contacts.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Import Contacts
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Upload your contact list to start the enrichment process
        </p>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
      >
        <div className="p-6">
          {!uploadSuccess ? (
            <>
              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : selectedFile
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-teal-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                {selectedFile ? (
                  <div className="space-y-4">
                    <FileText className="h-12 w-12 text-green-500 mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
                      >
                        {uploading ? (
                          <>
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Start Upload
                          </>
                        )}
                      </button>
                      <button
                        onClick={clearFile}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">
                        Drop your CSV file here
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        or click to browse files
                      </p>
                </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 cursor-pointer"
                    >
                      Browse Files
                    </label>
            </div>
          )}
              </div>
              
              {/* Upload Progress */}
              {uploading && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Uploading...
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-teal-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-red-700 dark:text-red-300">Upload failed: {error}</span>
              </div>
            </div>
          )}
            </>
          ) : (
            /* Success State */
            <div className="text-center space-y-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Upload Successful!
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Your file has been uploaded and enrichment has started
                </p>
              </div>
              
              {uploadResult && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {uploadResult.total_contacts || 0}
                  </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Contacts</div>
                  </div>
                  <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {uploadResult.job_id?.substring(0, 8) || 'N/A'}
                  </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Job ID</div>
                  </div>
                  <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        Starting
                  </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                  </div>
                  </div>
                </div>
              )}

                  <button
                onClick={() => {
                  setUploadSuccess(false);
                  setUploadResult(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700"
              >
                Upload Another File
                  </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
          CSV Format Requirements
        </h3>
        <div className="space-y-3">
          <p className="text-blue-800 dark:text-blue-200">
            Your CSV file should include the following columns (headers are required):
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Required Fields:</h4>
              <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>first_name</li>
                <li>last_name</li>
                <li>company</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Optional Fields:</h4>
              <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>position</li>
                <li>profile_url (LinkedIn URL)</li>
                <li>location</li>
                <li>industry</li>
              </ul>
            </div>
          </div>
          <div className="pt-4">
            <button
              onClick={downloadSampleCSV}
              className="inline-flex items-center px-3 py-2 border border-blue-300 dark:border-blue-600 text-sm font-medium rounded-md text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/70"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Sample CSV
            </button>
          </div>
        </div>
      </motion.div>

      {/* Recent Jobs */}
      {jobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Import Jobs
            </h3>
            <div className="space-y-4">
              {jobs.slice(0, 3).map((job) => {
                const progress = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0;
                const isCompleted = job.status === 'completed';
                
                return (
                  <div key={job.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {job.file_name || `Job ${job.id.substring(0, 8)}`}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        job.status === 'processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="text-gray-900 dark:text-white">{job.completed}/{job.total} contacts</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isCompleted ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
        </motion.div>
      )}
    </div>
  );
};

export default ImportPage;