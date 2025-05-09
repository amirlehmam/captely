import React, { useState } from 'react';
import { 
  Menu, Bell, Moon, Sun, Search, User, BarChart
} from 'lucide-react';

const Header: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    // In a real app, would toggle dark mode class on html/body
  };

  // Mobile sidebar toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
          
          {/* Left side - Page title (hidden on small screens) */}
          <div className="hidden md:block">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Dashboard
            </h1>
          </div>
          
          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm text-gray-900 dark:text-gray-100"
                placeholder="Search batches or contacts..."
              />
            </div>
            
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1 rounded-full text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            {/* Notifications */}
            <button className="p-1 rounded-full text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold text-white">
                3
              </span>
            </button>
            
            {/* Analytics */}
            <button className="p-1 rounded-full text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300">
              <BarChart className="h-5 w-5" />
            </button>
            
            {/* Profile dropdown (simplified) */}
            <button className="p-1 rounded-full text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300">
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;