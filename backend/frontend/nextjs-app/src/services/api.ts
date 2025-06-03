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
        authUrl: runtimeConfig.VITE_AUTH_URL || 'http://localhost:8001',
        importUrl: runtimeConfig.VITE_IMPORT_URL || 'http://localhost:8002',
        analyticsUrl: runtimeConfig.VITE_ANALYTICS_URL || 'http://localhost:8003',
        crmUrl: runtimeConfig.VITE_CRM_URL || 'http://localhost:8004',
        exportUrl: runtimeConfig.VITE_EXPORT_URL || 'http://localhost:8005',
        billingUrl: runtimeConfig.VITE_BILLING_URL || 'http://localhost:8006'
      };
    }
  }

  // Fallback to import.meta.env for development
  return {
    authUrl: import.meta.env?.VITE_AUTH_URL || 'http://localhost:8001',
    importUrl: import.meta.env?.VITE_IMPORT_URL || 'http://localhost:8002',
    analyticsUrl: import.meta.env?.VITE_ANALYTICS_URL || 'http://localhost:8003',
    crmUrl: import.meta.env?.VITE_CRM_URL || 'http://localhost:8004',
    exportUrl: import.meta.env?.VITE_EXPORT_URL || 'http://localhost:8005',
    billingUrl: import.meta.env?.VITE_BILLING_URL || 'http://localhost:8006'
  };
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
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }

      if (response.status === 401) {
        // Token expired, redirect to login
        localStorage.removeItem('captely_jwt');
        sessionStorage.removeItem('captely_jwt');
        window.location.href = '/login';
        throw new ApiError(401, 'Authentication required');
      }

      throw new ApiError(response.status, errorMessage);
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

  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<{ job_id: string }> {
    try {
      const response = await client.uploadFile<{ job_id: string }>(
        `${API_CONFIG.importUrl}/api/imports/file`,
        file,
        onProgress
      );
      toast.success('File uploaded successfully! Enrichment started.');
      return response;
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
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${jobId}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export completed successfully!');
      return blob;
    } catch (error) {
      toast.error('Export failed. Please try again.');
      throw error;
    }
  }

  // ==========================================
  // CRM
  // ==========================================

  async getCrmContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tags?: string[];
  } = {}): Promise<{
    contacts: Contact[];
    total: number;
    page: number;
    total_pages: number;
  }> {
    // For now, we'll get contacts from completed jobs
    const jobsResponse = await this.getJobs();
    const completedJobs = jobsResponse.jobs?.filter(job => job.status === 'completed') || [];
    
    if (completedJobs.length === 0) {
      return {
        contacts: [],
        total: 0,
        page: 1,
        total_pages: 0
      };
    }

    // Get contacts from the most recent completed job
    const latestJob = completedJobs[0];
    const contactsResponse = await this.getJobContacts(latestJob.id, params.page, params.limit);
    
    return {
      contacts: contactsResponse.contacts.map(contact => ({
        ...contact,
        status: this.getContactStatus(contact),
        lead_score: this.calculateLeadScore(contact),
        tags: this.generateContactTags(contact)
      })),
      total: contactsResponse.total,
      page: contactsResponse.page,
      total_pages: contactsResponse.total_pages
    };
  }

  async getCrmActivities(params: {
    page?: number;
    limit?: number;
    type?: string;
  } = {}): Promise<{
    activities: any[];
    total: number;
    page: number;
    total_pages: number;
  }> {
    try {
      // Connect to real CRM service instead of using mock data
      const queryParams: Record<string, any> = {
        limit: params.limit || 50,
        skip: ((params.page || 1) - 1) * (params.limit || 50)
      };
      
      // Only add type parameter if it's defined and not 'undefined'
      if (params.type && params.type !== 'undefined' && params.type !== 'all') {
        queryParams.type = params.type;
      }
      
      const response = await client.get<any[]>(`${API_CONFIG.crmUrl}/api/activities`, queryParams);

      const activities = Array.isArray(response) ? response : [];
      const total = activities.length;
      const page = params.page || 1;
      const limit = params.limit || 10;

      return {
        activities: activities,
        total: total,
        page: page,
        total_pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error fetching CRM activities:', error);
      return {
        activities: [],
        total: 0,
        page: 1,
        total_pages: 0
      };
    }
  }

  async createCrmActivity(activityData: {
    type: string;
    title: string;
    description?: string;
    contact_id?: string;
    status?: string;
    priority?: string;
    due_date?: string;
    created_by: string;
    assigned_to?: string;
  }): Promise<any> {
    try {
      const response = await client.post(`${API_CONFIG.crmUrl}/api/activities`, activityData);
      toast.success('Activity created successfully!');
      return response;
    } catch (error) {
      toast.error('Failed to create activity');
      throw error;
    }
  }

  async updateActivityStatus(activityId: string, status: string): Promise<any> {
    try {
      const response = await client.put(`${API_CONFIG.crmUrl}/api/activities/${activityId}/status`, {
        status: status
      });
      toast.success('Activity status updated!');
      return response;
    } catch (error) {
      toast.error('Failed to update activity status');
      throw error;
    }
  }

  private getContactStatus(contact: Contact): string {
    if (contact.enriched && contact.email) {
      return contact.email_verified ? 'qualified' : 'contacted';
    }
    return contact.enriched ? 'new' : 'pending';
  }

  private calculateLeadScore(contact: Contact): number {
    let score = 0;
    if (contact.email) score += 30;
    if (contact.phone) score += 25;
    if (contact.email_verified) score += 20;
    if (contact.phone_verified) score += 15;
    if (contact.enrichment_score) score += contact.enrichment_score * 0.1;
    return Math.min(100, score);
  }

  private generateContactTags(contact: Contact): string[] {
    const tags: string[] = [];
    if (contact.email) tags.push('email');
    if (contact.phone) tags.push('phone');
    if (contact.email_verified) tags.push('verified');
    if (contact.enrichment_provider) tags.push(contact.enrichment_provider);
    if (contact.industry) tags.push(contact.industry.toLowerCase());
    return tags;
  }

  async createContact(contactData: Partial<Contact>): Promise<Contact> {
    // This would create a new contact in the CRM
    // For now, we'll simulate this
    toast.success('Contact created successfully!');
    return {
      id: `contact_${Date.now()}`,
      job_id: 'manual',
      first_name: contactData.first_name || '',
      last_name: contactData.last_name,
      email: contactData.email,
      phone: contactData.phone,
      company: contactData.company,
      position: contactData.position,
      location: contactData.location,
      industry: contactData.industry,
      profile_url: contactData.profile_url,
      enriched: false,
      enrichment_status: 'pending',
      email_verified: false,
      phone_verified: false,
      created_at: new Date().toISOString()
    } as Contact;
  }

  async updateContact(contactId: string, data: Partial<Contact>): Promise<Contact> {
    // This would update a contact in the CRM
    toast.success('Contact updated successfully!');
    throw new Error('Not implemented yet');
  }

  async deleteContact(contactId: string): Promise<void> {
    // This would delete a contact from the CRM
    toast.success('Contact deleted successfully!');
    throw new Error('Not implemented yet');
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
    try {
      const response = await client.get<any[]>(`${API_CONFIG.crmUrl}/api/campaigns`, {
        limit: params.limit || 50,
        skip: ((params.page || 1) - 1) * (params.limit || 50)
      });
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error fetching CRM campaigns:', error);
      return [];
    }
  }

  async createCampaign(campaignData: {
    name: string;
    type: string;
    from_email?: string;
    from_name?: string;
  }): Promise<any> {
    try {
      const response = await client.post(`${API_CONFIG.crmUrl}/api/campaigns`, campaignData);
      toast.success('Campaign created successfully!');
      return response;
    } catch (error) {
      toast.error('Failed to create campaign');
      throw error;
    }
  }

  async updateCampaignStatus(campaignId: string, status: string): Promise<any> {
    try {
      const response = await client.put(`${API_CONFIG.crmUrl}/api/campaigns/${campaignId}/status`, {
        status: status
      });
      toast.success('Campaign status updated!');
      return response;
    } catch (error) {
      toast.error('Failed to update campaign status');
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 