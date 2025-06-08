import React, { useState, useEffect } from 'react';
import { Bell, Search, Menu } from 'lucide-react';
import CreditDisplay from './common/CreditDisplay';
import LanguageSwitcher from './common/LanguageSwitcher';
import DarkModeToggle from './common/DarkModeToggle';
import { useLanguage } from '../contexts/LanguageContext';
import apiService from '../services/api';

const Header: React.FC = () => {
  const [userName, setUserName] = useState('User');
  const { t } = useLanguage();

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        if (!apiService.isAuthenticated()) return;

        // Fetch user profile
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
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40"
    style={{
      position: 'sticky',
      top: 0,
      willChange: 'background-color, border-color',
      minHeight: '64px'
    }}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16" style={{ minHeight: '64px' }}>
          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{
            willChange: 'background-color, color',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Menu className="h-6 w-6" />
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-lg mx-4" style={{ minWidth: '200px' }}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="search"
                placeholder={t('search.placeholder')}
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400 text-sm"
                style={{
                  willChange: 'background-color, border-color',
                  height: '40px'
                }}
              />
            </div>
          </div>

          {/* Right side items */}
          <div className="flex items-center space-x-4" style={{ minWidth: '320px' }}>
            {/* Dark Mode Toggle */}
            <DarkModeToggle size="sm" />
            
            {/* Language Switcher */}
            <LanguageSwitcher variant="minimal" />
            
            {/* Credit Display - PRODUCTION READY */}
            <CreditDisplay variant="compact" />
            
            <button className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            style={{
              willChange: 'background-color, color',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bell className="h-6 w-6" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-primary-500 dark:bg-primary-400 rounded-full"></span>
            </button>
            
            <div className="hidden md:flex items-center space-x-2 text-sm" style={{ minWidth: '120px' }}>
              <span className="text-gray-500 dark:text-gray-400">{t('common.goodMorning')},</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{userName}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;