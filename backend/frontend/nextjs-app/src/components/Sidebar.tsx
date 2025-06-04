import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Upload, ArrowDownUp, 
  Settings, CreditCard, LogOut, Database, PieChart, Key,
  UserPlus, Activity, Megaphone, ChevronDown, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  onLogout: () => void;
}

const navItems = [
  { 
    path: '/', 
    icon: <LayoutDashboard className="w-5 h-5" />, 
    label: 'Dashboard' 
  },
  { 
    path: '/batches', 
    icon: <Database className="w-5 h-5" />, 
    label: 'Batches' 
  },
  { 
    path: '/import', 
    icon: <Upload className="w-5 h-5" />, 
    label: 'Import' 
  },
];

const crmItems = [
  {
    path: '/crm',
    icon: <UserPlus className="w-4 h-4" />,
    label: 'Contacts'
  }
];

const otherItems = [
  { 
    path: '/integrations', 
    icon: <ArrowDownUp className="w-5 h-5" />, 
    label: 'Integrations' 
  },
  {
    path: '/api-tokens',
    icon: <Key className="w-5 h-5" />,
    label: 'API Tokens'
  },
  { 
    path: '/settings', 
    icon: <Settings className="w-5 h-5" />, 
    label: 'Settings' 
  },
  { 
    path: '/billing', 
    icon: <CreditCard className="w-5 h-5" />, 
    label: 'Billing' 
  },
];

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [userCredits, setUserCredits] = useState({ balance: 5000, used_this_month: 0, limit_monthly: 5000 });
  const [userInfo, setUserInfo] = useState({ name: 'Loading...', plan: 'Professional', initials: 'L' });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
        if (!token) return;

        // Fetch user credits
        const creditsResponse = await fetch(`${import.meta.env.VITE_IMPORT_URL || 'http://localhost:8002'}/api/user/credits`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json();
          setUserCredits(creditsData);
        }

        // Fetch user profile
        const profileResponse = await fetch(`${import.meta.env.VITE_AUTH_URL || 'http://localhost:8001'}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const firstName = profileData.first_name || '';
          const lastName = profileData.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'User';
          const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
          
          setUserInfo({ 
            name: fullName, 
            plan: 'Professional',
            initials: initials
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Keep loading state or fallback
        setUserInfo({ name: 'User', plan: 'Professional', initials: 'U' });
      }
    };

    fetchUserData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUserData, 30000);
    return () => clearInterval(interval);
  }, []);

  const creditPercentage = userCredits.limit_monthly > 0 
    ? ((userCredits.balance / userCredits.limit_monthly) * 100) 
    : 100;

  return (
    <div className="hidden md:flex w-64 flex-shrink-0 flex-col bg-white border-r border-gray-200 fixed h-full">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center justify-center h-24 px-4 mb-6">
          <img 
            src="/logo.png" 
            alt="Captely" 
            className="h-20 w-auto object-contain"
          />
        </div>
        
        {/* Credits remaining */}
        <div className="mx-4 my-6 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl border border-primary-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Credits
            </span>
            <span className="text-sm font-bold text-primary-600">
              {userCredits.balance.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-white rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(creditPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-right text-gray-600">
            {Math.round(creditPercentage)}% remaining
          </div>
        </div>
        
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {/* Main Navigation */}
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary-50 text-primary-700 shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              <span className="ml-3">{item.label}</span>
            </NavLink>
          ))}

          {/* CRM Section */}
          <div className="pt-4">
            <button
              onClick={() => setCrmExpanded(!crmExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all duration-200"
            >
              <div className="flex items-center">
                <Users className="w-5 h-5" />
                <span className="ml-3">CRM</span>
              </div>
              {crmExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            <AnimatePresence>
              {crmExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 ml-4 space-y-1 overflow-hidden"
                >
                  {crmItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => 
                        `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          isActive 
                            ? 'bg-primary-50 text-primary-700' 
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                    >
                      {item.icon}
                      <span className="ml-3">{item.label}</span>
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Other Items */}
          <div className="pt-4 space-y-1">
            {otherItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary-50 text-primary-700 shadow-sm' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
      
      {/* User Section */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 flex items-center justify-center">
            <span className="text-sm font-medium text-white">{userInfo.initials}</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">
              {userInfo.name}
            </p>
            <p className="text-xs font-medium text-gray-500">
              {userInfo.plan} Plan
            </p>
          </div>
          <button 
            onClick={onLogout}
            className="ml-auto flex-shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;