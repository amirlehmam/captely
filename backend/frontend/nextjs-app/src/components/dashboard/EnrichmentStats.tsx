import React from 'react';
import { Users, Mail, Phone, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { useDashboardStats, useUserProfile } from '../../hooks/useApi';

const EnrichmentStats: React.FC = () => {
  const { profile } = useUserProfile();
  const { stats, loading, error } = useDashboardStats(profile?.id || '');

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg animate-pulse">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-5 w-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700 dark:text-red-300">Failed to load stats: {error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statsData = [
    {
      name: 'Total Contacts',
      value: stats.overview.total_contacts.toLocaleString(),
      change: '+12.5%', // Could calculate from historical data
      trend: 'up' as const,
      icon: <Users className="h-5 w-5 text-blue-500" />,
    },
    {
      name: 'Email Hit Rate',
      value: `${Math.round(stats.overview.success_rate)}%`,
      change: '+3.2%', // Could calculate from historical data
      trend: 'up' as const,
      icon: <Mail className="h-5 w-5 text-green-500" />,
    },
    {
      name: 'Phone Hit Rate',
      value: `${Math.round((stats.overview.phones_found / stats.overview.total_contacts) * 100)}%`,
      change: '+5.1%', // Could calculate from historical data
      trend: 'up' as const,
      icon: <Phone className="h-5 w-5 text-purple-500" />,
    },
    {
      name: 'Credits Remaining',
      value: stats.overview.credits_remaining.toLocaleString(),
      change: `-${stats.overview.credits_used}`,
      trend: 'down' as const,
      icon: <Clock className="h-5 w-5 text-orange-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsData.map((stat) => (
        <div 
          key={stat.name}
          className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all hover:shadow-md"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 rounded-full bg-gray-50 dark:bg-gray-700">
                {stat.icon}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {stat.name}
                  </dt>
                  <dd>
                    <div className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                        stat.trend === 'up' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <TrendingUp className={`self-center flex-shrink-0 h-4 w-4 ${
                          stat.trend === 'up' ? '' : 'transform rotate-180'
                        }`} />
                        <span className="ml-1">{stat.change}</span>
                      </div>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EnrichmentStats;