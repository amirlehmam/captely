import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Mail, Phone, Clock, ChevronRight, 
  TrendingUp, BarChart3, RefreshCw, Upload,
  CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

// Components
import EnrichmentStats from '../components/dashboard/EnrichmentStats';
import BatchProgress from '../components/dashboard/BatchProgress';
import RecentBatches from '../components/dashboard/RecentBatches';
import ProviderStatus from '../components/dashboard/ProviderStatus';
import CreditUsage from '../components/dashboard/CreditUsage';

const timelineItems = [
  {
    id: 1,
    title: "Data Import",
    status: "completed",
    description: "CSV upload processed successfully",
    time: "10:30 AM",
    icon: <Upload className="h-5 w-5" />
  },
  {
    id: 2,
    title: "Enrichment",
    status: "in_progress",
    description: "Processing 150 contacts",
    time: "10:35 AM",
    icon: <RefreshCw className="h-5 w-5" />
  },
  {
    id: 3,
    title: "Verification",
    status: "pending",
    description: "Waiting to start",
    time: "Pending",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: 4,
    title: "Export",
    status: "pending",
    description: "Ready for download",
    time: "Pending",
    icon: <BarChart3 className="h-5 w-5" />
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'in_progress':
      return 'bg-blue-500';
    case 'pending':
      return 'bg-gray-300 dark:bg-gray-600';
    default:
      return 'bg-gray-300 dark:bg-gray-600';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'in_progress':
      return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
};

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-gray-900 dark:text-white"
        >
          Dashboard
        </motion.h1>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mt-4 md:mt-0 flex space-x-3"
        >
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
            <Upload className="h-4 w-4 mr-2" />
            New Import
          </button>
        </motion.div>
      </div>
      
      {/* Stats cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <EnrichmentStats />
      </motion.div>
      
      {/* Timeline section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Processing Timeline</h2>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            
            {/* Timeline items */}
            {timelineItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative mb-8 last:mb-0"
              >
                <div className="flex items-start">
                  {/* Timeline dot */}
                  <div className={`absolute left-8 -translate-x-1/2 w-4 h-4 rounded-full ${getStatusColor(item.status)} border-4 border-white dark:border-gray-800`}></div>
                  
                  {/* Content */}
                  <div className="ml-12">
                    <div className="flex items-center">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                        {item.icon}
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.description}
                        </p>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {item.time}
                        </span>
                      </div>
                      <div className="ml-auto">
                        {getStatusIcon(item.status)}
                      </div>
                    </div>
                    
                    {/* Progress bar for in-progress items */}
                    {item.status === 'in_progress' && (
                      <motion.div 
                        className="mt-4 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <div className="h-full bg-blue-500 rounded-full"></div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current batch progress */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BatchProgress />
        </motion.div>
        
        {/* Credit usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CreditUsage />
        </motion.div>
        
        {/* Recent batches */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <RecentBatches />
        </motion.div>
        
        {/* API Provider Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <ProviderStatus />
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;