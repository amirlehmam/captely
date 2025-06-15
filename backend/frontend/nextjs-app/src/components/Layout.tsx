import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ onLogout }) => {
  const { isDark } = useTheme();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Auto-close mobile menu when switching to desktop
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll when mobile menu is open (iOS compatible)
  useEffect(() => {
    if (isMobileMenuOpen && isMobile) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isMobileMenuOpen, isMobile]);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleToggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      
      {/* Mobile-Only Header Bar (hidden on desktop) */}
      {isMobile && (
        <div className={`fixed top-0 left-0 right-0 z-50 safe-area-top border-b backdrop-blur-md transition-colors duration-300 ${
          isDark ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-200'
        }`}>
          <div className="flex items-center justify-between h-14 px-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={handleToggleMobileMenu}
              className={`p-2 rounded-lg transition-all duration-200 ${
                isDark 
                  ? 'text-gray-300 hover:text-white hover:bg-gray-800 active:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200'
              } ${isMobileMenuOpen ? 'bg-primary-100 text-primary-700' : ''}`}
              style={{ minHeight: '44px', minWidth: '44px' }} // iOS touch target
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Mobile App Title */}
            <div className="flex-1 text-center">
              <h1 className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Captely
              </h1>
            </div>

            {/* Spacer for balance */}
            <div className="w-11"></div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (unchanged from original) */}
      <Sidebar 
        onLogout={onLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Navigation Drawer (only on mobile) */}
      {isMobile && (
        <>
          <MobileNavigation
            isOpen={isMobileMenuOpen}
            onClose={handleCloseMobileMenu}
            onLogout={onLogout}
          />

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-drawer"
              onClick={handleCloseMobileMenu}
              aria-hidden="true"
            />
          )}
        </>
      )}

      {/* Main Content Area - Preserved desktop layout */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ${
        // Desktop spacing (unchanged)
        isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
      } ${
        // Mobile spacing (only applied on mobile)
        isMobile ? 'pt-14' : ''
      }`}>
        
        {/* Desktop Header (unchanged) */}
        <Header />

        {/* Main Content (preserved original styling) */}
        <main className="flex-1">
          <div className={`py-6 px-4 sm:px-6 lg:px-8 ${
            isMobile ? 'pb-safe-bottom' : ''
          }`}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* iOS Safe Area Bottom Spacer (only on mobile) */}
      {isMobile && (
        <div className="safe-area-bottom bg-transparent pointer-events-none" />
      )}
    </div>
  );
};

export default Layout;