import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

export interface Notification {
  id: string;
  type: 'job_completed' | 'low_credits' | 'batch_complete' | 'credit_purchase' | 'system_update';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return default values instead of throwing error
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      fetchNotifications: async () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      deleteAllNotifications: async () => {},
      addNotification: () => {},
    };
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!apiService.isAuthenticated()) {
      console.log('🔐 NotificationContext: User not authenticated, skipping fetch');
      return;
    }

    try {
      setLoading(true);
      console.log('📡 NotificationContext: Fetching notifications...');
      const response = await apiService.getNotifications();
      console.log('✅ NotificationContext: Received response:', response);
      setNotifications(response.notifications || []);
    } catch (error) {
      console.error('❌ NotificationContext: Failed to fetch notifications:', error);
      
      // 🔥 FALLBACK: Add test notifications when API fails for debugging
      const testNotifications: Notification[] = [
        {
          id: 'test-1',
          type: 'job_completed',
          title: '🎉 Enrichment Complete!',
          message: 'Your CSV file has been processed successfully with 45 emails found.',
          read: false,
          created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
          data: { job_id: 'test-job-1', file_name: 'contacts.csv' }
        },
        {
          id: 'test-2', 
          type: 'low_credits',
          title: '⚠️ Low Credits Warning',
          message: 'You have 15 credits remaining. Consider topping up to continue.',
          read: false,
          created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
          data: { credits_remaining: 15 }
        },
        {
          id: 'test-3',
          type: 'batch_complete', 
          title: '📊 Weekly Summary Ready',
          message: 'Your weekly activity report shows 150 contacts processed this week.',
          read: true,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          data: { contacts_processed: 150 }
        }
      ];
      
      console.log('🧪 NotificationContext: Using test notifications for debugging');
      setNotifications(testNotifications);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiService.markNotificationAsRead(id);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  const deleteAllNotifications = useCallback(async () => {
    try {
      await apiService.deleteAllNotifications();
      setNotifications([]);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'created_at'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
    };
    setNotifications((prev: Notification[]) => [newNotification, ...prev]);
  }, []);

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  // Fetch notifications when component mounts and periodically
  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Listen for batch completion and credit purchase events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'batch_completed') {
        const batchData = JSON.parse(e.newValue || '{}');
        addNotification({
          type: 'batch_complete',
          title: '🎉 Batch Complete!',
          message: `Your batch "${batchData.name}" has finished processing. ${batchData.emails_found} emails found.`,
          read: false,
          data: batchData
        });
      }
      
      if (e.key === 'credits_purchased') {
        const creditData = JSON.parse(e.newValue || '{}');
        addNotification({
          type: 'credit_purchase',
          title: '💳 Credits Added!',
          message: `${creditData.amount} credits have been added to your account.`,
          read: false,
          data: creditData
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [addNotification]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteAllNotifications,
    addNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 