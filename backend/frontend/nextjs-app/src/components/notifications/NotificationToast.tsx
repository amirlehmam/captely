import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, XCircle, AlertTriangle, Info, Bell, Zap, 
  Download, CreditCard, User, Briefcase, Star, Gift,
  X, ExternalLink, Clock, TrendingUp
} from 'lucide-react';

export interface NotificationToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'job_completed' | 'low_credits' | 'system_update' | 'credit_purchase';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  data?: any;
}

interface NotificationToastProps {
  notification: NotificationToastData;
  onDismiss: (id: string) => void;
  position: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ 
  notification, 
  onDismiss, 
  position 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  const duration = notification.duration || 5000;

  // Auto dismiss timer
  useEffect(() => {
    if (duration === 0) return; // Don't auto-dismiss if duration is 0

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    // Progress bar animation
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (duration / 100));
        return newProgress <= 0 ? 0 : newProgress;
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(progressTimer);
    };
  }, [duration]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const getNotificationConfig = () => {
    switch (notification.type) {
      case 'success':
        return {
          icon: CheckCircle,
          bgColor: 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20',
          borderColor: 'border-emerald-200 dark:border-emerald-700',
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          progressColor: 'bg-emerald-500'
        };
      case 'error':
        return {
          icon: XCircle,
          bgColor: 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20',
          borderColor: 'border-red-200 dark:border-red-700',
          iconColor: 'text-red-600 dark:text-red-400',
          progressColor: 'bg-red-500'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          bgColor: 'from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20',
          borderColor: 'border-amber-200 dark:border-amber-700',
          iconColor: 'text-amber-600 dark:text-amber-400',
          progressColor: 'bg-amber-500'
        };
      case 'job_completed':
        return {
          icon: Briefcase,
          bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
          borderColor: 'border-blue-200 dark:border-blue-700',
          iconColor: 'text-blue-600 dark:text-blue-400',
          progressColor: 'bg-blue-500'
        };
      case 'low_credits':
        return {
          icon: CreditCard,
          bgColor: 'from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20',
          borderColor: 'border-orange-200 dark:border-orange-700',
          iconColor: 'text-orange-600 dark:text-orange-400',
          progressColor: 'bg-orange-500'
        };
      case 'credit_purchase':
        return {
          icon: Star,
          bgColor: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
          borderColor: 'border-purple-200 dark:border-purple-700',
          iconColor: 'text-purple-600 dark:text-purple-400',
          progressColor: 'bg-purple-500'
        };
      case 'system_update':
        return {
          icon: Zap,
          bgColor: 'from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20',
          borderColor: 'border-cyan-200 dark:border-cyan-700',
          iconColor: 'text-cyan-600 dark:text-cyan-400',
          progressColor: 'bg-cyan-500'
        };
      default:
        return {
          icon: Info,
          bgColor: 'from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20',
          borderColor: 'border-gray-200 dark:border-gray-700',
          iconColor: 'text-gray-600 dark:text-gray-400',
          progressColor: 'bg-gray-500'
        };
    }
  };

  const config = getNotificationConfig();
  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ 
            opacity: 0, 
            x: 400, 
            scale: 0.3,
            rotate: 10
          }}
          animate={{ 
            opacity: 1, 
            x: 0, 
            scale: 1,
            rotate: 0,
            y: position * 80
          }}
          exit={{ 
            opacity: 0, 
            x: 400, 
            scale: 0.8,
            transition: { duration: 0.3 }
          }}
          transition={{
            type: "spring",
            damping: 15,
            stiffness: 300
          }}
          className="fixed top-4 right-4 z-50"
          style={{
            willChange: 'transform, opacity'
          }}
        >
          <motion.div
            whileHover={{ 
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative max-w-sm w-full bg-gradient-to-br ${config.bgColor} 
              border ${config.borderColor} rounded-xl shadow-xl backdrop-blur-sm
              overflow-hidden cursor-pointer group
            `}
            onClick={notification.action?.onClick}
          >
            {/* Progress bar */}
            {duration > 0 && (
              <div className="absolute top-0 left-0 h-1 bg-gray-200 dark:bg-gray-700 w-full">
                <motion.div
                  className={`h-full ${config.progressColor}`}
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start space-x-3">
                {/* Icon with pulse animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    delay: 0.2,
                    type: "spring",
                    damping: 10,
                    stiffness: 200
                  }}
                  className="relative"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.7, 1]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className={`absolute inset-0 ${config.iconColor} opacity-20 rounded-full`}
                  />
                  <IconComponent className={`h-6 w-6 ${config.iconColor} relative z-10`} />
                </motion.div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {notification.title}
                  </motion.p>
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-sm text-gray-600 dark:text-gray-300 mt-1"
                  >
                    {notification.message}
                  </motion.p>

                  {/* Action button */}
                  {notification.action && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        notification.action!.onClick();
                      }}
                      className={`
                        mt-2 text-xs font-medium ${config.iconColor} 
                        hover:underline flex items-center space-x-1
                        transition-colors duration-200
                      `}
                    >
                      <span>{notification.action.label}</span>
                      <ExternalLink className="h-3 w-3" />
                    </motion.button>
                  )}
                </div>

                {/* Close button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                  className="
                    opacity-0 group-hover:opacity-100 transition-opacity duration-200
                    p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700
                    text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                  "
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            </div>

            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 opacity-0 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/10"
              animate={{
                x: [-200, 400],
                opacity: [0, 0.3, 0]
              }}
              transition={{
                duration: 2,
                delay: 0.5,
                ease: "easeInOut"
              }}
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                transform: 'skewX(-20deg)'
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast; 