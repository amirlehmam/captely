import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
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

  // Size configurations
  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12', 
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
    xxl: 'w-32 h-32'
  };

  const textSizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg', 
    lg: 'text-xl',
    xl: 'text-2xl',
    xxl: 'text-3xl'
  };

  // Choose the appropriate logo based on theme
  const logoSrc = isDark ? '/logo-white.png' : '/logo.png';

  // Animation classes
  const animationClasses = animated ? 'transition-all duration-300 ease-in-out hover:scale-110 hover:rotate-6' : '';
  const spinAnimation = animated ? `
    @keyframes logoSpin {
      from { transform: rotate(0deg) scale(1); }
      to { transform: rotate(360deg) scale(1.1); }
    }
    .logo-spin-effect:hover {
      animation: logoSpin 0.8s ease-in-out;
    }
  ` : '';

  const handleClick = () => {
    if (onClick) onClick();
  };

  if (variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={handleClick}
      >
        {animated && <style>{spinAnimation}</style>}
        <img
          src={logoSrc}
          alt="Captely"
          className={`${sizeClasses[size]} ${animationClasses} ${animated ? 'logo-spin-effect' : ''} object-contain`}
        />
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
        {animated && <style>{spinAnimation}</style>}
        <img
          src={logoSrc}
          alt="Captely"
          className={`${sizeClasses[size]} ${animationClasses} ${animated ? 'logo-spin-effect' : ''} object-contain`}
        />
      </div>
    );
  }

  // Default variant - with container background
  return (
    <div 
      className={`inline-flex flex-col items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
    >
      {animated && <style>{spinAnimation}</style>}
      <div className={`
        rounded-2xl shadow-lg overflow-hidden p-3
        ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}
        ${animationClasses}
        transition-all duration-300
      `}>
        <img
          src={logoSrc}
          alt="Captely"
          className={`${sizeClasses[size]} ${animated ? 'logo-spin-effect' : ''} object-contain transition-transform duration-300`}
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