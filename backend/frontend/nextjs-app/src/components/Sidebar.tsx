import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Upload, ArrowDownUp, 
  Settings, CreditCard, LogOut, Database, Key, 
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreditContext } from '../contexts/CreditContext';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './common/Logo';
import apiService from '../services/api';

interface SidebarProps {
  onLogout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isCollapsed, onToggleCollapse }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { creditData, loading: creditLoading } = useCreditContext();
  
  const navItems = [
    { 
      path: '/', 
      icon: <LayoutDashboard className="w-5 h-5" />, 
      label: t('navigation.dashboard')
    },
    { 
      path: '/batches', 
      icon: <Database className="w-5 h-5" />, 
      label: t('navigation.batches')
    },
    { 
      path: '/import', 
      icon: <Upload className="w-5 h-5" />, 
      label: t('navigation.import')
    },
    { 
      path: '/crm', 
      icon: <Users className="w-5 h-5" />, 
      label: t('navigation.contacts')
    },
  ];

  const otherItems = [
    { 
      path: '/integrations', 
      icon: <ArrowDownUp className="w-5 h-5" />, 
      label: t('navigation.integrations')
    },
    {
      path: '/api-tokens',
      icon: <Key className="w-5 h-5" />,
      label: t('navigation.apiTokens')
    },
    { 
      path: '/settings', 
      icon: <Settings className="w-5 h-5" />, 
      label: t('navigation.settings')
    },
    { 
      path: '/billing', 
      icon: <CreditCard className="w-5 h-5" />, 
      label: t('navigation.billing')
    },
  ];

  const [userInfo, setUserInfo] = useState({
    name: 'Loading...',
    plan: 'Free',
    initials: 'U'
  });

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        if (!apiService.isAuthenticated()) return;

        // Fetch user profile
        try {
          const profileData = await apiService.getUserProfile();
          const firstName = profileData.first_name || '';
          const lastName = profileData.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'User';
          const initials = ((firstName || '').charAt(0) + (lastName || '').charAt(0)).toUpperCase() || 'U';

          // Fetch subscription info
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
        } catch (profileError) {
          console.error('Error fetching user profile:', profileError);
          setUserInfo({
            name: 'User',
            plan: t('billing.plans.free'),
            initials: 'U'
          });
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        setUserInfo({
          name: 'User',
          plan: t('billing.plans.free'),
          initials: 'U'
        });
      }
    };

    fetchUserInfo();
  }, [t]);

  return (
    <div className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 z-50 transition-all duration-300 ${
      isCollapsed ? 'md:w-20' : 'md:w-64'
    }`}>
      <div className={`flex flex-col flex-grow border-r transition-colors duration-300 relative ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        {/* Collapse button - top right corner */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onToggleCollapse}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              isDark 
                ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Logo Section - centered as it was */}
        <div className={`flex flex-col items-center justify-center px-6 py-6 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-100'
        }`}>
          <Logo 
            size={isCollapsed ? "lg" : "xxl"} 
            variant="minimal" 
            animated={false}
            showText={!isCollapsed}
            className="transition-all duration-300"
          />
        </div>
        
        {/* Navigation */}
        <nav className={`flex-1 py-4 space-y-1 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {/* Main Navigation */}
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `group flex items-center ${isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'} text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? isDark 
                      ? 'bg-primary-900/30 text-primary-300 shadow-sm border border-primary-700/50' 
                      : 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
                    : isDark
                      ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
              title={isCollapsed ? item.label : undefined}
            >
              {item.icon}
              {!isCollapsed && <span className="ml-3">{item.label}</span>}
            </NavLink>
          ))}

          {/* Separator with better spacing */}
          <div className={`py-3 ${isCollapsed ? 'px-2' : 'px-0'}`}>
            <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
          </div>

          {/* Other Items with consistent spacing */}
          {otherItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `group flex items-center ${isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'} text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? isDark 
                      ? 'bg-primary-900/30 text-primary-300 shadow-sm border border-primary-700/50' 
                      : 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
                    : isDark
                      ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
              title={isCollapsed ? item.label : undefined}
            >
              {item.icon}
              {!isCollapsed && <span className="ml-3">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        
        {/* Credit Usage Box - Better positioned and responsive to collapse */}
        {!isCollapsed && (
          <div className="px-4 pb-4" style={{ minHeight: '120px' }}>
            <div className={`rounded-xl p-4 border transition-all duration-300 ${
              isDark 
                ? 'bg-gradient-to-br from-primary-900/30 to-primary-800/30 border-primary-700/50' 
                : 'bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200'
            }`}
            style={{ 
              willChange: 'background, border-color',
              minHeight: '100px'
            }}>
              <div className="flex items-center justify-between mb-3" style={{ height: '20px' }}>
                <h4 className={`text-sm font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {t('common.credit_usage')}
                </h4>
                <CreditCard className={`h-4 w-4 ${
                  isDark ? 'text-primary-400' : 'text-primary-600'
                }`} />
              </div>
              <div className="space-y-2" style={{ minHeight: '60px' }}>
                <div className="flex items-center justify-between" style={{ height: '16px' }}>
                  <span className={`text-xs ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Usage
                  </span>
                  <span className={`text-xs font-medium ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                  style={{ 
                    minWidth: '80px',
                    textAlign: 'right',
                    display: 'inline-block'
                  }}>
                    {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} / ${creditData?.limit_monthly || 5000}`}
                  </span>
                </div>
                <div className={`w-full rounded-full h-2 overflow-hidden ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}
                style={{ willChange: 'background-color' }}>
                  <div 
                    className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-500" 
                    style={{
                      width: creditData && creditData.limit_monthly > 0 
                        ? `${Math.min(100, (creditData.used_this_month / creditData.limit_monthly) * 100)}%`
                        : '0%',
                      willChange: 'width'
                    }}
                  ></div>
                </div>
                <div className={`text-xs font-medium ${
                  isDark ? 'text-primary-400' : 'text-primary-600'
                }`}
                style={{ 
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} used`}
                </div>
              </div>
            </div>
          </div>
        )}
      
        {/* User Section - Responsive to collapse */}
        <div className={`border-t p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'} ${
          isCollapsed ? 'px-2' : 'px-4'
        }`}>
          <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-2' : ''}`}>
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 flex items-center justify-center">
              <span className="text-sm font-medium text-white">{userInfo.initials}</span>
            </div>
            {!isCollapsed && (
              <>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium truncate ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {userInfo.name}
                  </p>
                  <p className={`text-xs font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {userInfo.plan} {t('billing.currentPlan').toLowerCase()}
                  </p>
                </div>
                <button 
                  onClick={onLogout}
                  className={`ml-2 flex-shrink-0 p-2 rounded-full transition-all duration-200 ${
                    isDark 
                      ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            )}
            {isCollapsed && (
              <button 
                onClick={onLogout}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isDark 
                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;