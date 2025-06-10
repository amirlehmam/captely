import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

interface CreditData {
  balance: number;
  used_today: number;
  used_this_month: number;
  limit_daily: number;
  limit_monthly: number;
  subscription: {
    package_name: string;
    monthly_limit: number;
  };
  statistics: {
    total_enriched: number;
    email_hit_rate: number;
    phone_hit_rate: number;
    avg_confidence: number;
    success_rate: number;
  };
}

interface CreditContextType {
  creditData: CreditData | null;
  loading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
  deductCredits: (amount: number) => void;
  hasEnoughCredits: (amount: number) => boolean;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export const useCreditContext = (): CreditContextType => {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCreditContext must be used within a CreditProvider');
  }
  return context;
};

interface CreditProviderProps {
  children: React.ReactNode;
}

export const CreditProvider: React.FC<CreditProviderProps> = ({ children }) => {
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Track authentication state changes
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      const authenticated = Boolean(token);
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        // Clear credit data when not authenticated
        setCreditData({
          balance: 0,
          used_today: 0,
          used_this_month: 0,
          limit_daily: 0,
          limit_monthly: 0,
          subscription: {
            package_name: 'Guest',
            monthly_limit: 0
          },
          statistics: {
            total_enriched: 0,
            email_hit_rate: 0,
            phone_hit_rate: 0,
            avg_confidence: 0,
            success_rate: 0
          }
        });
        setLoading(false);
        setError(null);
      }
      
      return authenticated;
    };

    // Initial check
    checkAuth();

    // Listen for storage changes (login/logout)
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for manual token changes
    const interval = setInterval(checkAuth, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const fetchCreditData = useCallback(async (retryCount: number = 0, silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      
      if (!token) {
        // Set default data for non-authenticated users
        setCreditData({
          balance: 0,
          used_today: 0,
          used_this_month: 0,
          limit_daily: 0,
          limit_monthly: 0,
          subscription: {
            package_name: 'Guest',
            monthly_limit: 0
          },
          statistics: {
            total_enriched: 0,
            email_hit_rate: 0,
            phone_hit_rate: 0,
            avg_confidence: 0,
            success_rate: 0
          }
        });
        setLoading(false);
        return;
      }

      // Small delay to ensure token is properly set after login
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const data = await apiService.getCreditData();
      setCreditData(data);
      setError(null);

    } catch (err) {
      console.error('Credit fetch error:', err);
      
      // If it's the first attempt and we just authenticated, retry once
      if (retryCount === 0 && isAuthenticated) {
        console.log('Retrying credit fetch after authentication...');
        setTimeout(() => fetchCreditData(1, silent), 1000);
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load credit data';
      setError(errorMessage);
      
      // Set fallback data but don't show "Error" in package name
      setCreditData({
        balance: 0,
        used_today: 0,
        used_this_month: 0,
        limit_daily: 500,
        limit_monthly: 10000,
        subscription: {
          package_name: 'Loading...',
          monthly_limit: 0
        },
        statistics: {
          total_enriched: 0,
          email_hit_rate: 0,
          phone_hit_rate: 0,
          avg_confidence: 0,
          success_rate: 0
        }
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshCredits = useCallback(async (silent: boolean = false) => {
    if (isAuthenticated) {
      await fetchCreditData(0, silent);
    }
  }, [fetchCreditData, isAuthenticated]);

  const deductCredits = useCallback((amount: number) => {
    if (creditData) {
      setCreditData(prev => prev ? {
        ...prev,
        balance: Math.max(0, prev.balance - amount),
        used_today: prev.used_today + amount,
        used_this_month: prev.used_this_month + amount,
        statistics: {
          ...prev.statistics,
          total_enriched: prev.statistics.total_enriched + 1
        }
      } : null);
    }
  }, [creditData]);

  const hasEnoughCredits = useCallback((amount: number): boolean => {
    return creditData ? creditData.balance >= amount : false;
  }, [creditData]);

  // Fetch credits when authentication state changes to true
  useEffect(() => {
    if (isAuthenticated) {
      fetchCreditData();
    }
  }, [isAuthenticated, fetchCreditData]);

  // 🎯 SILENT auto-refresh every 30 seconds - no loading states shown
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      if (isAuthenticated) {
        fetchCreditData(0, true); // Silent refresh - users won't see loading
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchCreditData, isAuthenticated]);

  const value: CreditContextType = {
    creditData,
    loading,
    error,
    refreshCredits,
    deductCredits,
    hasEnoughCredits
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}; 