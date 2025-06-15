import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, User } from 'lucide-react';
import CreditDisplay from './common/CreditDisplay';
import LanguageSwitcher from './common/LanguageSwitcher';
import DarkModeToggle from './common/DarkModeToggle';
import EnhancedNotificationPanel from './notifications/EnhancedNotificationPanel';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';

const Header: React.FC = () => {
  const [userName, setUserName] = useState('User');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to CRM page with search query
      navigate(`/crm?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchFocused(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        if (!apiService.isAuthenticated()) return;

        const profileData = await apiService.getUserProfile();
        const firstName = profileData.first_name || '';
        setUserName(firstName || 'User');
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserName();
  }, []);

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors duration-300 ${
      isDark ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-200'
    }`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left Section - Search */}
          <div className="flex-1 max-w-xl">
            <form onSubmit={handleSearch} className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className={`h-5 w-5 transition-colors duration-200 ${
                  isSearchFocused 
                    ? isDark ? 'text-primary-400' : 'text-primary-600'
                    : isDark ? 'text-gray-500' : 'text-gray-400'
                }`} />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                placeholder={t('search.placeholder')}
                className={`block w-full pl-10 pr-3 py-2.5 rounded-xl border transition-all duration-200 text-sm ${
                  isDark 
                    ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400 focus:bg-gray-700 focus:border-primary-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:bg-white focus:border-primary-500'
                } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                style={{ fontSize: '16px' }} // Prevent zoom on iOS
              />
            </form>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center space-x-3 ml-4">
            
            {/* Desktop Controls - Hidden on mobile */}
            <div className="hidden sm:flex items-center space-x-3">
              <DarkModeToggle size="sm" />
              <LanguageSwitcher variant="minimal" />
              <CreditDisplay variant="compact" showRefresh={false} />
            </div>
            
            {/* Notifications - Always visible */}
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`touch-target relative p-2 rounded-xl transition-all duration-200 ${
                isDark 
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800 active:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200'
              } ${showNotifications ? 'bg-primary-100 text-primary-700' : ''}`}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {/* User Avatar & Greeting - Responsive */}
            <div className="flex items-center space-x-2">
              {/* User Avatar */}
              <div className={`touch-target h-8 w-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 flex items-center justify-center ${
                isDark ? 'shadow-lg' : 'shadow-md'
              }`}>
                <User className="h-4 w-4 text-white" />
              </div>
              
              {/* Greeting - Hidden on small screens */}
              <div className="hidden md:flex flex-col">
                <span className={`text-xs ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {t('common.goodMorning')}
                </span>
                <span className={`text-sm font-medium ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {userName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-only controls row */}
        <div className="sm:hidden pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DarkModeToggle size="sm" />
              <LanguageSwitcher variant="minimal" />
            </div>
            <div className="flex items-center space-x-3">
              <CreditDisplay variant="compact" showRefresh={false} />
              <div className="flex items-center space-x-2">
                <span className={`text-xs ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Hi,
                </span>
                <span className={`text-sm font-medium ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {userName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Notification Panel */}
      <EnhancedNotificationPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
    </header>
  );
};

export default Header;