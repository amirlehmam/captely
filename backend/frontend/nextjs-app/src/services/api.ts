/**
 * Captely API Service Layer
 * Connects to all backend microservices
 */

import toast from 'react-hot-toast';

interface ApiConfig {
  authUrl: string;
  importUrl: string;
  analyticsUrl: string;
  crmUrl: string;
  exportUrl: string;
  billingUrl: string;
}

// Get API URLs from environment or fallback to defaults
const getApiConfig = (): ApiConfig => {
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    const runtimeConfig = (window as any).__RUNTIME_CONFIG__;
    if (runtimeConfig) {
      return {
        authUrl: runtimeConfig.VITE_AUTH_URL || getDefaultUrl('auth'),
        importUrl: runtimeConfig.VITE_IMPORT_URL || getDefaultUrl('import'),
        analyticsUrl: runtimeConfig.VITE_ANALYTICS_URL || getDefaultUrl('analytics'),
        crmUrl: runtimeConfig.VITE_CRM_URL || getDefaultUrl('crm'),
        exportUrl: runtimeConfig.VITE_EXPORT_URL || getDefaultUrl('export'),
        billingUrl: runtimeConfig.VITE_BILLING_URL || getDefaultUrl('billing')
      };
    }
  }

  // Fallback to import.meta.env for development
  return {
    authUrl: import.meta.env?.VITE_AUTH_URL || getDefaultUrl('auth'),
    importUrl: import.meta.env?.VITE_IMPORT_URL || getDefaultUrl('import'),
    analyticsUrl: import.meta.env?.VITE_ANALYTICS_URL || getDefaultUrl('analytics'),
    crmUrl: import.meta.env?.VITE_CRM_URL || getDefaultUrl('crm'),
    exportUrl: import.meta.env?.VITE_EXPORT_URL || getDefaultUrl('export'),
    billingUrl: import.meta.env?.VITE_BILLING_URL || getDefaultUrl('billing')
  };
};

// Get default URL based on environment
const getDefaultUrl = (service: string): string => {
  const isProduction = import.meta.env?.PROD || window.location.protocol === 'https:';
  
  if (isProduction) {
    // Production URLs - use /api/ prefix to match nginx routing
    const serviceMap: Record<string, string> = {
      auth: 'https://captely.com',  // Special case: auth uses both /auth/ and /api/auth/
      import: 'https://captely.com/api',
      credit: 'https://captely.com/api',
      export: 'https://captely.com/api',
      analytics: 'https://captely.com/api',
      notification: 'https://captely.com/api',
      billing: 'https://captely.com/api',
      crm: 'https://captely.com/api'
    };
    return serviceMap[service] || 'https://captely.com/api';
  } else {
    // Development URLs
    const portMap: Record<string, number> = {
      auth: 8001,
      import: 8002,
      credit: 8003,
      export: 8004,
      analytics: 8005,
      notification: 8006,
      billing: 8007,
      crm: 8008
    };
    return `http://localhost:${portMap[service]}`;
  }
};

const API_CONFIG = getApiConfig();

// Error types
class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Base API client with authentication
class ApiClient {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  private handleUnauthorized(): void {
    // Token expired or invalid, clear and redirect to login
    localStorage.removeItem('captely_jwt');
    sessionStorage.removeItem('captely_jwt');
    window.location.href = '/login';
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorData: any = null;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          errorData = await response.json();
          
          // Handle 422 validation errors with detailed messages
          if (response.status === 422 && errorData) {
            if (errorData.detail) {
              // Handle FastAPI validation errors
              if (Array.isArray(errorData.detail)) {
                const validationErrors = errorData.detail.map((err: any) => {
                  if (err.loc && err.msg) {
                    return `${err.loc.join('.')}: ${err.msg}`;
                  }
                  return err.msg || JSON.stringify(err);
                }).join(', ');
                errorMessage = `Validation failed: ${validationErrors}`;
              } else if (typeof errorData.detail === 'string') {
                errorMessage = `Validation failed: ${errorData.detail}`;
              } else {
                errorMessage = `Validation failed: ${JSON.stringify(errorData.detail)}`;
              }
            } else if (errorData.errors) {
              // Handle other validation error formats
              errorMessage = `Validation failed: ${JSON.stringify(errorData.errors)}`;
            } else {
              errorMessage = `Validation failed: ${JSON.stringify(errorData)}`;
            }
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } else {
          errorMessage = await response.text();
        }
      } catch (e) {
        // If parsing fails, use status text
        errorMessage = response.statusText || errorMessage;
      }

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new ApiError(401, 'Authentication required');
      }

      throw new ApiError(response.status, errorMessage, errorData);
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      return response.json();
    }
    return response.text() as any;
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const searchParams = params ? new URLSearchParams(params).toString() : '';
    const fullUrl = `${url}${searchParams ? `?${searchParams}` : ''}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: data instanceof FormData ? data : JSON.stringify(data)
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<T>(response);
  }

  // File upload with progress
  async uploadFile<T>(url: string, file: File, onProgress?: (progress: number) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch {
            resolve(xhr.responseText as any);
          }
        } else {
          reject(new ApiError(xhr.status, xhr.statusText));
        }
      };

      xhr.onerror = () => reject(new ApiError(0, 'Network error'));

      // Set headers before opening the request
      xhr.open('POST', url);
      
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  }
}

const client = new ApiClient();

// Type definitions
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  credits: number;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'credit_insufficient';
  total: number;
  completed: number;
  progress: number;
  success_rate: number;
  email_hit_rate: number;
  phone_hit_rate: number;
  emails_found: number;
  phones_found: number;
  credits_used: number;
  avg_confidence: number;
  file_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface Contact {
  id: string;
  job_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  location?: string;
  industry?: string;
  profile_url?: string;
  enriched: boolean;
  enrichment_status: string;
  enrichment_provider?: string;
  enrichment_score?: number;
  email_verified: boolean;
  phone_verified: boolean;
  email_verification_score?: number;
  phone_verification_score?: number;
  notes?: string;
  credits_consumed?: number;
  created_at: string;
  updated_at?: string;
}

export interface DashboardStats {
  overview: {
    total_contacts: number;
    emails_found: number;
    phones_found: number;
    success_rate: number;
    email_hit_rate: number;
    phone_hit_rate: number;
    avg_confidence: number;
    credits_used_today: number;
    credits_used_month: number;
  };
  recent_jobs: Job[];
  active_jobs: Job[];
  provider_performance: Array<{
    provider: string;
    success_rate: number;
    avg_confidence: number;
    total_requests: number;
    status: 'active' | 'inactive' | 'error';
  }>;
}

export interface CreditData {
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

// Production-ready API service
class ApiService {
  // ==========================================
  // AUTHENTICATION
  // ==========================================
  
  async login(email: string, password: string): Promise<{ access: string; user: User }> {
    try {
      const response = await client.post<{ access_token: string; user?: User }>(`${API_CONFIG.authUrl}/auth/login`, {
        email: email,
        password: password
      });
      
      if (response.access_token) {
        localStorage.setItem('captely_jwt', response.access_token);
        toast.success('Successfully logged in!');
      }
      
      // If user data is not returned, fetch it separately
      let user = response.user;
      if (!user) {
        user = await this.getUserProfile();
      }
      
      return { access: response.access_token, user };
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
      throw error;
    }
  }

  async register(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    company?: string;
  }): Promise<{ access: string; user: User }> {
    try {
      const response = await client.post<{ access_token: string; user?: User }>(`${API_CONFIG.authUrl}/auth/signup`, userData);
      
      if (response.access_token) {
        localStorage.setItem('captely_jwt', response.access_token);
        toast.success('Account created successfully!');
      }
      
      // If user data is not returned, fetch it separately
      let user = response.user;
      if (!user) {
        user = await this.getUserProfile();
      }
      
      return { access: response.access_token, user };
    } catch (error) {
      toast.error('Registration failed. Please try again.');
      throw error;
    }
  }

  // Alias for signup compatibility
  async signup(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    company?: string;
  }): Promise<{ access: string; user: User }> {
    return this.register(userData);
  }

  async getUserProfile(): Promise<User> {
    return client.get<User>(`${API_CONFIG.authUrl}/auth/me`);
  }

  async updateUserProfile(data: Partial<User>): Promise<User> {
    const response = await client.put<User>(`${API_CONFIG.authUrl}/api/users/profile`, data);
    toast.success('Profile updated successfully!');
    return response;
  }

  // ==========================================
  // AUTHENTICATION - OAUTH METHODS
  // ==========================================

  async oauthSignup(provider: 'google' | 'apple', data: any): Promise<{
    user: any;
    needsInfo: boolean;
    token?: string;
  }> {
    try {
      const response = await fetch(`${API_CONFIG.authUrl}/auth/oauth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          ...data
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'OAuth signup failed');
      }

      const result = await response.json();
      
      if (result.token) {
        localStorage.setItem('captely_jwt', result.token);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  async completeOAuthSignup(data: {
    firstName: string;
    lastName: string;
    company: string;
    phone: string;
    authMethod: string;
  }): Promise<any> {
    try {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      
      const response = await fetch(`${API_CONFIG.authUrl}/auth/oauth/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: data.firstName,
          last_name: data.lastName,
          company: data.company,
          phone: data.phone,
          auth_method: data.authMethod
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to complete OAuth signup');
      }

      const result = await response.json();
      
      if (result.token) {
        localStorage.setItem('captely_jwt', result.token);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================
  // DASHBOARD & ANALYTICS
  // ==========================================

  async getDashboardStats(): Promise<DashboardStats> {
    return client.get<DashboardStats>(`${API_CONFIG.analyticsUrl}/api/analytics/dashboard`);
  }

  async getEnrichmentStats(period: '7d' | '30d' | '90d' = '30d'): Promise<any> {
    return client.get(`${API_CONFIG.analyticsUrl}/api/analytics/enrichment`, { period });
  }

  // ==========================================
  // CREDITS
  // ==========================================

  async getCreditData(): Promise<CreditData> {
    return client.get<CreditData>(`${API_CONFIG.importUrl}/api/user/credits`);
  }

  async deductCredits(credits: number, reason: string): Promise<{ success: boolean; new_balance: number }> {
    return client.post(`${API_CONFIG.importUrl}/api/credits/deduct`, {
      credits,
      operation_type: 'enrichment',
      reason
    });
  }

  async refundCredits(credits: number, reason: string): Promise<{ success: boolean; new_balance: number }> {
    return client.post(`${API_CONFIG.importUrl}/api/credits/refund`, {
      credits,
      reason
    });
  }

  // ==========================================
  // IMPORT & JOBS
  // ==========================================

  async uploadFile(
    file: File, 
    onProgress?: (progress: number) => void,
    enrichmentType?: { email: boolean; phone: boolean }
  ): Promise<{ job_id: string }> {
    try {
      // Create FormData with file and enrichment options
      const formData = new FormData();
      formData.append('file', file);
      
      // Add enrichment type parameters if provided
      if (enrichmentType) {
        formData.append('enrich_email', enrichmentType.email.toString());
        formData.append('enrich_phone', enrichmentType.phone.toString());
      } else {
        // Default to both if not specified (backward compatibility)
        formData.append('enrich_email', 'true');
        formData.append('enrich_phone', 'true');
      }
      
      // Use the raw fetch API for better control over FormData
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      
      const xhr = new XMLHttpRequest();
      
      return new Promise<{ job_id: string }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              
              // Show success message with enrichment type info
              const typeText = enrichmentType?.email && enrichmentType?.phone 
                ? 'Email + Phone enrichment'
                : enrichmentType?.email 
                  ? 'Email enrichment'
                  : enrichmentType?.phone 
                    ? 'Phone enrichment'
                    : 'Full enrichment';
              
              toast.success(`File uploaded successfully! ${typeText} started.`);
              resolve(response);
            } catch (error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new ApiError(xhr.status, errorResponse.message || 'Upload failed', errorResponse));
            } catch {
              reject(new ApiError(xhr.status, `Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timeout'));
        });

        xhr.open('POST', `${API_CONFIG.importUrl}/api/imports/file`);
        
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        xhr.timeout = 300000; // 5 minutes timeout
        xhr.send(formData);
      });
    } catch (error) {
      toast.error('File upload failed. Please try again.');
      throw error;
    }
  }

  async getJobs(): Promise<{ jobs: Job[] }> {
    return client.get<{ jobs: Job[] }>(`${API_CONFIG.importUrl}/api/jobs`);
  }

  async getJob(jobId: string): Promise<Job> {
    return client.get<Job>(`${API_CONFIG.importUrl}/api/jobs/${jobId}`);
  }

  async getJobContacts(jobId: string, page: number = 1, limit: number = 50): Promise<{
    contacts: Contact[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    return client.get(`${API_CONFIG.importUrl}/api/jobs/${jobId}/contacts`, {
      page,
      limit
    });
  }

  // ==========================================
  // EXPORT
  // ==========================================

  async exportData(jobId: string, format: 'csv' | 'excel' | 'json' = 'csv'): Promise<Blob> {
    try {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      const response = await fetch(`${API_CONFIG.importUrl}/api/jobs/${jobId}/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      toast.success('Data exported successfully!');
      return response.blob();
    } catch (error) {
      toast.error('Export failed. Please try again.');
      throw error;
    }
  }

  // ==========================================
  // BATCH MANAGEMENT & CONTACT OPERATIONS
  // ==========================================

  async getContact(contactId: string): Promise<Contact> {
    return client.get<Contact>(`${API_CONFIG.importUrl}/api/contacts/${contactId}`);
  }

  async updateContact(contactId: string, data: {
    position?: string;
    notes?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    location?: string;
    industry?: string;
  }): Promise<Contact> {
    const response = await client.put<Contact>(`${API_CONFIG.importUrl}/api/contacts/${contactId}`, data);
    toast.success('Contact updated successfully!');
    return response;
  }

  async exportContactToHubSpot(contactId: string): Promise<{
    success: boolean;
    platform: string;
    platform_contact_id: string;
    contact_data: any;
    message: string;
  }> {
    try {
      const response = await client.post<{
        success: boolean;
        platform: string;
        platform_contact_id: string;
        contact_data: any;
        message: string;
      }>(`${API_CONFIG.importUrl}/api/contacts/${contactId}/export/hubspot`);
      toast.success('Contact exported to HubSpot successfully!');
      return response;
    } catch (error: any) {
      toast.error('Failed to export contact to HubSpot');
      throw error;
    }
  }

  async exportJobToHubSpot(jobId: string): Promise<{
    success: boolean;
    job_id: string;
    total_contacts: number;
    exported_count: number;
    failed_count: number;
    exported_contacts: any[];
    failed_contacts: any[];
    message: string;
  }> {
    try {
      const response = await client.post<{
        success: boolean;
        job_id: string;
        total_contacts: number;
        exported_count: number;
        failed_count: number;
        exported_contacts: any[];
        failed_contacts: any[];
        message: string;
      }>(`${API_CONFIG.importUrl}/api/jobs/${jobId}/export/hubspot`);
      toast.success('Batch exported to HubSpot successfully!');
      return response;
    } catch (error: any) {
      toast.error('Failed to export batch to HubSpot');
      throw error;
    }
  }

  async getExportLogs(page: number = 1, limit: number = 50): Promise<{
    logs: Array<{
      id: string;
      contact_id: string | null;
      platform: string;
      platform_contact_id: string;
      status: string;
      created_at: string;
      contact: {
        first_name: string;
        last_name: string;
        email: string;
        company: string;
      } | null;
    }>;
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    return client.get(`${API_CONFIG.importUrl}/api/export/logs`, {
      page,
      limit
    });
  }

  // ==========================================
  // VERIFICATION & ENRICHMENT ENGINE
  // ==========================================

  async verifyEmail(email: string): Promise<{
    email: string;
    is_valid: boolean;
    verification_level: number;
    is_catchall: boolean;
    is_disposable: boolean;
    is_role_based: boolean;
    deliverable: boolean;
    score: number;
    reason: string;
  }> {
    return client.post(`${API_CONFIG.importUrl}/api/verification/email`, { email });
  }

  async verifyPhone(phone: string, country_hint?: string): Promise<{
    phone: string;
    is_valid: boolean;
    is_mobile: boolean;
    is_landline: boolean;
    is_voip: boolean;
    country: string;
    carrier_name: string;
    region: string;
    formatted_international: string;
    score: number;
    reason: string;
  }> {
    return client.post(`${API_CONFIG.importUrl}/api/verification/phone`, { 
      phone, 
      country_hint 
    });
  }

  async enrichSingleContact(contactData: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    company?: string;
    company_domain?: string;
    profile_url?: string;
  }): Promise<{
    email?: string;
    phone?: string;
    confidence: number;
    source: string;
    email_verified: boolean;
    phone_verified: boolean;
    email_verification_score: number;
    phone_verification_score: number;
    email_verification_details: any;
    phone_verification_details: any;
    providers_tried: string[];
    total_cost: number;
    processing_time: number;
  }> {
    return client.post(`${API_CONFIG.importUrl}/api/enrichment/single`, contactData);
  }

  async getEnrichmentProviderStats(): Promise<{
    provider_stats: Array<{
      provider: string;
      success_rate: number;
      avg_confidence: number;
      total_requests: number;
      avg_cost: number;
      status: 'active' | 'inactive' | 'error';
    }>;
    cascade_stats: {
      avg_providers_per_contact: number;
      early_stop_rate: number;
      total_cost_saved: number;
    };
  }> {
    return client.get(`${API_CONFIG.importUrl}/api/enrichment/provider-stats`);
  }

  async verifyExistingContacts(jobId: string): Promise<{
    success: boolean;
    job_id: string;
    verified_count: number;
  }> {
    return client.post(`${API_CONFIG.importUrl}/api/verification/job/${jobId}/verify`);
  }

  async getVerificationStats(jobId?: string): Promise<{
    total_emails: number;
    verified_emails: number;
    invalid_emails: number;
    total_phones: number;
    verified_phones: number;
    invalid_phones: number;
    verification_scores: {
      email: {
        excellent: number;
        good: number;
        fair: number;
        poor: number;
      };
      phone: {
        mobile: number;
        landline: number;
        voip: number;
        invalid: number;
      };
    };
  }> {
    const endpoint = jobId 
      ? `${API_CONFIG.importUrl}/api/verification/stats/${jobId}`
      : `${API_CONFIG.importUrl}/api/verification/stats`;
    return client.get(endpoint);
  }

  // ==========================================
  // CRM - UNIFIED CONTACTS VIEW
  // ==========================================

  async getCrmContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    batch_filter?: string;
    status_filter?: string;
    email_reliability?: string;
    lead_score_min?: number;
    lead_score_max?: number;
  } = {}): Promise<{
    contacts: (Contact & {
      lead_score: number;
      email_reliability: string;
      batch_name?: string;
      batch_created_at?: string;
    })[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    filters_applied: any;
  }> {
    return client.get(`${API_CONFIG.importUrl}/api/crm/contacts`, params);
  }

  async getCrmContactsStats(): Promise<{
    overview: {
      total_contacts: number;
      enriched_contacts: number;
      contacts_with_email: number;
      contacts_with_phone: number;
      verified_emails: number;
      verified_phones: number;
      avg_lead_score: number;
      total_credits_consumed: number;
    };
    lead_quality: {
      high_quality: number;
      medium_quality: number;
      low_quality: number;
    };
    email_reliability: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  }> {
    return client.get(`${API_CONFIG.importUrl}/api/crm/contacts/stats`);
  }

  async getCrmBatches(): Promise<{
    batches: Array<{
      id: string;
      name: string;
      created_at: string;
      contact_count: number;
      enriched_count: number;
    }>;
  }> {
    return client.get(`${API_CONFIG.importUrl}/api/crm/batches`);
  }

  async bulkExportCrmContacts(
    contactIds: string[],
    exportType: 'hubspot' | 'csv' = 'hubspot'
  ): Promise<any> {
    try {
      const response = await client.post(`${API_CONFIG.importUrl}/api/crm/contacts/bulk-export`, {
        contact_ids: contactIds,
        export_type: exportType
      });
      
      if (exportType === 'csv') {
        // Handle CSV download
        return response;
      } else {
        toast.success(`Exported ${contactIds.length} contacts to HubSpot!`);
        return response;
      }
    } catch (error: any) {
      toast.error(`Failed to export contacts: ${error.message}`);
      throw error;
    }
  }

  // ==========================================
  // SETTINGS & CONFIGURATION
  // ==========================================

  async getNotificationSettings(): Promise<any> {
    return client.get(`${API_CONFIG.authUrl}/api/settings/notifications`);
  }

  async updateNotificationSettings(settings: any): Promise<any> {
    const response = await client.put(`${API_CONFIG.authUrl}/api/settings/notifications`, settings);
    toast.success('Notification settings updated!');
    return response;
  }

  async getApiKeys(): Promise<any[]> {
    return client.get(`${API_CONFIG.authUrl}/auth/apikeys`);
  }

  async createApiKey(name: string): Promise<{ id: string; token: string }> {
    const response = await client.post<{ id: string; key: string }>(`${API_CONFIG.authUrl}/auth/apikey`, { name });
    toast.success('API key created successfully!');
    return { id: response.id, token: response.key };
  }

  async deleteApiKey(keyId: string): Promise<void> {
    await client.delete(`${API_CONFIG.authUrl}/auth/apikeys/${keyId}`);
    toast.success('API key deleted successfully!');
  }

  // ==========================================
  // ADDITIONAL METHODS FOR SETTINGS PAGE
  // ==========================================

  async getCurrentSubscription(): Promise<any> {
    try {
      return await client.get(`${API_CONFIG.billingUrl}/api/subscription`);
    } catch (error) {
      // Fallback for demo
      return {
        plan: 'Professional',
        status: 'active',
        credits_monthly: 10000,
        credits_used: 3456,
        next_billing: '2024-02-01'
      };
    }
  }

  async getTeamMembers(): Promise<any[]> {
    try {
      return await client.get(`${API_CONFIG.authUrl}/api/team/members`);
    } catch (error) {
      // Fallback for demo
      return [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@company.com',
          role: 'admin',
          status: 'active',
          joined_at: '2024-01-15T00:00:00Z',
          last_active: '2024-01-30T10:30:00Z'
        }
      ];
    }
  }

  async getSecurityLogs(): Promise<any[]> {
    try {
      return await client.get(`${API_CONFIG.authUrl}/api/security/logs`);
    } catch (error) {
      // Fallback for demo
      return [
        {
          id: '1',
          event: 'Login successful',
          ip_address: '192.168.1.100',
          timestamp: new Date().toISOString(),
          status: 'success'
        }
      ];
    }
  }

  async getNotificationPreferences(userId: string): Promise<any> {
    try {
      return await client.get(`${API_CONFIG.authUrl}/api/users/${userId}/preferences`);
    } catch (error) {
      // Fallback for demo
      return {
        email_notifications: true,
        job_completion_alerts: true,
        credit_warnings: true,
        weekly_summary: false,
        low_credit_threshold: 100
      };
    }
  }

  async updateNotificationPreferences(userId: string, preferences: any): Promise<any> {
    try {
      const response = await client.put(`${API_CONFIG.authUrl}/api/users/${userId}/preferences`, preferences);
      toast.success('Notification preferences updated!');
      return response;
    } catch (error) {
      toast.error('Failed to update notification preferences');
      throw error;
    }
  }

  async getSetting(key: string): Promise<any> {
    try {
      return await client.get(`${API_CONFIG.authUrl}/api/settings/${key}`);
    } catch (error) {
      // Fallback for demo
      return { value: null };
    }
  }

  async updateSetting(key: string, value: any): Promise<any> {
    try {
      const response = await client.put(`${API_CONFIG.authUrl}/api/settings/${key}`, { value });
      return response;
    } catch (error) {
      console.warn(`Failed to save setting ${key}:`, error);
      // Don't throw error for settings to avoid blocking the UI
      return { success: false };
    }
  }

  async changePassword(data: { current_password: string; new_password: string }): Promise<any> {
    try {
      const response = await client.post(`${API_CONFIG.authUrl}/api/users/change-password`, data);
      toast.success('Password changed successfully!');
      return response;
    } catch (error) {
      toast.error('Failed to change password');
      throw error;
    }
  }

  // ==========================================
  // EMAIL VERIFICATION FOR SIGNUP
  // ==========================================

  async sendVerificationEmail(email: string): Promise<{ message: string; success: boolean }> {
    try {
      const response = await client.post<{ message: string; success: boolean }>(`${API_CONFIG.authUrl}/auth/send-verification`, { email });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async verifyEmailCode(email: string, code: string): Promise<{ message: string; success: boolean }> {
    try {
      const response = await client.post<{ message: string; success: boolean }>(`${API_CONFIG.authUrl}/auth/verify-email`, { email, code });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async createApiToken(name: string): Promise<{ id: string; token: string }> {
    return this.createApiKey(name);
  }

  async deleteApiToken(keyId: string): Promise<void> {
    return this.deleteApiKey(keyId);
  }

  async getApiTokens(): Promise<any[]> {
    return this.getApiKeys();
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  isAuthenticated(): boolean {
    return !!(localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt'));
  }

  logout(): void {
    localStorage.removeItem('captely_jwt');
    sessionStorage.removeItem('captely_jwt');
    toast.success('Logged out successfully!');
    window.location.href = '/login';
  }

  getCurrentUserId(): string | null {
    const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
    if (!token) return null;
    
    try {
      // Decode JWT to get user ID (in production, you might want to validate this server-side)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id || payload.sub;
    } catch {
      return null;
    }
  }

  // Health check for services
  async checkServiceHealth(): Promise<Record<string, boolean>> {
    const services = {
      auth: false,
      import: false,
      analytics: false
    };

    try {
      await client.get(`${API_CONFIG.authUrl}/health`);
      services.auth = true;
    } catch {}

    try {
      await client.get(`${API_CONFIG.importUrl}/health`);
      services.import = true;
    } catch {}

    try {
      await client.get(`${API_CONFIG.analyticsUrl}/health`);
      services.analytics = true;
    } catch {}

    return services;
  }

  async getCrmCampaigns(params: {
    page?: number;
    limit?: number;
  } = {}): Promise<any[]> {
    // Deprecated - CRM Campaigns removed per requirements
    return [];
  }

  async createCampaign(): Promise<any> {
    // Deprecated - CRM Campaigns removed per requirements
    throw new Error('CRM Campaigns feature has been removed');
  }

  async updateCampaignStatus(): Promise<any> {
    // Deprecated - CRM Campaigns removed per requirements
    throw new Error('CRM Campaigns feature has been removed');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 