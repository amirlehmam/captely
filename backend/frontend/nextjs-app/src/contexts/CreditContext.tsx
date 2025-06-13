import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  debug?: {
    total_allocated: number;
    used_credits: number;
    remaining_credits: number;
    usage_percentage: number;
  };
}

interface CreditContextType {
  creditData: CreditData | null;
  loading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
  deductCredits: (amount: number) => void;
  hasEnoughCredits: (amount: number) => boolean;
  // New real-time features
  forceRefresh: () => Promise<void>;
  isRealTime: boolean;
  lastUpdated: Date | null;
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
  const [isRealTime, setIsRealTime] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Refs for managing intervals and preventing race conditions
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);

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
        setLastUpdated(new Date());
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
    const authCheckInterval = setInterval(checkAuth, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(authCheckInterval);
    };
  }, []);

  const fetchCreditData = useCallback(async (retryCount: number = 0, silent: boolean = false) => {
    if (!isMountedRef.current) return;
    
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
        setLastUpdated(new Date());
        retryCountRef.current = 0;
        return;
      }

      // Small delay to ensure token is properly set after login
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const data = await apiService.getCreditData();
      
      if (isMountedRef.current) {
        setCreditData(data);
        setError(null);
        setLastUpdated(new Date());
        retryCountRef.current = 0;
        
        // Log real-time update for debugging
        if (silent) {
          console.log('🔄 Credit data auto-updated:', {
            balance: data.balance,
            used: data.used_this_month,
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }

    } catch (err) {
      if (!isMountedRef.current) return;
      
      console.error('Credit fetch error:', err);
      retryCountRef.current++;
      
      // If it's the first attempt and we just authenticated, retry once
      if (retryCount === 0 && isAuthenticated && retryCountRef.current < 3) {
        console.log('🔄 Retrying credit fetch after authentication...');
        setTimeout(() => fetchCreditData(1, silent), 1500);
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
      setLastUpdated(new Date());
    } finally {
      if (!silent && isMountedRef.current) setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshCredits = useCallback(async (silent: boolean = false) => {
    if (isAuthenticated && isMountedRef.current) {
      console.log('🔄 Manual credit refresh triggered');
      await fetchCreditData(0, silent);
    }
  }, [fetchCreditData, isAuthenticated]);

  // **🚀 INSTANT OPTIMISTIC CREDIT DEDUCTION**
  const deductCredits = useCallback((amount: number, reason: string = 'enrichment') => {
    console.log(`💳 Deducting ${amount} credits for ${reason}`);
    
    if (creditData && isMountedRef.current) {
      // **INSTANT UI UPDATE** - no waiting for server
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
      
      setLastUpdated(new Date());
      
      // **SYNC WITH SERVER** after UI update (background)
      setTimeout(() => {
        if (isMountedRef.current) {
          console.log('🔄 Syncing credit deduction with server...');
          fetchCreditData(0, true); // Silent sync
        }
      }, 1000);
    }
  }, [creditData, fetchCreditData]);

  // **🚀 FORCE IMMEDIATE REFRESH** (for job completions)
  const forceRefresh = useCallback(async () => {
    console.log('⚡ Force refreshing credits immediately!');
    if (isAuthenticated && isMountedRef.current) {
      // Clear any existing intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Immediate refresh
      await fetchCreditData(0, false);
      
      // Restart interval
      startRealTimePolling();
    }
  }, [isAuthenticated, fetchCreditData]);

  const hasEnoughCredits = useCallback((amount: number): boolean => {
    return creditData ? creditData.balance >= amount : false;
  }, [creditData]);

  // **🔥 REAL-TIME POLLING SYSTEM**
  const startRealTimePolling = useCallback(() => {
    if (!isAuthenticated || !isMountedRef.current) return;
    
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    console.log('🚀 Starting real-time credit polling (10s intervals)');
    
    // **FASTER POLLING** - 10 seconds instead of 30
    intervalRef.current = setInterval(() => {
      if (isAuthenticated && isMountedRef.current) {
        fetchCreditData(0, true); // Silent background refresh
      }
    }, 10000); // 10 seconds for near real-time experience
    
    setIsRealTime(true);
  }, [isAuthenticated, fetchCreditData]);

  // Fetch credits when authentication state changes to true
  useEffect(() => {
    if (isAuthenticated) {
      console.log('✅ User authenticated - fetching credits');
      fetchCreditData();
      startRealTimePolling();
    } else {
      console.log('❌ User not authenticated - stopping credit polling');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRealTime(false);
    }
  }, [isAuthenticated, fetchCreditData, startRealTimePolling]);

  // **🎯 LISTEN FOR JOB COMPLETION EVENTS**
  useEffect(() => {
    const handleJobCompleted = (event: any) => {
      console.log('🎉 Job completed event detected - refreshing credits!');
      forceRefresh();
    };

    const handleCreditUsed = (event: any) => {
      console.log('💰 Credit used event detected - updating balance!');
      if (event.detail?.amount) {
        deductCredits(event.detail.amount, event.detail.reason || 'enrichment');
      } else {
        forceRefresh();
      }
    };

    // Listen for custom events
    window.addEventListener('jobCompleted', handleJobCompleted);
    window.addEventListener('creditsUsed', handleCreditUsed);
    
    return () => {
      window.removeEventListener('jobCompleted', handleJobCompleted);
      window.removeEventListener('creditsUsed', handleCreditUsed);
    };
  }, [forceRefresh, deductCredits]);

  // **🧹 CLEANUP ON UNMOUNT**
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const value: CreditContextType = {
    creditData,
    loading,
    error,
    refreshCredits,
    deductCredits,
    hasEnoughCredits,
    forceRefresh,
    isRealTime,
    lastUpdated
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}; 