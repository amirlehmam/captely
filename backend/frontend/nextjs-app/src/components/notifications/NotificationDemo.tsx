import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Zap, CreditCard, Briefcase, Star, AlertTriangle } from 'lucide-react';
import { 
  showNotification, 
  showSuccess, 
  showError, 
  showWarning, 
  showJobCompleted, 
  showLowCredits, 
  showCreditPurchase 
} from './NotificationManager';

const NotificationDemo: React.FC = () => {
  const handleTestNotification = (type: string) => {
    switch (type) {
      case 'success':
        showSuccess('Success! ✅', 'Your operation completed successfully');
        break;
      case 'error':
        showError('Error occurred! ❌', 'Something went wrong, please try again');
        break;
      case 'warning':
        showWarning('Warning! ⚠️', 'Please check your input and try again');
        break;
      case 'job_completed':
        showJobCompleted('job123', 'leads_export.csv', {
          total_contacts: 1000,
          emails_found: 850,
          phones_found: 750,
          success_rate: 85.5,
          credits_used: 1000
        });
        break;
      case 'low_credits':
        showLowCredits(25);
        break;
      case 'credit_purchase':
        showCreditPurchase(5000);
        break;
      case 'system_update':
        showNotification({
          type: 'system_update',
          title: 'System Update 🔄',
          message: 'New features have been added to your dashboard',
          duration: 6000
        });
        break;
      case 'custom':
        showNotification({
          type: 'info',
          title: 'Custom Notification 🎨',
          message: 'This is a custom notification with an action button',
          action: {
            label: 'Take Action',
            onClick: () => alert('Action clicked!')
          },
          duration: 0 // Won't auto-dismiss
        });
        break;
    }
  };

  const notifications = [
    { type: 'success', label: 'Success', icon: '✅', color: 'bg-green-500' },
    { type: 'error', label: 'Error', icon: '❌', color: 'bg-red-500' },
    { type: 'warning', label: 'Warning', icon: '⚠️', color: 'bg-orange-500' },
    { type: 'job_completed', label: 'Job Complete', icon: '🎉', color: 'bg-blue-500' },
    { type: 'low_credits', label: 'Low Credits', icon: '💳', color: 'bg-orange-600' },
    { type: 'credit_purchase', label: 'Credits Added', icon: '✨', color: 'bg-purple-500' },
    { type: 'system_update', label: 'System Update', icon: '🔄', color: 'bg-cyan-500' },
    { type: 'custom', label: 'Custom Action', icon: '🎨', color: 'bg-indigo-500' }
  ];

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Bell className="h-6 w-6 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Enhanced Notification System Demo
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Click any button below to test different notification types with beautiful animations and sounds!
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {notifications.map((notification) => (
          <motion.button
            key={notification.type}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleTestNotification(notification.type)}
            className={`
              ${notification.color} text-white rounded-lg p-4 
              hover:shadow-lg transition-all duration-200
              flex flex-col items-center space-y-2
            `}
          >
            <span className="text-2xl">{notification.icon}</span>
            <span className="text-sm font-medium text-center">
              {notification.label}
            </span>
          </motion.button>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Features:</h4>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>• Beautiful spring animations with physics-based motion</li>
          <li>• Generated notification sounds using Web Audio API</li>
          <li>• Smart queueing with priority-based ordering</li>
          <li>• Auto-dismiss with progress indicators</li>
          <li>• Action buttons for interactive notifications</li>
          <li>• Stacked positioning with smooth transitions</li>
          <li>• Dark mode support with gradient backgrounds</li>
          <li>• Enhanced notification panel with grouping & search</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationDemo; 