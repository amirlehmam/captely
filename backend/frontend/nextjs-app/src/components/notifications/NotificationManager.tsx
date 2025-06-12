import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import NotificationToast, { NotificationToastData } from './NotificationToast';
import { notificationSounds } from '../../utils/soundGenerator';

export interface NotificationSound {
  success: string;
  error: string;
  warning: string;
  info: string;
  job_completed: string;
  low_credits: string;
  credit_purchase: string;
  system_update: string;
}

interface NotificationManagerProps {
  maxVisible?: number;
  enableSounds?: boolean;
  soundVolume?: number;
}

interface QueuedNotification extends NotificationToastData {
  priority: number;
  timestamp: number;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({
  maxVisible = 5,
  enableSounds = true,
  soundVolume = 0.5
}) => {
  const [notifications, setNotifications] = useState<QueuedNotification[]>([]);
  const [visibleNotifications, setVisibleNotifications] = useState<QueuedNotification[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Play notification sound using the sound generator
  const playSound = useCallback(async (type: string) => {
    if (!enableSounds) return;

    try {
      await notificationSounds.playNotificationSound(type);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }, [enableSounds]);

  // Add notification to queue
  const addNotification = useCallback((notification: NotificationToastData) => {
    // Prevent duplicate notifications within a short time frame
    const duplicateKey = `${notification.type}-${notification.title}`;
    const lastShown = localStorage.getItem(`notification-${duplicateKey}`);
    const now = Date.now();
    
    if (lastShown && (now - parseInt(lastShown)) < 2000) {
      // Skip if same notification was shown within 2 seconds
      return;
    }
    
    localStorage.setItem(`notification-${duplicateKey}`, now.toString());
    
    const priority = getPriority(notification.type);
    const queuedNotification: QueuedNotification = {
      ...notification,
      priority,
      timestamp: Date.now()
    };

    setNotifications((prev: QueuedNotification[]) => {
      const updated = [...prev, queuedNotification];
      return updated.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
    });

    // Play sound
    playSound(notification.type);
  }, [playSound]);

  // Get priority for notification types
  const getPriority = (type: string): number => {
    switch (type) {
      case 'error': return 5;
      case 'low_credits': return 4;
      case 'job_completed': return 3;
      case 'warning': return 2;
      case 'success': return 1;
      case 'credit_purchase': return 1;
      default: return 0;
    }
  };

  // Manage visible notifications
  useEffect(() => {
    const visible = notifications.slice(0, maxVisible);
    setVisibleNotifications(visible);
  }, [notifications, maxVisible]);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev: QueuedNotification[]) => prev.filter((n: QueuedNotification) => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Auto-clear old notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
      setNotifications((prev: QueuedNotification[]) => prev.filter((n: QueuedNotification) => n.timestamp > cutoff));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Expose methods globally
  useEffect(() => {
    // Make notification methods available globally
    (window as any).showNotification = addNotification;
    (window as any).clearNotifications = clearAll;

    return () => {
      delete (window as any).showNotification;
      delete (window as any).clearNotifications;
    };
  }, [addNotification, clearAll]);

  const containerElement = typeof document !== 'undefined' ? document.body : null;

  if (!containerElement) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Notification toasts */}
      {visibleNotifications.map((notification: QueuedNotification, index: number) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={removeNotification}
          position={index}
        />
      ))}

      {/* Queue indicator for overflow */}
      {notifications.length > maxVisible && (
        <div className="fixed top-4 right-4 pointer-events-auto z-50">
          <div 
            className="
              mt-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 
              px-3 py-1 rounded-full text-xs font-medium shadow-lg
              cursor-pointer hover:bg-gray-700 dark:hover:bg-gray-300
              transition-colors duration-200
            "
            onClick={clearAll}
            style={{ 
              marginTop: `${maxVisible * 100 + 10}px`,
              willChange: 'background-color'
            }}
          >
            +{notifications.length - maxVisible} more (click to clear)
          </div>
        </div>
      )}
    </div>,
    containerElement
  );
};

// Export notification helper functions
export const showNotification = (notification: Omit<NotificationToastData, 'id'>) => {
  const notificationWithId: NotificationToastData = {
    ...notification,
    id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  if ((window as any).showNotification) {
    (window as any).showNotification(notificationWithId);
  }
};

export const showSuccess = (title: string, message: string, action?: NotificationToastData['action']) => {
  showNotification({
    type: 'success',
    title,
    message,
    action,
    duration: 4000
  });
};

export const showError = (title: string, message: string, action?: NotificationToastData['action']) => {
  showNotification({
    type: 'error',
    title,
    message,
    action,
    duration: 6000
  });
};

export const showWarning = (title: string, message: string, action?: NotificationToastData['action']) => {
  showNotification({
    type: 'warning',
    title,
    message,
    action,
    duration: 5000
  });
};

export const showJobCompleted = (jobId: string, fileName: string, results: any) => {
  showNotification({
    type: 'job_completed',
    title: 'Enrichment Complete! 🎉',
    message: `${fileName} has been processed successfully`,
    action: {
      label: 'View Results',
      onClick: () => window.location.href = `/batches?highlight=${jobId}`
    },
    data: { jobId, fileName, results },
    duration: 0 // Don't auto-dismiss
  });
};

export const showLowCredits = (credits: number) => {
  showNotification({
    type: 'low_credits',
    title: 'Low Credits Warning ⚠️',
    message: `You have ${credits} credits remaining`,
    action: {
      label: 'Top Up Credits',
      onClick: () => window.location.href = '/billing'
    },
    duration: 0 // Don't auto-dismiss
  });
};

export const showCreditPurchase = (amount: number) => {
  showNotification({
    type: 'credit_purchase',
    title: 'Credits Added! ✨',
    message: `${amount.toLocaleString()} credits have been added to your account`,
    duration: 4000
  });
};

export const showFileImportStarted = (fileName: string, enrichmentType: string) => {
  showNotification({
    type: 'success',
    title: 'Import Started! 📤',
    message: `${fileName} - ${enrichmentType} enrichment is now processing`,
    duration: 5000
  });
};

export const showManualImportStarted = (contactCount: number) => {
  showNotification({
    type: 'success', 
    title: 'Manual Import Started! ✍️',
    message: `${contactCount} manually added contacts are now being enriched`,
    duration: 5000
  });
};

export const clearAllNotifications = () => {
  if ((window as any).clearNotifications) {
    (window as any).clearNotifications();
  }
};

export default NotificationManager; 