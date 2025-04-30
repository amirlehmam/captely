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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Batches</h1>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </button>
        </div>
      </div>
      
      {/* Search and filter section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 md:space-x-4">
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
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm text-gray-900 dark:text-white"
                placeholder="Search batches..."
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Status:
            </span>
            <select className="rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500">
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="warning">Warning</option>
            </select>
            
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-4">
              Date:
            </span>
            <select className="rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
            </select>
            
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-4">
              Source:
            </span>
            <select className="rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500">
              <option value="all">All Sources</option>
              <option value="csv">CSV</option>
              <option value="extension">Extension</option>
              <option value="manual">Manual</option>
              <option value="api">API</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Batches table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Batch
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Source
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Status
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Contacts
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Emails
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Phones
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Success
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    Date
                    <button className="ml-1 text-gray-400">
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {currentBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {batch.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {batch.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {batch.source}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(batch.status)}
                      <span className="ml-1.5 text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {batch.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {batch.totalContacts}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {batch.emailsFound}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {batch.phonesFound}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      batch.successRate >= 80 
                        ? 'text-green-600 dark:text-green-400' 
                        : batch.successRate >= 50 
                          ? 'text-yellow-600 dark:text-yellow-400' 
                          : 'text-red-600 dark:text-red-400'
                    }`}>
                      {batch.successRate}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {batch.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300">
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{indexOfFirstBatch + 1}</span> to <span className="font-medium">
                  {Math.min(indexOfLastBatch, filteredBatches.length)}
                </span> of <span className="font-medium">{filteredBatches.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium ${
                    currentPage === 1
                      ? 'text-gray-300 dark:text-gray-500 cursor-not-allowed'
                      : 'text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                {/* Page numbers would go here in a full implementation */}
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium ${
                    currentPage === totalPages
                      ? 'text-gray-300 dark:text-gray-500 cursor-not-allowed'
                      : 'text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
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