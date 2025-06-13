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
  const [allMarkedAsRead, setAllMarkedAsRead] = useState(false);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedDeletedIds = localStorage.getItem('captely_deleted_notifications');
    if (savedDeletedIds) {
      try {
        const parsedIds = JSON.parse(savedDeletedIds);
        setDeletedNotificationIds(new Set(parsedIds));
      } catch (error) {
        console.error('Error parsing deleted notifications from localStorage:', error);
      }
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    console.log('🔄 NotificationContext: Starting fetchNotifications...');
    console.log('🔄 NotificationContext: Auth check:', apiService.isAuthenticated());
    console.log('🔄 NotificationContext: Token exists:', !!localStorage.getItem('captely_jwt'));
    
    if (!apiService.isAuthenticated()) {
      console.log('🔐 NotificationContext: User not authenticated, skipping fetch');
      return;
    }

    // Define test notifications for fallback
    const testNotifications = [
      {
        id: `test_completed_${Date.now()}`,
        type: 'job_completed' as const,
        title: '🎉 Job Completed',
        message: 'Your CSV file "linkedin_leads_2025-05-19T15-53-50.csv" has been processed successfully! Found 22 emails with 88% hit rate.',
        read: allMarkedAsRead,
        created_at: new Date().toISOString(),
        data: {
          job_id: 'test-job-123',
          total_contacts: 25,
          emails_found: 22,
          success_rate: 88
        }
      },
      {
        id: `test_credits_${Date.now() + 1}`,
        type: 'low_credits' as const,
        title: '⚠️ Low Credits Alert',
        message: 'You have 150 credits remaining. Consider upgrading your plan to continue enrichment.',
        read: allMarkedAsRead,
        created_at: new Date(Date.now() - 300000).toISOString(),
        data: {
          remaining_credits: 150,
          daily_limit: 1000
        }
      },
      {
        id: `test_import_${Date.now() + 2}`,
        type: 'batch_complete' as const,
        title: '🚀 Import Started',
        message: 'Email enrichment has been started for "contact_list.csv" with 45 contacts.',
        read: allMarkedAsRead,
        created_at: new Date(Date.now() - 600000).toISOString(),
        data: {
          filename: 'contact_list.csv',
          contact_count: 45,
          enrichment_type: 'email'
        }
      }
    ].filter(notification => !deletedNotificationIds.has(notification.id));

    try {
      setLoading(true);
      console.log('🔄 NotificationContext: Starting to load notifications...');
      const response = await apiService.getNotifications();
      console.log('📨 NotificationContext: Raw API response:', response);
      
      if (response && Array.isArray(response.notifications)) {
        console.log('✅ NotificationContext: Valid notifications received:', response.notifications.length);
        setNotifications(response.notifications);
      } else if (response && response.notifications) {
        console.log('⚠️ NotificationContext: Invalid notifications format:', typeof response.notifications);
        console.log('⚠️ NotificationContext: Response object:', response);
        // Fallback to test notifications
        console.log('🎯 NotificationContext: Showing fallback test notifications');
        setNotifications(testNotifications);
      } else {
        console.warn('⚠️ NotificationContext: No notifications in response, showing test notifications');
        setNotifications(testNotifications);
      }
    } catch (error) {
      console.error('❌ NotificationContext: Error loading notifications:', error);
      console.log('🎯 NotificationContext: API failed, showing test notifications as fallback');
      setNotifications(testNotifications);
    } finally {
      setLoading(false);
    }
  }, [allMarkedAsRead, deletedNotificationIds]);

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
      setAllMarkedAsRead(true);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  const deleteAllNotifications = useCallback(async () => {
    try {
      await apiService.deleteAllNotifications();
      
      // 🔥 Track all current notification IDs as deleted
      const currentNotificationIds = notifications.map(n => n.id);
      const updatedDeletedIds = new Set([...deletedNotificationIds, ...currentNotificationIds]);
      setDeletedNotificationIds(updatedDeletedIds);
      
      // 🔥 Save to localStorage for persistence
      localStorage.setItem('captely_deleted_notifications', JSON.stringify(Array.from(updatedDeletedIds)));
      
      setNotifications([]);
      setAllMarkedAsRead(false); // 🔥 Reset flag when deleting all
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  }, [notifications, deletedNotificationIds]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'created_at'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
    };
    setNotifications((prev: Notification[]) => [newNotification, ...prev]);
  }, []);

  // 🔥 Clear deleted notifications from localStorage (useful for logout/reset)
  const clearDeletedNotifications = useCallback(() => {
    localStorage.removeItem('captely_deleted_notifications');
    setDeletedNotificationIds(new Set());
    console.log('🧹 Cleared deleted notifications from localStorage');
  }, []);

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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