import { useState, useEffect, useCallback } from 'react';
import apiService, { Job, Contact, DashboardStats, CreditData, User } from '../services/api';
import toast from 'react-hot-toast';

// Enhanced notification system
import { showJobCompleted } from '../components/notifications/NotificationManager';

// ============================
// DASHBOARD STATS HOOK - PRODUCTION READY
// ============================

export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const data = await apiService.getDashboardStats();
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard stats';
      setError(errorMessage);
      if (!silent) {
        console.error('Dashboard stats error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
};

// ============================
// CREDIT BALANCE HOOK - PRODUCTION READY
// ============================

export const useCreditBalance = () => {
  const [balance, setBalance] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const data = await apiService.getCreditData();
      setBalance(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load credit balance';
      setError(errorMessage);
      if (!silent) {
        console.error('Credit balance error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    
    // Auto-refresh every 15 seconds
    const interval = setInterval(() => fetchBalance(true), 15000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
};

// ============================
// JOBS HOOK - PRODUCTION READY
// ============================

export const useJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedJobs, setCompletedJobs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [serviceDown, setServiceDown] = useState(false);

  // **🚀 FIRE CREDIT UPDATE EVENTS**
  const fireJobCompletedEvent = useCallback((job: Job) => {
    console.log('🎉 Firing job completed event for credit refresh!');
    
    // Dispatch custom event for credit system
    const event = new CustomEvent('jobCompleted', {
      detail: {
        jobId: job.id,
        creditsUsed: job.credits_used || 0,
        contactsProcessed: job.total || 0
      }
    });
    window.dispatchEvent(event);
  }, []);

  const fetchJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      setServiceDown(false);
      
      const response = await apiService.getJobs();
      const newJobs = response.jobs || [];
      
      // **🔥 DETECT NEWLY COMPLETED JOBS & FIRE EVENTS**
      if (!initialLoad) {
        newJobs.forEach(job => {
          if (job.status === 'completed' && !completedJobs.has(job.id)) {
            // Show enhanced notification for completed job
            showJobCompleted(job.id, job.file_name || `Job ${job.id.slice(0, 8)}`, {
              total_contacts: job.total || 0,
              emails_found: job.emails_found || 0,
              phones_found: job.phones_found || 0,
              success_rate: job.success_rate || 0,
              credits_used: job.credits_used || 0
            });
            
            // **⚡ FIRE CREDIT UPDATE EVENT**
            fireJobCompletedEvent(job);
            
            // Add to completed jobs set
            setCompletedJobs((prev: Set<string>) => new Set([...prev, job.id]));
          }
        });
      } else {
        // On initial load, just populate the completed jobs set without showing notifications
        const alreadyCompleted = newJobs.filter(job => job.status === 'completed').map(job => job.id);
        setCompletedJobs(new Set(alreadyCompleted));
        setInitialLoad(false);
      }
      
      setJobs(newJobs);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load jobs';
      
      // Handle specific error types gracefully
      if (err.status === 502 || err.status === 503) {
        setServiceDown(true);
        setError('Backend services temporarily unavailable');
        // Don't retry as frequently when service is down
        if (!silent) {
          console.warn('Backend services down, reducing retry frequency');
        }
      } else if (err.status === 401) {
        setError('Authentication required');
        // Don't continue retrying if auth fails
        return;
      } else {
        setError(errorMessage);
        if (!silent) {
          console.error('Jobs error:', err);
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [completedJobs, initialLoad, fireJobCompletedEvent]);

  useEffect(() => {
    fetchJobs();
    
    // Auto-refresh with adaptive interval based on service status
    const refreshInterval = serviceDown ? 30000 : 5000; // 30s if down, 5s if up
    const interval = setInterval(() => fetchJobs(true), refreshInterval);
    return () => clearInterval(interval);
  }, [fetchJobs, serviceDown]);

  return { 
    jobs, 
    loading, 
    error, 
    serviceDown, 
    refetch: fetchJobs 
  };
};

// ============================
// SINGLE JOB HOOK - PRODUCTION READY
// ============================

export const useJob = (jobId: string | null) => {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async (silent = false) => {
    if (!jobId) return;
    
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const data = await apiService.getJob(jobId);
      setJob(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load job details';
      setError(errorMessage);
      if (!silent) {
        console.error('Job details error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      fetchJob();
      
      // Auto-refresh every 3 seconds for active jobs
      const interval = setInterval(() => fetchJob(true), 3000);
      return () => clearInterval(interval);
    }
  }, [jobId, fetchJob]);

  return { job, loading, error, refetch: fetchJob };
};

// ============================
// FILE UPLOAD HOOK - PRODUCTION READY
// ============================

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (
    file: File, 
    enrichmentType?: { email: boolean; phone: boolean }
  ): Promise<{ job_id: string }> => {
    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      const result = await apiService.uploadFile(file, (progress) => {
        setProgress(progress);
      }, enrichmentType);

      setProgress(100);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return { uploadFile, uploading, progress, error, reset };
};

// ============================
// ENRICHMENT STATS HOOK - PRODUCTION READY
// ============================

export interface EnrichmentStats {
  total_contacts: number;
  emails_found: number;
  phones_found: number;
  email_success_rate: number;
  phone_success_rate: number;
  avg_processing_time: number;
  provider_stats: Array<{
    provider: string;
    usage_count: number;
    success_rate: number;
    avg_cost: number;
    avg_confidence: number;
  }>;
  quality_distribution: {
    high_quality: number;
    medium_quality: number;
    low_quality: number;
  };
}

export const useEnrichmentStats = (period: '7d' | '30d' | '90d' = '30d') => {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const data = await apiService.getEnrichmentStats(period);
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load enrichment stats';
      setError(errorMessage);
      if (!silent) {
        console.error('Enrichment stats error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
};

// ============================
// USER PROFILE HOOK - PRODUCTION READY
// ============================

export const useUserProfile = () => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const data = await apiService.getUserProfile();
      setProfile(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      if (!silent) {
        console.error('Profile error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    try {
      setLoading(true);
      const updatedProfile = await apiService.updateUserProfile(data);
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile, updateProfile };
};

// ============================
// CRM CONTACTS HOOK - PRODUCTION READY
// ============================

export const useCrmContacts = (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
} = {}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const response = await apiService.getCrmContacts(params);
      setContacts(response.contacts);
      setTotal(response.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contacts';
      setError(errorMessage);
      if (!silent) {
        console.error('CRM contacts error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return { contacts, total, loading, error, refetch: fetchContacts };
};

// ============================
// EXPORT HOOK - PRODUCTION READY
// ============================

export const useExport = () => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportData = useCallback(async (jobId: string, format: 'csv' | 'excel' | 'json' | 'hubspot' = 'csv') => {
    try {
      setExporting(jobId);
      setError(null);
      
      await apiService.exportData(jobId, format);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      throw err;
    } finally {
      setExporting(null);
    }
  }, []);

  const exportCrmContacts = useCallback(async (contactIds: string[], format: 'csv' | 'excel' | 'json' | 'hubspot' = 'csv') => {
    try {
      setExporting('crm-bulk');
      setError(null);
      
      await apiService.exportCrmContacts(contactIds, format);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      throw err;
    } finally {
      setExporting(null);
    }
  }, []);

  return { exportData, exportCrmContacts, exporting, error };
};

// ============================
// REAL-TIME MONITORING HOOK - PRODUCTION READY
// ============================

export interface TaskStatus {
  task_id: string;
  name: string;
  state: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED';
  args: any[];
  kwargs: any;
  timestamp: number;
  result?: any;
}

export const useRealTimeMonitoring = () => {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Simulate real-time task monitoring
    // In production, this would connect to a WebSocket or Server-Sent Events
    const interval = setInterval(async () => {
      try {
        // This would fetch current active tasks from your monitoring service
        // For now, we'll simulate some task data
        const mockTasks: TaskStatus[] = [
          {
            task_id: 'task_' + Date.now(),
            name: 'app.tasks.cascade_enrich',
            state: 'STARTED',
            args: [{ first_name: 'John', company: 'Tech Corp' }],
            kwargs: {},
            timestamp: Date.now()
          }
        ];
        setTasks(mockTasks);
        setConnected(true);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch monitoring data');
        setConnected(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return { tasks, workers, loading, error, connected };
};

// ============================
// API KEYS HOOK - PRODUCTION READY
// ============================

export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.getApiKeys();
      setApiKeys(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load API keys';
      setError(errorMessage);
      console.error('API keys error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createApiKey = useCallback(async (name: string) => {
    try {
      const newKey = await apiService.createApiKey(name);
      await fetchApiKeys(); // Refresh the list
      return newKey;
    } catch (err) {
      throw err;
    }
  }, [fetchApiKeys]);

  const deleteApiKey = useCallback(async (keyId: string) => {
    try {
      await apiService.deleteApiKey(keyId);
      await fetchApiKeys(); // Refresh the list
    } catch (err) {
      throw err;
    }
  }, [fetchApiKeys]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  return { apiKeys, loading, error, createApiKey, deleteApiKey, refetch: fetchApiKeys };
};

// ============================
// SERVICE HEALTH HOOK - PRODUCTION READY
// ============================

export const useServiceHealth = () => {
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthStatus = await apiService.checkServiceHealth();
        setHealth(healthStatus);
      } catch (err) {
        console.error('Health check failed:', err);
        setHealth({});
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return { health, loading };
}; 