import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Check, X, Clock, CreditCard, Briefcase, AlertTriangle,
  Settings, Filter, Trash2, MarkAsUnread, Star, ChevronDown,
  Search, Calendar, Eye, ExternalLink, CheckCircle,
  Info, AlertCircle, Download, User, Mail, Phone,
  MoreVertical, Volume2, VolumeX, Smartphone, Archive
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: NotificationAction[];
  data?: any;
}

interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface EnhancedNotificationPanelProps {
  notifications: Notification[];
  onNotificationRead: (id: string) => void;
  onNotificationDelete: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  isOpen: boolean;
  onClose: () => void;
}

interface GroupedNotifications {
  today: any[];
  yesterday: any[];
  thisWeek: any[];
  older: any[];
}

const EnhancedNotificationPanel: React.FC<EnhancedNotificationPanelProps> = ({
  notifications,
  onNotificationRead,
  onNotificationDelete,
  onMarkAllAsRead,
  onClearAll,
  isOpen,
  onClose
}) => {
  const { notifications: contextNotifications, unreadCount, markAsRead, markAllAsRead, deleteAllNotifications, loading } = useNotifications();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  
  const [filter, setFilter] = useState<'all' | 'unread' | 'job_completed' | 'credits'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Get notification icon with animation
  const getNotificationIcon = (type: string, isRead: boolean) => {
    const iconClass = `h-5 w-5 ${isRead ? 'opacity-60' : ''}`;
    
    switch (type) {
      case 'batch_complete':
      case 'job_completed':
        return <Briefcase className={`${iconClass} text-emerald-500`} />;
      case 'credit_purchase':
        return <Star className={`${iconClass} text-purple-500`} />;
      case 'low_credits':
        return <CreditCard className={`${iconClass} text-orange-500`} />;
      case 'system_update':
        return <AlertTriangle className={`${iconClass} text-blue-500`} />;
      default:
        return <Bell className={`${iconClass} text-gray-500`} />;
    }
  };

  // Format time with relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Group notifications by date
  const groupNotificationsByDate = (notifications: any[]): GroupedNotifications => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    return notifications.reduce((groups, notification) => {
      const notifDate = new Date(notification.created_at);
      const notifDay = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate());

      if (notifDay.getTime() === today.getTime()) {
        groups.today.push(notification);
      } else if (notifDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(notification);
      } else if (notifDay.getTime() > weekAgo.getTime()) {
        groups.thisWeek.push(notification);
      } else {
        groups.older.push(notification);
      }

      return groups;
    }, { today: [], yesterday: [], thisWeek: [], older: [] });
  };

  // Filter and search notifications
  const filteredNotifications = notifications.filter(notification => {
    // Apply filter
    switch (filter) {
      case 'unread':
        if (notification.read) return false;
        break;
      case 'job_completed':
        if (notification.type !== 'job_completed' && notification.type !== 'batch_complete') return false;
        break;
      case 'credits':
        if (notification.type !== 'low_credits' && notification.type !== 'credit_purchase') return false;
        break;
    }

    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        notification.title.toLowerCase().includes(searchLower) ||
        notification.message.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  // Handle notification click
  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.data?.job_id) {
      navigate(`/batches?highlight=${notification.data.job_id}`);
      onClose();
    } else if (notification.type === 'low_credits' || notification.type === 'credit_purchase') {
      navigate('/billing');
      onClose();
    }
  };

  // Bulk actions
  const handleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const handleBulkMarkAsRead = () => {
    selectedNotifications.forEach(id => markAsRead(id));
    setSelectedNotifications(new Set());
  };

  // Render notification group
  const renderNotificationGroup = (title: string, notifications: any[]) => {
    if (notifications.length === 0) return null;

    return (
      <div className="mb-4">
        <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {title} ({notifications.length})
        </div>
        
        <div className="space-y-1">
          {notifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                relative px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 
                transition-all duration-200 cursor-pointer group
                ${!notification.read ? 
                  'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' : 
                  ''
                }
                ${selectedNotifications.has(notification.id) ? 
                  'bg-blue-100 dark:bg-blue-800/30' : 
                  ''
                }
              `}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start space-x-3">
                {/* Selection checkbox */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newSelected = new Set(selectedNotifications);
                    if (newSelected.has(notification.id)) {
                      newSelected.delete(notification.id);
                    } else {
                      newSelected.add(notification.id);
                    }
                    setSelectedNotifications(newSelected);
                  }}
                >
                  <div className={`
                    w-4 h-4 rounded border-2 flex items-center justify-center
                    ${selectedNotifications.has(notification.id) ?
                      'bg-blue-500 border-blue-500' :
                      'border-gray-300 dark:border-gray-600'
                    }
                  `}>
                    {selectedNotifications.has(notification.id) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                </motion.div>

                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {getNotificationIcon(notification.type, notification.read)}
                  </motion.div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      } ${notification.read ? 'opacity-70' : ''}`}>
                        {notification.title}
                      </p>
                      <p className={`text-sm mt-1 ${
                        isDark ? 'text-gray-300' : 'text-gray-600'
                      } ${notification.read ? 'opacity-60' : ''}`}>
                        {notification.message}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-3">
                      {!notification.read && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 bg-blue-500 rounded-full"
                        />
                      )}
                      <span className={`text-xs whitespace-nowrap ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons for job completion notifications */}
                  {notification.type === 'job_completed' && notification.data?.job_id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-center space-x-2"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/batches?highlight=${notification.data.job_id}`);
                          onClose();
                        }}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${
                          isDark 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                        }`}
                      >
                        View Results
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-end pr-4 pt-16"
      >
        <motion.div
          initial={{ opacity: 0, x: 400, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 400, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          ref={panelRef}
          className={`
            ${isMobile ? 'w-full max-h-screen rounded-none' : 'w-96 max-h-[600px] rounded-xl'} shadow-2xl border backdrop-blur-md
            ${isDark 
              ? 'bg-gray-800/95 border-gray-700' 
              : 'bg-white/95 border-gray-200'
            } 
            overflow-hidden
          `}
        >
          {/* Header */}
          <div className={`px-4 py-3 border-b backdrop-blur-sm ${
            isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <motion.div
                  animate={{ 
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3
                  }}
                >
                  <Bell className={`h-5 w-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
                </motion.div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-red-500 text-white text-xs px-2 py-1 rounded-full"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1 rounded ${
                    isDark 
                      ? 'hover:bg-gray-700 text-gray-400' 
                      : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className={`p-1 rounded ${
                    isDark 
                      ? 'hover:bg-gray-700 text-gray-400' 
                      : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            </div>

            {/* Search and filters */}
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`
                    w-full pl-10 pr-4 py-2 rounded-lg text-sm transition-colors
                    ${isDark 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'
                    }
                    border focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  `}
                />
              </div>

              {/* Filter buttons */}
              <div className="flex space-x-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'unread', label: 'Unread' },
                  { key: 'job_completed', label: 'Jobs' },
                  { key: 'credits', label: 'Credits' }
                ].map((filterOption) => (
                  <motion.button
                    key={filterOption.key}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFilter(filterOption.key as any)}
                    className={`
                      px-3 py-1 rounded-full text-xs font-medium transition-colors
                      ${filter === filterOption.key 
                        ? 'bg-blue-500 text-white' 
                        : isDark 
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }
                    `}
                  >
                    {filterOption.label}
                  </motion.button>
                ))}
              </div>

              {/* Bulk actions */}
              <AnimatePresence>
                {(selectedNotifications.size > 0 || unreadCount > 0) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      {selectedNotifications.size > 0 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleBulkMarkAsRead}
                          className={`text-xs px-3 py-1 rounded-full transition-colors ${
                            isDark 
                              ? 'bg-green-600 hover:bg-green-700 text-white' 
                              : 'bg-green-100 hover:bg-green-200 text-green-700'
                          }`}
                        >
                          Mark {selectedNotifications.size} as read
                        </motion.button>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {filteredNotifications.length > 0 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleSelectAll}
                          className={`text-xs ${
                            isDark 
                              ? 'text-blue-400 hover:text-blue-300' 
                              : 'text-blue-600 hover:text-blue-800'
                          }`}
                        >
                          {selectedNotifications.size === filteredNotifications.length ? 'Deselect all' : 'Select all'}
                        </motion.button>
                      )}
                      
                      {unreadCount > 0 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={markAllAsRead}
                          className={`text-xs ${
                            isDark 
                              ? 'text-blue-400 hover:text-blue-300' 
                              : 'text-blue-600 hover:text-blue-800'
                          }`}
                        >
                          Mark all read
                        </motion.button>
                      )}
                      
                      {notifications.length > 0 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={deleteAllNotifications}
                          className={`text-xs ${
                            isDark 
                              ? 'text-red-400 hover:text-red-300' 
                              : 'text-red-600 hover:text-red-800'
                          }`}
                        >
                          Delete all
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(600px - 200px)' }}>
            {loading && notifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block"
                >
                  <Clock className={`h-8 w-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                </motion.div>
                <div className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Loading notifications...
                </div>
              </motion.div>
            ) : filteredNotifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center"
              >
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Bell className={`h-12 w-12 mx-auto mb-3 ${
                    isDark ? 'text-gray-600' : 'text-gray-300'
                  }`} />
                </motion.div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {searchTerm || filter !== 'all' ? 'No matching notifications' : 'No notifications yet'}
                </div>
                {(searchTerm || filter !== 'all') && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSearchTerm('');
                      setFilter('all');
                    }}
                    className={`mt-2 text-xs ${
                      isDark 
                        ? 'text-blue-400 hover:text-blue-300' 
                        : 'text-blue-600 hover:text-blue-800'
                    }`}
                  >
                    Clear filters
                  </motion.button>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-2"
              >
                {renderNotificationGroup('Today', groupedNotifications.today)}
                {renderNotificationGroup('Yesterday', groupedNotifications.yesterday)}
                {renderNotificationGroup('This Week', groupedNotifications.thisWeek)}
                {renderNotificationGroup('Older', groupedNotifications.older)}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EnhancedNotificationPanel; 