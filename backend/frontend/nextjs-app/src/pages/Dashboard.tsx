import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import RealTimeMonitoring from '../components/dashboard/RealTimeMonitoring';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Redirect to login if no JWT is stored
  useEffect(() => {
    const token =
      typeof window !== 'undefined' &&
      (localStorage.getItem('captely_jwt') ||
       sessionStorage.getItem('captely_jwt'));
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

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

        {/* Real-Time Monitoring */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <RealTimeMonitoring />
        </motion.div>
        
        {/* API Provider Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <ProviderStatus />
        </motion.div>
        
        {/* Recent batches */}
        <motion.div 
          className="lg:col-span-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <RecentBatches />
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
