import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }
] as const;

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'dropdown' | 'inline' | 'minimal';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className = '', 
  variant = 'dropdown' 
}) => {
  const { language, setLanguage } = useLanguage();
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages.find(lang => lang.code === language);

  if (variant === 'inline') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              language === lang.code
                ? isDark 
                  ? 'bg-primary-900/30 text-primary-300 border border-primary-700/50'
                  : 'bg-primary-100 text-primary-700 border border-primary-200'
                : isDark
                  ? 'text-gray-300 hover:text-white hover:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span className="mr-1">{lang.flag}</span>
            {lang.name}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all duration-200 ${
              language === lang.code
                ? isDark
                  ? 'bg-primary-900/30 ring-2 ring-primary-500/50'
                  : 'bg-primary-100 ring-2 ring-primary-300'
                : isDark
                  ? 'hover:bg-gray-800'
                  : 'hover:bg-gray-100'
            }`}
            title={lang.name}
          >
            {lang.flag}
          </button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          isDark 
            ? 'border-gray-600 bg-gray-800 hover:bg-gray-700 focus:border-primary-400'
            : 'border-gray-200 bg-white hover:bg-gray-50 focus:border-primary-500'
        }`}
      >
        <Globe className={`h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          {currentLanguage?.flag} {currentLanguage?.name}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        } ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with improved positioning */}
            <div
              className="fixed inset-0 z-10"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                willChange: 'auto'
              }}
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown with anti-layout-shift positioning */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg border py-2 z-20 ${
                isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}
              style={{
                position: 'absolute',
                willChange: 'transform, opacity',
                minWidth: '192px',
                maxHeight: '240px',
                overflowY: 'auto'
              }}
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors duration-150 ${
                    isDark 
                      ? 'text-gray-200 hover:bg-gray-700' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  style={{
                    willChange: 'background-color',
                    minHeight: '36px'
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{lang.flag}</span>
                    <span className="font-medium">{lang.name}</span>
                  </div>
                  {language === lang.code && (
                    <Check className={`h-4 w-4 ${isDark ? 'text-primary-400' : 'text-primary-600'}`} />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher; 