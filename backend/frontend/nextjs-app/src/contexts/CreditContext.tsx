import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

  const fetchCreditData = useCallback(async () => {
    try {
      setLoading(true);
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

      // Use environment variable or fallback
      const importUrl = (window as any).__RUNTIME_CONFIG__?.VITE_IMPORT_URL || 
                       import.meta.env?.VITE_IMPORT_URL || 
                       'http://localhost:8002';

      const response = await fetch(`${importUrl}/user/credits`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid - clear it
          localStorage.removeItem('captely_jwt');
          sessionStorage.removeItem('captely_jwt');
          throw new Error('Authentication expired. Please log in again.');
        }
        throw new Error(`Failed to fetch credit data: ${response.status}`);
      }

      const data = await response.json();
      setCreditData(data);
      setError(null);

    } catch (err) {
      console.error('Credit fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load credit data';
      setError(errorMessage);
      
      // Set fallback data to keep UI functional
      setCreditData({
        balance: 0,
        used_today: 0,
        used_this_month: 0,
        limit_daily: 500,
        limit_monthly: 10000,
        subscription: {
          package_name: 'Error',
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
      setLoading(false);
    }
  }, []);

  const refreshCredits = useCallback(async () => {
    await fetchCreditData();
  }, [fetchCreditData]);

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

  // Initial fetch
  useEffect(() => {
    fetchCreditData();
  }, [fetchCreditData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchCreditData, 30000);
    return () => clearInterval(interval);
  }, [fetchCreditData]);

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