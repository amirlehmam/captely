import React, { useState } from 'react';
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
    path: '/crm/contacts',
    icon: <UserPlus className="w-4 h-4" />,
    label: 'Contacts'
  },
  {
    path: '/crm/activities',
    icon: <Activity className="w-4 h-4" />,
    label: 'Activities'
  },
  {
    path: '/crm/campaigns',
    icon: <Megaphone className="w-4 h-4" />,
    label: 'Campaigns'
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

  return (
    <div className="hidden md:flex w-64 flex-shrink-0 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center justify-center h-16">
          <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Captely Pro
          </span>
        </div>
        
        {/* Credits remaining */}
        <div className="mx-4 my-6 p-4 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-gray-700 dark:to-gray-700 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Credits
            </span>
            <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
              3,450
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full"
              style={{ width: '72%' }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-right text-gray-500 dark:text-gray-400">
            72% remaining
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
                    ? 'bg-gradient-to-r from-teal-50 to-blue-50 text-teal-700 dark:from-teal-900/30 dark:to-blue-900/30 dark:text-teal-300 shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
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
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
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
                            ? 'bg-gradient-to-r from-teal-50 to-blue-50 text-teal-700 dark:from-teal-900/30 dark:to-blue-900/30 dark:text-teal-300' 
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
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
                      ? 'bg-gradient-to-r from-teal-50 to-blue-50 text-teal-700 dark:from-teal-900/30 dark:to-blue-900/30 dark:text-teal-300 shadow-sm' 
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
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
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-r from-teal-500 to-blue-600 flex items-center justify-center">
            <span className="text-sm font-medium text-white">JD</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              John Doe
            </p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Professional Plan
            </p>
          </div>
          <button 
            onClick={onLogout}
            className="ml-auto flex-shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;