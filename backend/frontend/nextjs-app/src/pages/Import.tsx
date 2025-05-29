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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Import Contacts
        </h1>
        <p className="text-lg text-gray-600">
          Upload your contact list to start the enrichment process
        </p>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="p-8">
          {!uploadSuccess ? (
            <>
              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : selectedFile
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                >
                {selectedFile ? (
                  <div className="space-y-6">
                    <FileText className="h-16 w-16 text-green-500 mx-auto" />
                    <div>
                      <p className="text-xl font-semibold text-gray-900">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
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
                        className="inline-flex items-center px-6 py-3 border border-gray-200 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Upload className="h-16 w-16 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-xl font-semibold text-gray-900">
                        Drop your CSV file here
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
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
                      className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 cursor-pointer transition-all duration-200"
                    >
                      Browse Files
                    </label>
            </div>
          )}
              </div>
              
              {/* Upload Progress */}
              {uploading && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-gray-700">
                      Uploading...
                    </span>
                    <span className="text-sm font-semibold text-primary-600">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-primary-400 h-3 rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mt-8 bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                    <span className="text-red-700">Upload failed: {error}</span>
              </div>
            </div>
          )}
            </>
          ) : (
            /* Success State */
            <div className="text-center space-y-8">
              <CheckCircle className="h-20 w-20 text-green-500 mx-auto" />
            <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Upload Successful!
                </h3>
                <p className="text-gray-600 mt-2">
                  Your file has been uploaded and enrichment has started
                </p>
              </div>
              
              {uploadResult && (
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border border-gray-200">
                  <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                      <div className="text-3xl font-bold text-gray-900">
                        {uploadResult.total_contacts || 0}
                  </div>
                      <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Contacts</div>
                  </div>
                  <div>
                      <div className="text-3xl font-bold text-blue-600">
                        {uploadResult.job_id?.substring(0, 8) || 'N/A'}
                  </div>
                      <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Job ID</div>
                  </div>
                  <div>
                      <div className="text-3xl font-bold text-green-600">
                        Starting
                  </div>
                      <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Status</div>
                  </div>
                  </div>
                </div>
              )}

                  <button
                onClick={() => {
                  setUploadSuccess(false);
                  setUploadResult(null);
                }}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 transition-all duration-200"
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
        className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8"
      >
        <h3 className="text-lg font-bold text-blue-900 mb-6">
          CSV Format Requirements
        </h3>
        <div className="space-y-4">
          <p className="text-blue-800 font-medium">
            Your CSV file should include the following columns (headers are required):
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-3">Required Fields:</h4>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                <li>first_name</li>
                <li>last_name</li>
                <li>company</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-3">Optional Fields:</h4>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
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
              className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-semibold rounded-lg text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
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
          className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              Recent Import Jobs
            </h3>
            <div className="space-y-6">
              {jobs.slice(0, 3).map((job) => {
                const progress = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0;
                const isCompleted = job.status === 'completed';
                
                const getStatusBadge = (status: string) => {
                  switch (status) {
                    case 'completed':
                      return 'bg-green-100 text-green-800 border-green-200';
                    case 'processing':
                      return 'bg-blue-100 text-blue-800 border-blue-200';
                    case 'failed':
                      return 'bg-red-100 text-red-800 border-red-200';
                    default:
                      return 'bg-gray-100 text-gray-800 border-gray-200';
                  }
                };
                
                return (
                  <div key={job.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {job.file_name || `Job ${job.id.substring(0, 8)}`}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(job.status)}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">Progress</span>
                        <span className="font-semibold text-gray-900">{job.completed}/{job.total} contacts</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-blue-400'
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