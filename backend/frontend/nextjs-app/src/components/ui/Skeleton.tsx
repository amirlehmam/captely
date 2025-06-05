import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  circle?: boolean;
  count?: number;
  animation?: 'pulse' | 'wave' | 'none';
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  circle = false,
  count = 1,
  animation = 'pulse'
}) => {
  const { isDark } = useTheme();

  const baseClasses = `
    ${isDark ? 'bg-gray-700' : 'bg-gray-200'}
    ${animation === 'pulse' ? 'animate-pulse' : ''}
    ${circle ? 'rounded-full' : 'rounded'}
  `;

  const getAnimationStyle = () => {
    if (animation === 'wave') {
      return {
        background: isDark 
          ? 'linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%)'
          : 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-wave 1.6s ease-in-out infinite'
      };
    }
    return {};
  };

  const skeletonElement = (
    <div
      className={`${baseClasses} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        minWidth: typeof width === 'number' ? `${width}px` : width,
        minHeight: typeof height === 'number' ? `${height}px` : height,
        willChange: animation !== 'none' ? 'opacity' : 'auto',
        ...getAnimationStyle()
      }}
    />
  );

  if (count === 1) {
    return skeletonElement;
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          {skeletonElement}
        </div>
      ))}
    </div>
  );
};

// Skeleton loading styles
export const SkeletonStyles = () => (
  <style jsx global>{`
    @keyframes skeleton-wave {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
  `}</style>
);

// Pre-built skeleton components for common use cases
export const SkeletonText: React.FC<{ lines?: number; width?: string }> = ({ 
  lines = 1, 
  width = '100%' 
}) => (
  <Skeleton count={lines} height="1rem" width={width} />
);

export const SkeletonCard: React.FC = () => {
  const { isDark } = useTheme();
  
  return (
    <div className={`rounded-xl p-6 border ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}
    style={{ minHeight: '200px' }}>
      <div className="space-y-4">
        <Skeleton height="1.5rem" width="60%" />
        <Skeleton height="1rem" width="40%" />
        <div className="space-y-2">
          <Skeleton height="1rem" />
          <Skeleton height="1rem" width="80%" />
          <Skeleton height="1rem" width="90%" />
        </div>
        <div className="flex space-x-4 pt-4">
          <Skeleton height="2.5rem" width="100px" />
          <Skeleton height="2.5rem" width="100px" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonAvatar: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Skeleton circle width={size} height={size} />
);

export const SkeletonButton: React.FC<{ width?: string }> = ({ width = '100px' }) => (
  <Skeleton height="2.5rem" width={width} />
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  const { isDark } = useTheme();
  
  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} height="1rem" width="80%" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <Skeleton key={colIndex} height="1rem" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton; 