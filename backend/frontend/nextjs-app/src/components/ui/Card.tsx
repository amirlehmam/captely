import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  gradient = false,
  padding = 'md'
}) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const baseClasses = `
    bg-white 
    rounded-xl 
    shadow-soft
    border border-gray-100
    ${paddingClasses[padding]}
    ${gradient ? 'bg-gradient-to-br from-white to-gray-50' : ''}
  `;

  if (hover) {
    return (
      <motion.div
        className={`${baseClasses} ${className}`}
        whileHover={{ 
          scale: 1.02,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
        }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
};

export default Card; 