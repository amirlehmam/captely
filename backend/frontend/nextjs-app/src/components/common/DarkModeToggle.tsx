import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface DarkModeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'button';
  className?: string;
}

const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ 
  size = 'md', 
  variant = 'icon',
  className = ''
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        className={`
          inline-flex items-center gap-2 px-4 py-2 
          bg-white dark:bg-gray-800 
          text-gray-700 dark:text-gray-200
          border border-gray-200 dark:border-gray-700
          rounded-lg shadow-sm hover:shadow-md
          transition-all duration-200 ease-in-out
          hover:bg-gray-50 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-800
          ${className}
        `}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <>
            <Sun size={iconSizes[size]} className="text-yellow-500" />
            <span className="text-sm font-medium">Light Mode</span>
          </>
        ) : (
          <>
            <Moon size={iconSizes[size]} className="text-slate-600 dark:text-slate-300" />
            <span className="text-sm font-medium">Dark Mode</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative ${sizeClasses[size]} 
        bg-gray-100 dark:bg-gray-700 
        border border-gray-200 dark:border-gray-600
        rounded-full p-2
        transition-all duration-300 ease-in-out
        hover:bg-gray-200 dark:hover:bg-gray-600
        hover:border-gray-300 dark:hover:border-gray-500
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
        dark:focus:ring-offset-gray-800
        transform hover:scale-105 active:scale-95
        shadow-sm hover:shadow-md
        ${className}
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Sun Icon */}
        <Sun 
          size={iconSizes[size]} 
          className={`
            absolute text-yellow-500 transition-all duration-500 ease-in-out
            ${isDark 
              ? 'opacity-0 transform rotate-90 scale-50' 
              : 'opacity-100 transform rotate-0 scale-100'
            }
          `}
        />
        
        {/* Moon Icon */}
        <Moon 
          size={iconSizes[size]} 
          className={`
            absolute text-slate-600 dark:text-slate-300 transition-all duration-500 ease-in-out
            ${isDark 
              ? 'opacity-100 transform rotate-0 scale-100' 
              : 'opacity-0 transform -rotate-90 scale-50'
            }
          `}
        />
      </div>
      
      {/* Glow effect for dark mode */}
      {isDark && (
        <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-pulse" />
      )}
    </button>
  );
};

export default DarkModeToggle; 