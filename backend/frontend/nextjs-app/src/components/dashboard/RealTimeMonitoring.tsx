import React, { useState } from 'react';
import { 
  Activity, 
  Server, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { useRealTimeMonitoring } from '../../hooks/useApi';

const RealTimeMonitoring: React.FC = () => {
  const { tasks, workers, loading, error } = useRealTimeMonitoring();
  const [paused, setPaused] = useState(false);

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-5">
          <div className="flex items-center">
            <Loader className="h-5 w-5 animate-spin text-primary-500 mr-3" />
            <h3 className="text-lg leading-6 font-semibold text-gray-900">
              Connecting to monitoring...
            </h3>
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
              <XCircle className="h-5 w-5 text-red-500 mr-3" />
              <span className="text-red-700">Monitoring unavailable: {error}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeTasks = (tasks || []).filter(task => task.state === 'STARTED');
  const completedTasks = (tasks || []).filter(task => task.state === 'SUCCESS');
  const failedTasks = (tasks || []).filter(task => task.state === 'FAILURE');
  const pendingTasks = (tasks || []).filter(task => task.state === 'PENDING');

  const getTaskIcon = (state: string) => {
    switch (state) {
      case 'STARTED':
        return <Loader className="h-4 w-4 animate-spin text-blue-500" />;
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILURE':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'RETRY':
        return <RotateCcw className="h-4 w-4 text-yellow-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTaskDisplayName = (taskName: string) => {
    const parts = taskName.split('.');
    return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center">
          <Activity className="h-5 w-5 text-blue-500 mr-3" />
          <div>
            <h3 className="text-lg leading-6 font-semibold text-gray-900">
              Real-Time Monitoring
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Live task processing and worker status
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setPaused(!paused)}
            className={`inline-flex items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              paused 
                ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500' 
                : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-primary-500'
            }`}
          >
            {paused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <a
            href="http://localhost:5555"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Server className="h-4 w-4 mr-2" />
            Flower Dashboard
          </a>
        </div>
      </div>

      <div className="border-t border-gray-100">
        {/* Status Overview */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">
                {activeTasks.length}
              </div>
              <div className="text-sm font-medium text-blue-600 uppercase tracking-wide">Active Tasks</div>
            </div>
            <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">
                {pendingTasks.length}
              </div>
              <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Queued</div>
            </div>
            <div className="text-center bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-900">
                {completedTasks.length}
              </div>
              <div className="text-sm font-medium text-green-600 uppercase tracking-wide">Completed</div>
            </div>
            <div className="text-center bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
              <div className="text-2xl font-bold text-red-900">
                {failedTasks.length}
              </div>
              <div className="text-sm font-medium text-red-600 uppercase tracking-wide">Failed</div>
            </div>
          </div>
        </div>

        {/* Workers Status */}
        {(workers || []).length > 0 && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">
              Workers ({(workers || []).length} online)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(workers || []).map((worker: any, index: number) => (
                <div
                  key={`worker-${worker.hostname || worker.name || index}`}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl"
                >
                  <div className="flex items-center">
                    <div className="h-3 w-3 bg-green-500 rounded-full mr-3 animate-pulse shadow-sm"></div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {worker.hostname || `Worker ${index + 1}`}
                      </div>
                      <div className="text-xs text-gray-600">
                        {worker.active || 0} active tasks
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                    Online
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tasks */}
        <div className="px-6 py-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Recent Tasks
          </h4>
          
          {(tasks || []).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm font-medium">No active tasks</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(tasks || []).slice(0, 10).map((task) => (
                <div
                  key={task.task_id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="mr-4 flex-shrink-0">
                      {getTaskIcon(task.state)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {getTaskDisplayName(task.name)}
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {task.task_id ? task.task_id.substring(0, 8) : 'No ID'}...
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className={`text-sm font-semibold capitalize px-3 py-1 rounded-full ${
                      task.state === 'SUCCESS' ? 'text-green-700 bg-green-100' :
                      task.state === 'FAILURE' ? 'text-red-700 bg-red-100' :
                      task.state === 'STARTED' ? 'text-blue-700 bg-blue-100' :
                      'text-gray-700 bg-gray-100'
                    }`}>
                      {task.state}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {new Date(task.timestamp * 1000).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection Status */}
        <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-green-700 font-medium">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse shadow-sm"></div>
              Connected to Flower
            </div>
            <div className="text-gray-600 font-medium">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMonitoring; 