import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Upload, ArrowDownUp, 
  Settings, CreditCard, LogOut, Database, Key, 
  X, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreditContext } from '../contexts/CreditContext';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './common/Logo';
import DarkModeToggle from './common/DarkModeToggle';
import LanguageSwitcher from './common/LanguageSwitcher';
import apiService from '../services/api';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ isOpen, onClose, onLogout }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { creditData, loading: creditLoading } = useCreditContext();
  const location = useLocation();
  
  const [userInfo, setUserInfo] = useState({
    name: 'Loading...',
    plan: 'Free',
    initials: 'U'
  });

  // Navigation items optimized for mobile
  const navItems = [
    { 
      path: '/', 
      icon: <LayoutDashboard className="w-6 h-6" />, 
      label: t('navigation.dashboard'),
      description: 'Overview & Analytics'
    },
    { 
      path: '/batches', 
      icon: <Database className="w-6 h-6" />, 
      label: t('navigation.batches'),
      description: 'Import History'
    },
    { 
      path: '/import', 
      icon: <Upload className="w-6 h-6" />, 
      label: t('navigation.import'),
      description: 'Upload New Data'
    },
    { 
      path: '/crm', 
      icon: <Users className="w-6 h-6" />, 
      label: t('navigation.contacts'),
      description: 'Manage Contacts'
    },
  ];

  const settingsItems = [
    { 
      path: '/integrations', 
      icon: <ArrowDownUp className="w-6 h-6" />, 
      label: t('navigation.integrations'),
      description: 'Connect Apps'
    },
    {
      path: '/api-tokens',
      icon: <Key className="w-6 h-6" />,
      label: t('navigation.apiTokens'),
      description: 'API Access'
    },
    { 
      path: '/settings', 
      icon: <Settings className="w-6 h-6" />, 
      label: t('navigation.settings'),
      description: 'Preferences'
    },
    { 
      path: '/billing', 
      icon: <CreditCard className="w-6 h-6" />, 
      label: t('navigation.billing'),
      description: 'Plans & Usage'
    },
  ];

  // Fetch user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        if (!apiService.isAuthenticated()) return;

        const profileData = await apiService.getUserProfile();
        const firstName = profileData.first_name || '';
        const lastName = profileData.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'User';
        const initials = ((firstName || '').charAt(0) + (lastName || '').charAt(0)).toUpperCase() || 'U';

        let planName = t('billing.plans.free');
        try {
          const subscriptionData = await apiService.getCurrentSubscription();
          planName = subscriptionData.plan_name || t('billing.plans.free');
        } catch (billingError) {
          console.log('Billing info not available, using default plan');
        }

        setUserInfo({
          name: fullName,
          plan: planName,
          initials: initials
        });
      } catch (error) {
        console.error('Error fetching user info:', error);
        setUserInfo({
          name: 'User',
          plan: t('billing.plans.free'),
          initials: 'U'
        });
      }
    };

    if (isOpen) {
      fetchUserInfo();
    }
  }, [t, isOpen]);

  // Close drawer when navigation changes
  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  const handleNavClick = () => {
    onClose();
  };

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  return (
    <>
      {/* Mobile Navigation Drawer */}
      <div className={`fixed inset-y-0 left-0 z-drawer transform transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:hidden`}>
        <div className={`w-80 max-w-sm h-full flex flex-col safe-area-top border-r ${
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        } shadow-mobile-lg`}>
          
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-100'
          }`}>
            <Logo 
              size="xl" 
              variant="minimal" 
              animated={false}
              showText={true}
              className="flex-shrink-0"
            />
            <button
              onClick={onClose}
              className={`touch-target flex items-center justify-center rounded-xl transition-all duration-200 ${
                isDark 
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800 active:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200'
              }`}
              aria-label="Close navigation"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* User Info */}
          <div className={`p-4 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-100'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 flex items-center justify-center">
                <span className="text-base font-medium text-white">{userInfo.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-base font-medium truncate ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {userInfo.name}
                </p>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {userInfo.plan} {t('billing.currentPlan').toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-2 overflow-y-auto">
            {/* Main Navigation */}
            <div className="space-y-1">
              <h3 className={`px-3 text-xs font-semibold uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Main
              </h3>
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) => 
                    `mobile-nav-item group flex items-center px-3 py-3 text-base font-medium rounded-xl transition-all duration-200 ${
                      isActive 
                        ? isDark 
                          ? 'bg-primary-900/30 text-primary-300 shadow-mobile border border-primary-700/50' 
                          : 'bg-primary-50 text-primary-700 shadow-mobile border border-primary-100'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-800 hover:text-white active:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                    }`
                  }
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {item.icon}
                    <div className="flex-1">
                      <div className="text-base font-medium">{item.label}</div>
                      <div className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-30" />
                </NavLink>
              ))}
            </div>

            {/* Settings Section */}
            <div className="space-y-1 pt-4">
              <h3 className={`px-3 text-xs font-semibold uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Settings
              </h3>
              {settingsItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) => 
                    `mobile-nav-item group flex items-center px-3 py-3 text-base font-medium rounded-xl transition-all duration-200 ${
                      isActive 
                        ? isDark 
                          ? 'bg-primary-900/30 text-primary-300 shadow-mobile border border-primary-700/50' 
                          : 'bg-primary-50 text-primary-700 shadow-mobile border border-primary-100'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-800 hover:text-white active:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                    }`
                  }
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {item.icon}
                    <div className="flex-1">
                      <div className="text-base font-medium">{item.label}</div>
                      <div className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-30" />
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Credit Usage - Mobile Optimized */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className={`rounded-xl p-4 ${
              isDark 
                ? 'bg-gradient-to-br from-primary-900/30 to-primary-800/30 border border-primary-700/50' 
                : 'bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-sm font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {t('common.credit_usage')}
                </h4>
                <CreditCard className={`h-4 w-4 ${
                  isDark ? 'text-primary-400' : 'text-primary-600'
                }`} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Usage
                  </span>
                  <span className={`text-xs font-medium ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} / ${creditData?.limit_monthly || 5000}`}
                  </span>
                </div>
                <div className={`w-full rounded-full h-2 ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <div 
                    className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-500" 
                    style={{
                      width: creditData && creditData.limit_monthly > 0 
                        ? `${Math.min(100, (creditData.used_this_month / creditData.limit_monthly) * 100)}%`
                        : '0%'
                    }}
                  />
                </div>
                <div className={`text-xs font-medium ${
                  isDark ? 'text-primary-400' : 'text-primary-600'
                }`}>
                  {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} used this month`}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className={`p-4 border-t space-y-3 ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            {/* Theme & Language Controls */}
            <div className="flex items-center justify-between">
              <DarkModeToggle size="sm" />
              <LanguageSwitcher variant="minimal" />
            </div>

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className={`w-full mobile-nav-item flex items-center justify-center px-4 py-3 text-base font-medium rounded-xl transition-all duration-200 ${
                isDark 
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20 active:bg-red-900/30' 
                  : 'text-red-600 hover:text-red-700 hover:bg-red-50 active:bg-red-100'
              }`}
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sign Out
            </button>
          </div>

          {/* Safe Area Bottom */}
          <div className="safe-area-bottom" />
        </div>
      </div>
    </>
  );
};

export default MobileNavigation; 