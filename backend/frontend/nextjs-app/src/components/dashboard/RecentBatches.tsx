import React from 'react';
import { ChevronRight, Download, ArrowUpDown, Filter, CheckCircle, XCircle, Clock, AlertCircle, Loader } from 'lucide-react';
import { useJobs } from '../../hooks/useApi';
import { apiService } from '../../services/api';

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'processing':
      return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-gray-500" />;
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
    case 'pending':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const RecentBatches: React.FC = () => {
  const { jobs, loading, error } = useJobs();

  const handleDownload = async (jobId: string) => {
    try {
      await apiService.exportData(jobId, 'csv');
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="h-6 bg-gray-100 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-100 rounded-lg w-48 animate-pulse"></div>
        </div>
        <div className="border-t border-gray-100 p-6">
          <div className="flex justify-center">
            <Loader className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
              <span className="text-red-700">Failed to load jobs: {error}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const recentJobs = jobs.slice(0, 4); // Show only the 4 most recent jobs
  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-slate-50 to-gray-50">
        <div>
          <h3 className="text-lg leading-6 font-semibold text-gray-900">
            Recent Batches
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Showing last {recentJobs.length} of {jobs.length} jobs
          </p>
        </div>
        <div className="flex space-x-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Sort
          </button>
        </div>
      </div>
      
      <div className="border-t border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Batch Name
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contacts
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Success
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {recentJobs.map((job) => {
                const successRate = job.total > 0 ? Math.round(((job.success_rate || 0) * 100)) : 0;
                const formattedDate = new Date(job.created_at).toLocaleDateString();
                
                return (
                  <tr key={job.id} className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {job.file_name || `Job ${job.id.substring(0, 8)}`}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {job.id}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                        {job.file_name ? 'CSV' : 'Manual'}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="mr-3">
                          {getStatusIcon(job.status)}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(job.status)}`}>
                          {(job.status || 'unknown').charAt(0).toUpperCase() + (job.status || 'unknown').slice(1)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {job.completed}/{job.total}
                      </div>
                      <div className="text-xs text-gray-500">
                        contacts
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                        successRate >= 80 
                          ? 'text-green-700 bg-green-100' 
                          : successRate >= 50 
                            ? 'text-yellow-700 bg-yellow-100' 
                            : 'text-red-700 bg-red-100'
                      }`}>
                        {successRate}%
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-700">
                        {formattedDate}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button 
                          onClick={() => handleDownload(job.id)}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200"
                          disabled={job.status !== 'completed'}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200" title="View Details">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100 text-right">
        <button className="inline-flex items-center px-4 py-2 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200">
          View all batches
          <ChevronRight className="ml-2 h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default RecentBatches;