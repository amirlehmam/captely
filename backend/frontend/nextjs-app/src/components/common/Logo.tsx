import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'auth';
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
  onClick?: () => void;
  showText?: boolean;
  animated?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'default',
  className = '',
  onClick,
  showText = true,
  animated = false
}) => {
  const { isDark } = useTheme();

  // Size configurations - NEW AUTH SIZE FOR LOGIN/SIGNUP
  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12', 
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
    xxl: 'w-48 h-48',
    auth: 'w-full max-w-md h-auto' // New size for auth pages
  };

  const textSizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg', 
    lg: 'text-xl',
    xl: 'text-2xl',
    xxl: 'text-3xl',
    auth: 'text-2xl'
  };

  // Choose the appropriate logo based on theme
  const logoSrc = isDark ? '/logo-white.png' : '/logo.png';

  // NEW SLIDE ANIMATION - from left to right
  const slideAnimation = `
    @keyframes logoSlide {
      0% { 
        transform: translateX(-100%);
        opacity: 0;
      }
      50% {
        opacity: 1;
      }
      100% { 
        transform: translateX(0);
        opacity: 1;
      }
    }
    .logo-slide-effect {
      overflow: hidden;
      position: relative;
    }
    .logo-slide-effect:hover .logo-slide-inner {
      animation: logoSlide 0.6s ease-out;
    }
  `;

  const handleClick = () => {
    if (onClick) onClick();
  };

  if (variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={handleClick}
      >
        {animated && <style>{slideAnimation}</style>}
        <div className={animated ? 'logo-slide-effect' : ''}>
          <img
            src={logoSrc}
            alt="Captely"
            className={`${sizeClasses[size]} ${animated ? 'logo-slide-inner' : ''} object-contain transition-transform duration-300`}
          />
        </div>
        {showText && (
          <span className={`ml-3 font-bold ${textSizes[size]} ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Captely
          </span>
        )}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div 
        className={`inline-block ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={handleClick}
      >
        {animated && <style>{slideAnimation}</style>}
        <div className={`${animated ? 'logo-slide-effect' : ''} ${size === 'auth' ? 'w-full flex justify-center' : ''}`}>
          <img
            src={logoSrc}
            alt="Captely"
            className={`${sizeClasses[size]} ${animated ? 'logo-slide-inner' : ''} object-contain transition-transform duration-300`}
            style={size === 'auth' ? { 
              width: 'auto',
              height: '80px', // Fixed height for auth pages
              maxWidth: '400px' // Match the width of form fields
            } : {}}
          />
        </div>
      </div>
    );
  }

  // Default variant - with transparent background and larger size
  return (
    <div 
      className={`inline-flex flex-col items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
    >
      {animated && <style>{slideAnimation}</style>}
      <div className={`
        rounded-2xl overflow-hidden p-2
        transition-all duration-300
        bg-transparent
        ${animated ? 'logo-slide-effect' : ''}
      `}>
        <img
          src={logoSrc}
          alt="Captely"
          className={`${sizeClasses[size]} ${animated ? 'logo-slide-inner' : ''} object-contain transition-transform duration-300 w-auto h-auto max-w-none`}
          style={{ 
            filter: 'brightness(1.2) contrast(1.3) drop-shadow(0 2px 8px rgba(0,0,0,0.1))',
            width: 'auto',
            height: 'auto',
            maxWidth: '350px',  // Much larger max width
            minWidth: '250px',  // Much larger min width  
            backgroundColor: 'transparent',
            mixBlendMode: 'multiply'
          }}
        />
      </div>
      {showText && (
        <div className="mt-3 text-center">
          <h1 className={`font-bold ${textSizes[size]} ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Captely
          </h1>
          <p className={`text-xs mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Lead Intelligence Platform
          </p>
        </div>
      )}
    </div>
  );
};

export default Logo; 