export interface IntegrationStats {
  connected: number;
  available: number;
  syncedToday: number;
  syncedTodayGrowth: number;
  apiCalls: number;
  uptime: number;
}

export interface IntegrationStatus {
  hubspot: boolean;
  lemlist: boolean;
  zapier: boolean;
  [key: string]: boolean;
}

class IntegrationStatsService {
  private baseUrl = typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_API_URL 
    ? (window as any).NEXT_PUBLIC_API_URL 
    : 'http://localhost:8000';

  async getIntegrationStats(): Promise<IntegrationStats> {
    try {
      const response = await fetch(`${this.baseUrl}/api/integrations/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        connected: data.connected || 0,
        available: data.available || 5,
        syncedToday: data.synced_today || 0,
        syncedTodayGrowth: data.synced_today_growth || 0,
        apiCalls: data.api_calls || 0,
        uptime: data.uptime || 99.9,
      };
    } catch (error) {
      console.error('Error fetching integration stats:', error);
      // Return default/fallback stats if API is unavailable
      return {
        connected: 0,
        available: 5,
        syncedToday: 0,
        syncedTodayGrowth: 0,
        apiCalls: 0,
        uptime: 99.9,
      };
    }
  }

  async getIntegrationStatuses(): Promise<IntegrationStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/integrations/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        hubspot: data.hubspot || false,
        lemlist: data.lemlist || false,
        zapier: data.zapier || false,
      };
    } catch (error) {
      console.error('Error fetching integration statuses:', error);
      return {
        hubspot: false,
        lemlist: false,
        zapier: false,
      };
    }
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }

  formatGrowth(growth: number): string {
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  }
}

export const integrationStatsService = new IntegrationStatsService(); 