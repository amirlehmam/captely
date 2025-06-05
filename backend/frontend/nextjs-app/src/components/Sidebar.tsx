import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Upload, ArrowDownUp, 
  Settings, CreditCard, LogOut, Database, Key
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCreditContext } from '../contexts/CreditContext';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const { t } = useLanguage();
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
        const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
        if (!token) return;

        // Fetch user profile
        const profileResponse = await fetch(`${import.meta.env.VITE_AUTH_URL || 'http://localhost:8001'}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const firstName = profileData.first_name || '';
          const lastName = profileData.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'User';
          const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';

          // Fetch subscription info
          const subscriptionResponse = await fetch(`${import.meta.env.VITE_BILLING_URL || 'http://localhost:8004'}/billing/subscription`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          let planName = t('billing.plans.free');
          if (subscriptionResponse.ok) {
            const subscriptionData = await subscriptionResponse.json();
            planName = subscriptionData.plan_name || t('billing.plans.free');
          }

          setUserInfo({
            name: fullName,
            plan: planName,
            initials: initials
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
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-50">
      <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
        {/* Logo Section with 360 animation */}
        <div className="flex flex-col items-center justify-center px-6 py-8 border-b border-gray-100">
          <div className="cursor-pointer mb-4">
            <style>{`
              @keyframes spin-continuous {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .logo-spin:hover {
                animation: spin-continuous 1s linear infinite;
              }
            `}</style>
            <img
              className="logo-spin h-20 w-auto transition-transform duration-300 ease-in-out"
              src="/logo.png"
              alt="Captely"
            />
          </div>
          <span className="text-lg font-semibold text-gray-900 text-center">Captely</span>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {/* Main Navigation */}
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              <span className="ml-3">{item.label}</span>
            </NavLink>
          ))}

          {/* Separator with better spacing */}
          <div className="py-3">
            <div className="border-t border-gray-200"></div>
          </div>

          {/* Other Items with consistent spacing */}
          {otherItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              <span className="ml-3">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        {/* Credit Usage Box - Better positioned */}
        <div className="px-4 pb-4">
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4 border border-primary-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">{t('common.credit_usage')}</h4>
              <CreditCard className="h-4 w-4 text-primary-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Usage</span>
                <span className="text-xs font-medium text-gray-900">
                  {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} / ${creditData?.limit_monthly || 5000}`}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-500" 
                  style={{
                    width: creditData && creditData.limit_monthly > 0 
                      ? `${Math.min(100, (creditData.used_this_month / creditData.limit_monthly) * 100)}%`
                      : '0%'
                  }}
                ></div>
              </div>
              <div className="text-xs text-primary-600 font-medium">
                {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} used`}
              </div>
            </div>
          </div>
        </div>
      
        {/* User Section - Proper spacing from credit box */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 flex items-center justify-center">
              <span className="text-sm font-medium text-white">{userInfo.initials}</span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userInfo.name}
              </p>
              <p className="text-xs font-medium text-gray-500">
                {userInfo.plan} {t('billing.currentPlan').toLowerCase()}
              </p>
            </div>
            <button 
              onClick={onLogout}
              className="ml-2 flex-shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;