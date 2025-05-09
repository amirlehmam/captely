import React, { useState } from 'react';
import { 
  Upload, FileSpreadsheet, AlertCircle, CheckCircle, RefreshCw
} from 'lucide-react';

const ImportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('csv');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
    }
  };
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      handleFile(selectedFile);
    }
  };
  
  const handleFile = (file: File) => {
    // Check if file is CSV or XLSX
    const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a CSV or XLSX file');
      return;
    }
    
    setFile(file);
  };
  
  // Handle file upload
  const handleUpload = () => {
    if (!file) return;
    
    setUploading(true);
    
    // Simulate upload process
    setTimeout(() => {
      setUploading(false);
      // In a real app, would handle the response and redirect or show success
    }, 2000);
  };
  
  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Contacts</h1>
      </div>
      
      {/* Import tabs */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'csv'
                ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('csv')}
          >
            CSV/XLSX Upload
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'sales-nav'
                ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('sales-nav')}
          >
            Sales Navigator
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'manual'
                ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('manual')}
          >
            Manual Entry
          </button>
        </div>
        
        <div className="p-6">
          {/* CSV/XLSX Upload */}
          {activeTab === 'csv' && (
            <div>
              <div className="mb-5">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Upload Contact List
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Import your contacts via CSV or XLSX file. Your file should include at least first name, last name, and company name columns.
                </p>
              </div>
              
              {/* File upload area */}
              {!file ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center ${
                    isDragging
                      ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Drag and drop your file here, or click to browse
                  </p>
                  <input
                    type="file"
                    id="file-upload"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </button>
                </div>
              ) : (
                /* File selected */
                <div className="border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <FileSpreadsheet className="h-8 w-8 text-teal-500 dark:text-teal-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      Change
                    </button>
                  </div>
                  
                  {/* Settings & Upload button */}
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input 
                        id="deduplicate" 
                        type="checkbox"
                        checked={true}
                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                      />
                      <label htmlFor="deduplicate" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Deduplicate contacts (based on name + company hash)
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        id="headers" 
                        type="checkbox"
                        checked={true}
                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                      />
                      <label htmlFor="headers" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        First row contains column headers
                      </label>
                    </div>
                    
                    <div className="pt-4">
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className={`w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                          uploading
                            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                            : 'bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500'
                        }`}
                      >
                        {uploading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload and Process
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Sample file download */}
              <div className="mt-6 text-center">
                <button className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
                  Download sample CSV template
                </button>
              </div>
            </div>
          )}
          
          {/* Sales Navigator Import */}
          {activeTab === 'sales-nav' && (
            <div>
              <div className="mb-5">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  LinkedIn Sales Navigator Importer
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Use our Chrome extension to extract contacts directly from LinkedIn Sales Navigator.
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      You need to install our Chrome extension to use this feature.
                    </p>
                    <p className="mt-3 text-sm md:mt-0 md:ml-6">
                      <a href="#" className="whitespace-nowrap font-medium text-blue-700 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200">
                        Install <span aria-hidden="true">&rarr;</span>
                      </a>
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:p-6">
                  <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                    How to use the Sales Navigator Importer
                  </h3>
                  <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                    <p>Follow these steps to import your Sales Navigator contacts:</p>
                  </div>
                  <ol className="mt-4 space-y-3 text-sm">
                    <li className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-500 dark:text-teal-400 font-medium text-xs">
                        1
                      </span>
                      <span className="ml-2">Install the Captely Chrome extension from the Chrome Web Store.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-500 dark:text-teal-400 font-medium text-xs">
                        2
                      </span>
                      <span className="ml-2">Log in to LinkedIn and navigate to Sales Navigator.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-500 dark:text-teal-400 font-medium text-xs">
                        3
                      </span>
                      <span className="ml-2">Search for your target contacts and open a search results page.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-500 dark:text-teal-400 font-medium text-xs">
                        4
                      </span>
                      <span className="ml-2">Click the Captely icon in your browser toolbar to activate the importer.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-500 dark:text-teal-400 font-medium text-xs">
                        5
                      </span>
                      <span className="ml-2">Click "Start Scraping" and wait for the process to complete (max 150 contacts per session).</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}
          
          {/* Manual Entry */}
          {activeTab === 'manual' && (
            <div>
              <div className="mb-5">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Manual Contact Entry
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add a single contact directly. All fields marked with * are required.
                </p>
              </div>
              
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Name */}
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      id="firstName"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                  
                  {/* Last Name */}
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      id="lastName"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                  
                  {/* Company */}
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Company *
                    </label>
                    <input
                      type="text"
                      name="company"
                      id="company"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                  
                  {/* Job Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      id="title"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                  
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      placeholder="Leave blank to find via enrichment"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      placeholder="Leave blank to find via enrichment"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                  
                  {/* LinkedIn URL */}
                  <div className="md:col-span-2">
                    <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      name="linkedinUrl"
                      id="linkedinUrl"
                      placeholder="https://www.linkedin.com/in/username"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center mt-4">
                  <input
                    id="enrich"
                    name="enrich"
                    type="checkbox"
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label htmlFor="enrich" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Enrich contact data (find email, phone, social profiles)
                  </label>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Contact
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPage;