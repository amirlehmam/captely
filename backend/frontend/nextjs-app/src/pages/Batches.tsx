import React, { useState } from 'react';
import { 
  Download, Filter, ArrowUpDown, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertTriangle
} from 'lucide-react';

// Mock data for batches
const batchesMockData = [
  {
    id: "batch-12345",
    name: "Sales Navigator - Tech Leaders",
    source: "Extension",
    status: "processing",
    totalContacts: 150,
    emailsFound: 85,
    phonesFound: 62,
    successRate: 57,
    date: "2025-05-12",
    user: "john.doe@company.com"
  },
  {
    id: "batch-12344",
    name: "HubSpot Export - Enterprise Accounts",
    source: "CSV",
    status: "completed",
    totalContacts: 85,
    emailsFound: 72,
    phonesFound: 58,
    successRate: 85,
    date: "2025-05-12",
    user: "john.doe@company.com"
  },
  {
    id: "batch-12343",
    name: "LinkedIn Sales Navigator - CTO List",
    source: "Extension",
    status: "completed",
    totalContacts: 125,
    emailsFound: 112,
    phonesFound: 87,
    successRate: 90,
    date: "2025-05-11",
    user: "john.doe@company.com"
  },
  {
    id: "batch-12342",
    name: "Marketing Contact List - Q2",
    source: "CSV",
    status: "failed",
    totalContacts: 50,
    emailsFound: 23,
    phonesFound: 12,
    successRate: 46,
    date: "2025-05-09",
    user: "sarah.smith@company.com"
  },
  {
    id: "batch-12341",
    name: "Conference Attendees",
    source: "Manual",
    status: "completed",
    totalContacts: 35,
    emailsFound: 29,
    phonesFound: 22,
    successRate: 83,
    date: "2025-05-08",
    user: "john.doe@company.com"
  },
  {
    id: "batch-12340",
    name: "Product Demo Signups",
    source: "API",
    status: "completed",
    totalContacts: 62,
    emailsFound: 59,
    phonesFound: 41,
    successRate: 95,
    date: "2025-05-07",
    user: "sarah.smith@company.com"
  },
  {
    id: "batch-12339",
    name: "Sales Navigator - Decision Makers",
    source: "Extension",
    status: "completed",
    totalContacts: 110,
    emailsFound: 95,
    phonesFound: 76,
    successRate: 86,
    date: "2025-05-06",
    user: "john.doe@company.com"
  },
  {
    id: "batch-12338",
    name: "Webinar Registration List",
    source: "CSV",
    status: "warning",
    totalContacts: 78,
    emailsFound: 69,
    phonesFound: 33,
    successRate: 88,
    date: "2025-05-05",
    user: "john.doe@company.com"
  },
  {
    id: "batch-12337",
    name: "Tradeshow Leads - Spring Expo",
    source: "CSV",
    status: "completed",
    totalContacts: 93,
    emailsFound: 82,
    phonesFound: 59,
    successRate: 88,
    date: "2025-05-04",
    user: "sarah.smith@company.com"
  },
  {
    id: "batch-12336",
    name: "Marketing Qualified Leads - April",
    source: "API",
    status: "completed",
    totalContacts: 127,
    emailsFound: 113,
    phonesFound: 86,
    successRate: 89,
    date: "2025-05-03",
    user: "john.doe@company.com"
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'processing':
      return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'processing':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSourceBadge = (source: string) => {
  switch (source) {
    case 'Extension':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'CSV':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Manual':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'API':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const BatchesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Filtered batches based on search term
  const filteredBatches = batchesMockData.filter(batch => 
    batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Pagination logic
  const indexOfLastBatch = currentPage * itemsPerPage;
  const indexOfFirstBatch = indexOfLastBatch - itemsPerPage;
  const currentBatches = filteredBatches.slice(indexOfFirstBatch, indexOfLastBatch);
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  
  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">All Batches</h1>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </button>
        </div>
      </div>
      
      {/* Search and filter section */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-100 mb-8 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-6">
          <div className="w-full md:w-1/3">
            <label htmlFor="search" className="sr-only">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="search"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm text-gray-900 transition-all duration-200"
                placeholder="Search batches..."
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-700">
                Status:
              </span>
              <select className="rounded-lg border-gray-200 py-3 pl-3 pr-10 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200">
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="warning">Warning</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-700">
                Date:
              </span>
              <select className="rounded-lg border-gray-200 py-3 pl-3 pr-10 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-700">
                Source:
              </span>
              <select className="rounded-lg border-gray-200 py-3 pl-3 pr-10 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200">
                <option value="all">All Sources</option>
                <option value="csv">CSV</option>
                <option value="extension">Extension</option>
                <option value="manual">Manual</option>
                <option value="api">API</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Batches table */}
      <div className="bg-white shadow-lg overflow-hidden rounded-xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Batch
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Source
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Status
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Contacts
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Emails
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Phones
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Success
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    Date
                    <button className="ml-2 text-gray-400 hover:text-gray-600">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {currentBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 group">
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {batch.name}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {batch.id}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getSourceBadge(batch.source)}`}>
                      {batch.source}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="mr-3">
                        {getStatusIcon(batch.status)}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(batch.status)}`}>
                        {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {batch.totalContacts}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {batch.emailsFound}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {batch.phonesFound}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                      batch.successRate >= 80 
                        ? 'text-green-700 bg-green-100' 
                        : batch.successRate >= 50 
                          ? 'text-yellow-700 bg-yellow-100' 
                          : 'text-red-700 bg-red-100'
                    }`}>
                      {batch.successRate}%
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-700">
                      {batch.date}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                    <button className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200" title="Download">
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 flex items-center justify-between border-t border-gray-100">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Showing <span className="font-bold">{indexOfFirstBatch + 1}</span> to <span className="font-bold">
                  {Math.min(indexOfLastBatch, filteredBatches.length)}
                </span> of <span className="font-bold">{filteredBatches.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-3 py-2 rounded-l-lg border border-gray-200 bg-white text-sm font-medium transition-all duration-200 ${
                    currentPage === 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                  }`}
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-200 bg-primary-50 text-sm font-semibold text-primary-700">
                  Page {currentPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-3 py-2 rounded-r-lg border border-gray-200 bg-white text-sm font-medium transition-all duration-200 ${
                    currentPage === totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                  }`}
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchesPage;