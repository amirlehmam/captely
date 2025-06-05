import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Upload, ArrowDownUp, 
  Settings, CreditCard, LogOut, Database, Key, Sparkles
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
      label: t('navigation.dashboard'),
      badge: null
    },
    { 
      path: '/batches', 
      icon: <Database className="w-5 h-5" />, 
      label: t('navigation.batches'),
      badge: null
    },
    { 
      path: '/import', 
      icon: <Upload className="w-5 h-5" />, 
      label: t('navigation.import'),
      badge: 'Hot'
    },
    { 
      path: '/crm', 
      icon: <Users className="w-5 h-5" />, 
      label: t('navigation.contacts'),
      badge: null
    },
  ];

  const otherItems = [
    { 
      path: '/integrations', 
      icon: <ArrowDownUp className="w-5 h-5" />, 
      label: t('navigation.integrations'),
      badge: null
    },
    {
      path: '/api-tokens',
      icon: <Key className="w-5 h-5" />,
      label: t('navigation.apiTokens'),
      badge: null
    },
    { 
      path: '/settings', 
      icon: <Settings className="w-5 h-5" />, 
      label: t('navigation.settings'),
      badge: null
    },
    { 
      path: '/billing', 
      icon: <CreditCard className="w-5 h-5" />, 
      label: t('navigation.billing'),
      badge: null
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

  const creditUsagePercent = creditData && creditData.limit_monthly > 0 
    ? Math.min(100, (creditData.used_this_month / creditData.limit_monthly) * 100)
    : 0;

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-50">
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl transform translate-x-16 -translate-y-8"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl transform -translate-x-16 translate-y-8"></div>
        
        {/* Logo Section with continuous 360 animation */}
        <div className="relative flex flex-col items-center justify-center px-6 py-8 border-b border-slate-700/50">
          <div className="group cursor-pointer mb-4">
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
              className="logo-spin h-16 w-auto transition-transform duration-300 ease-in-out"
              src="/logo.png"
              alt="Captely"
              style={{
                filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.3))'
              }}
            />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Captely
            </h1>
            <p className="text-xs text-slate-400 mt-1">Contact Enrichment Platform</p>
          </div>
        </div>
        
        {/* Navigation Container */}
        <div className="flex flex-col flex-1 px-4 py-6">
          {/* Main Navigation */}
          <nav className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-4">
              Main
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `group relative flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/20 text-white shadow-lg shadow-primary-500/20 border border-primary-500/30' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50 hover:shadow-md'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
                      isActive ? 'bg-primary-500 text-white shadow-lg' : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                    }`}>
                      {item.icon}
                    </div>
                    <span className="ml-3 font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto px-2 py-1 text-xs font-semibold bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-400 to-primary-600 rounded-r-full"></div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Divider */}
          <div className="my-6 border-t border-slate-700/50"></div>

          {/* Other Items */}
          <nav className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-4">
              Tools & Settings
            </div>
            {otherItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `group relative flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/20 text-white shadow-lg shadow-primary-500/20 border border-primary-500/30' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50 hover:shadow-md'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
                      isActive ? 'bg-primary-500 text-white shadow-lg' : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                    }`}>
                      {item.icon}
                    </div>
                    <span className="ml-3 font-medium">{item.label}</span>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-400 to-primary-600 rounded-r-full"></div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Credit Usage Box - Moved up with better spacing */}
          <div className="mt-8 mb-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600/50 rounded-xl p-4 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-primary-400" />
                    {t('common.credit_usage')}
                  </h4>
                  <CreditCard className="h-4 w-4 text-primary-400" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Usage</span>
                    <span className="text-xs font-medium text-white">
                      {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} / ${creditData?.limit_monthly || 5000}`}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-slate-600/50 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-primary-400 to-primary-500 h-2 rounded-full transition-all duration-500 shadow-sm" 
                        style={{ width: `${creditUsagePercent}%` }}
                      ></div>
                    </div>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full opacity-50"></div>
                  </div>
                  <div className="text-xs text-primary-400 font-medium">
                    {creditLoading ? 'Loading...' : `${creditData?.used_this_month || 0} used`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      
        {/* User Section - Better positioned */}
        <div className="relative border-t border-slate-700/50 p-4">
          <div className="flex items-center">
            <div className="relative flex-shrink-0">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                <span className="text-sm font-bold text-white">{userInfo.initials}</span>
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-400 rounded-full border-2 border-slate-800"></div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {userInfo.name}
              </p>
              <p className="text-xs text-slate-400 flex items-center">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                {userInfo.plan} Plan
              </p>
            </div>
            <button 
              onClick={onLogout}
              className="ml-2 flex-shrink-0 p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200 group"
              title="Logout"
            >
              <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;